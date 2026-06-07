const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const S3 = require('@aws-sdk/client-s3');
const { query, migrate, TENANT_TABLES } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ---------- almacenamiento de archivos (R2/S3 si está configurado; si no, en la base) ----------
const R2 = {
  endpoint: process.env.S3_ENDPOINT || process.env.R2_ENDPOINT,
  bucket: process.env.S3_BUCKET || process.env.R2_BUCKET,
  key: process.env.S3_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
  secret: process.env.S3_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.S3_REGION || process.env.R2_REGION || 'auto',
};
const R2_ENABLED = !!(R2.endpoint && R2.bucket && R2.key && R2.secret);
const s3 = R2_ENABLED ? new S3.S3Client({ region: R2.region, endpoint: R2.endpoint, forcePathStyle: true, credentials: { accessKeyId: R2.key, secretAccessKey: R2.secret } }) : null;
const DB_BLOB_CAP = 12 * 1024 * 1024; // 12MB tope para fallback en base
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024 } });
const safeName = (n) => (n || 'archivo').normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(0, 120);

async function putFile(tenantId, proyId, file) {
  if (R2_ENABLED) {
    const k = `tenant_${tenantId}/proyectos/${proyId}/${Date.now()}_${safeName(file.originalname)}`;
    await s3.send(new S3.PutObjectCommand({ Bucket: R2.bucket, Key: k, Body: file.buffer, ContentType: file.mimetype }));
    return { storage: 'r2', r2_key: k, blob: null };
  }
  if (file.size > DB_BLOB_CAP) throw new Error('Archivo grande: configurá R2 (S3_*) para subir > 12MB');
  return { storage: 'db', r2_key: null, blob: file.buffer };
}
async function streamFile(res, row, asDownload) {
  res.setHeader('Content-Type', row.mime || 'application/octet-stream');
  res.setHeader('Content-Disposition', `${asDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(row.nombre || 'archivo')}"`);
  if (row.storage === 'r2') {
    const out = await s3.send(new S3.GetObjectCommand({ Bucket: R2.bucket, Key: row.r2_key }));
    out.Body.pipe(res);
  } else {
    res.send(row.blob);
  }
}

// ---------- helpers ----------
const N = (v) => Number(v) || 0;
const chainOf = (f) => (1 + N(f.gg)) * (1 + N(f.utilidad)) * (1 + N(f.it));
function calcPartida(p, f) {
  const costo = N(p.cantidad) * N(p.pu_costo);
  const cant_fact = Math.ceil(N(p.cantidad) * (N(p.factor) || 1));
  const pu_venta = N(p.pu_costo) * chainOf(f);
  return { costo, cant_fact, pu_venta, venta: cant_fact * pu_venta };
}

function actor(req){return ((req.user?req.user.nombre:req.header('x-user'))||'sistema').slice(0,60);}
async function audit(req, { accion, entidad, entidad_id, antes, despues, detalle }) {
  const usuario = ((req.user ? req.user.nombre : req.header('x-user')) || 'sistema').slice(0, 60);
  try {
    await query(
      'INSERT INTO auditoria(tenant_id,usuario,accion,entidad,entidad_id,antes,despues,detalle) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [req.tenantId || null, usuario, accion, entidad, entidad_id || null,
        antes ? JSON.stringify(antes) : null, despues ? JSON.stringify(despues) : null, detalle || null]);
  } catch (e) { console.error('audit', e.message); }
}

// ¿el proyecto/capítulo pertenece a esta organización?
async function ownProy(T, id) { return (await query('SELECT 1 FROM proyectos WHERE id=$1 AND tenant_id=$2', [id, T])).rowCount > 0; }
async function ownCap(T, id) { return (await query('SELECT 1 FROM capitulos WHERE id=$1 AND tenant_id=$2', [id, T])).rowCount > 0; }

async function getProyecto(id, T) {
  const p = (await query('SELECT * FROM proyectos WHERE id=$1 AND tenant_id=$2', [id, T])).rows[0];
  if (!p) return null;
  const f = { gg: p.gg, utilidad: p.utilidad, it: p.it };
  if (p.tipo === 'obra') {
    const caps = (await query('SELECT * FROM capitulos WHERE proyecto_id=$1 AND tenant_id=$2 ORDER BY orden, id', [id, T])).rows;
    const parts = (await query(
      'SELECT pa.* FROM partidas pa JOIN capitulos c ON c.id=pa.capitulo_id WHERE c.proyecto_id=$1 AND pa.tenant_id=$2 ORDER BY pa.orden, pa.id', [id, T])).rows;
    let costo = 0, venta = 0;
    for (const c of caps) {
      let cc = 0, cv = 0;
      c.partidas = parts.filter((x) => x.capitulo_id === c.id).map((pa) => {
        const r = calcPartida(pa, f); cc += r.costo; cv += r.venta;
        return { ...pa, ...r };
      });
      c.costo = cc; c.venta = cv; costo += cc; venta += cv;
    }
    p.capitulos = caps;
    let avPeso = 0, avHecho = 0, avTot = 0, avDone = 0;
    for (const c of caps) {
      let cp = 0, ch = 0, ct = 0, cd = 0;
      for (const pa of c.partidas) { const w = N(pa.cantidad) * N(pa.pu_costo); cp += w; ct++; if (pa.completada) { ch += w; cd++; } }
      c.avance = cp > 0 ? Math.round(ch / cp * 100) : (ct ? Math.round(cd / ct * 100) : 0);
      avPeso += cp; avHecho += ch; avTot += ct; avDone += cd;
    }
    p.avance = avPeso > 0 ? Math.round(avHecho / avPeso * 100) : (avTot ? Math.round(avDone / avTot * 100) : 0);
    p.totales = { costo, venta, margen: venta - costo, credito_diseno: N(p.credito_diseno), neto: venta - N(p.credito_diseno), tc: N(p.tc), chain: chainOf(f) };
    const hitos = (await query('SELECT * FROM hitos_cobro WHERE obra_id=$1 AND tenant_id=$2 ORDER BY orden, id', [id, T])).rows;
    const base = p.totales.neto;
    hitos.forEach((h) => { h.monto = N(h.porcentaje) / 100 * base; });
    p.hitos = hitos;
    p.totales.hito_base = base;
    p.totales.hito_pct = hitos.reduce((s, h) => s + N(h.porcentaje), 0);
    const hitosPago = (await query('SELECT hp.*, pr.nombre AS proveedor_nombre, pr.email AS proveedor_email FROM hitos_pago hp LEFT JOIN proveedores pr ON pr.id=hp.proveedor_id WHERE hp.obra_id=$1 AND hp.tenant_id=$2 ORDER BY hp.orden, hp.id', [id, T])).rows;
    hitosPago.forEach((h) => { h.monto = N(h.porcentaje) / 100 * costo; });
    p.hitos_pago = hitosPago;
    p.totales.hito_pago_pct = hitosPago.reduce((s, h) => s + N(h.porcentaje), 0);
  } else {
    const ents = (await query('SELECT * FROM entregables WHERE proyecto_id=$1 AND tenant_id=$2 ORDER BY orden, id', [id, T])).rows;
    let costo = 0, precio = 0; ents.forEach((e) => { costo += N(e.costo); precio += N(e.precio); });
    p.entregables = ents;
    p.totales = { costo, venta: precio, margen: precio - costo, neto: precio, tc: N(p.tc) };
    const hitosP = (await query('SELECT * FROM hitos_cobro WHERE obra_id=$1 AND tenant_id=$2 ORDER BY orden, id', [id, T])).rows;
    hitosP.forEach((h) => { h.monto = N(h.porcentaje) / 100 * precio; });
    p.hitos = hitosP;
    p.totales.hito_base = precio;
    p.totales.hito_pct = hitosP.reduce((s, h) => s + N(h.porcentaje), 0);
    const hitosPagoP = (await query('SELECT hp.*, pr.nombre AS proveedor_nombre, pr.email AS proveedor_email FROM hitos_pago hp LEFT JOIN proveedores pr ON pr.id=hp.proveedor_id WHERE hp.obra_id=$1 AND hp.tenant_id=$2 ORDER BY hp.orden, hp.id', [id, T])).rows;
    hitosPagoP.forEach((h) => { h.monto = N(h.porcentaje) / 100 * costo; });
    p.hitos_pago = hitosPagoP;
    p.totales.hito_pago_pct = hitosPagoP.reduce((s, h) => s + N(h.porcentaje), 0);
  }
  return p;
}

// ---------- auth multitenant (login de usuario + llave maestra + token de servicio) ----------
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'origina-admin-2026-sgbolivia'; // super-admin de plataforma (SG)
const JWT_SECRET = process.env.JWT_SECRET || 'origina-jwt-dev-secret-cambiar';
const JWT_DIAS = parseInt(process.env.JWT_DIAS) || 30;

// permisos por rol
const ROLE_PERMS = {
  admin:          ['READ', 'WRITE', 'APPROVE', 'USERS'],
  aprobador:      ['READ', 'WRITE', 'APPROVE'],
  administrativo: ['READ', 'WRITE'],
  revisor:        ['READ'],
};
function rolDe(req) { return req.user ? req.user.rol : (req.admin || req.servicio ? 'admin' : null); }
function can(req, perm) { const r = rolDe(req); return !!(r && (ROLE_PERMS[r] || []).includes(perm)); }

let TENANTS = new Map(); // token de servicio -> tenant
async function loadTenants() {
  try {
    const rows = (await query('SELECT id,nombre,slug,token,plan,activo FROM tenants WHERE activo')).rows;
    TENANTS = new Map(rows.map((t) => [t.token, t]));
    console.log(`[auth] ${TENANTS.size} organización(es) activa(s) en caché.`);
  } catch (e) { console.error('[auth] no se pudieron cargar tenants:', e.message); }
}
function getToken(req) {
  const h = req.header('x-api-token');
  if (h) return h.trim();
  const auth = req.header('authorization') || '';
  if (/^bearer /i.test(auth)) return auth.slice(7).trim();
  if (req.query && req.query.token) return String(req.query.token).trim(); // descargas vía window.open
  return '';
}
function firmarJWT(u) { return jwt.sign({ uid: u.id, tid: u.tenant_id, rol: u.rol, nombre: u.nombre, email: u.email }, JWT_SECRET, { expiresIn: JWT_DIAS + 'd' }); }

// 1) resolver identidad
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/auth/login') return next();
  const tok = getToken(req);
  // a) JWT de usuario (login)
  if (tok && tok.split('.').length === 3) {
    try {
      const p = jwt.verify(tok, JWT_SECRET);
      req.user = { id: p.uid, rol: p.rol, nombre: p.nombre, email: p.email };
      req.tenantId = p.tid;
      return next();
    } catch (e) { return res.status(401).json({ error: 'Sesión vencida o inválida. Iniciá sesión de nuevo.' }); }
  }
  // b) llave maestra de plataforma (super-admin SG)
  if (tok && tok === ADMIN_TOKEN) {
    req.admin = true;
    const xt = req.header('x-tenant-id');
    req.tenantId = xt ? parseInt(xt) : null;
    return next();
  }
  // c) token de servicio por organización (integraciones / bots) — rol admin dentro del tenant
  const t = tok ? TENANTS.get(tok) : null;
  if (t) { req.tenant = t; req.servicio = true; req.tenantId = t.id; return next(); }
  return res.status(401).json({ error: 'No autenticado. Iniciá sesión.' });
});

// 2) permisos por método/ruta
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/auth/login' || req.path === '/me') return next();
  if (req.path.startsWith('/admin/')) { if (!req.admin) return res.status(403).json({ error: 'Requiere llave maestra de plataforma' }); return next(); }
  if (req.method === 'GET') { if (!can(req, 'READ')) return res.status(403).json({ error: 'Sin permiso de lectura' }); return next(); }
  if (req.path === '/assistant') { if (!can(req, 'READ')) return res.status(403).json({ error: 'Sin permiso de lectura' }); return next(); }
  if (req.path.startsWith('/usuarios')) { if (!can(req, 'USERS')) return res.status(403).json({ error: 'Solo un admin gestiona usuarios' }); return next(); }
  if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol (revisor) es de solo lectura' });
  next();
});

// id de organización efectiva para rutas de datos
function tid(req, res) {
  if (req.tenantId) return req.tenantId;
  res.status(req.admin ? 400 : 401).json({ error: req.admin ? 'Sos super-admin: indicá la organización con el header x-tenant-id' : 'Sin organización' });
  return 0;
}
function requireAdmin(req, res, next) { if (!req.admin) return res.status(403).json({ error: 'Requiere llave maestra de plataforma' }); next(); }
// APPROVE: transición sensible (aprobar / mover cobros). Corta si el rol no puede.
function needApprove(req, res) { if (can(req, 'APPROVE')) return true; res.status(403).json({ error: 'Tu rol no puede aprobar ni mover estados de cobro/costo' }); return false; }

const PKG_VERSION = (() => { try { return require('./package.json').version; } catch (e) { return '?'; } })();
// ---------- health (abierto) ----------
app.get('/api/health', (req, res) => res.json({ ok: true, app: 'origina-v2', version: PKG_VERSION, storage: R2_ENABLED ? 'r2' : 'db', multitenant: true, time: new Date().toISOString() }));

// ---------- sesión / login ----------
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const u = (await query('SELECT * FROM usuarios WHERE lower(email)=lower($1) AND activo', [String(email).trim()])).rows[0];
    if (!u || !bcrypt.compareSync(String(password), u.password_hash)) return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    const token = firmarJWT(u);
    const tenant = (await query('SELECT id,nombre,slug,plan FROM tenants WHERE id=$1', [u.tenant_id])).rows[0] || null;
    res.json({ token, user: { nombre: u.nombre, email: u.email }, rol: u.rol, perms: ROLE_PERMS[u.rol] || [], tenant });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/me', async (req, res) => {
  try {
    let tenant = null;
    if (req.tenantId) { const t = (await query('SELECT id,nombre,slug,plan FROM tenants WHERE id=$1', [req.tenantId])).rows[0]; if (t) tenant = t; }
    const rol = rolDe(req);
    res.json({
      superadmin: !!req.admin,
      servicio: !!req.servicio,
      user: req.user ? { nombre: req.user.nombre, email: req.user.email } : null,
      rol, perms: ROLE_PERMS[rol] || [], tenant,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- usuarios (gestiona el admin de cada organización) ----------
const ROLES = ['admin', 'aprobador', 'administrativo', 'revisor'];
app.get('/api/usuarios', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'USERS')) return res.status(403).json({ error: 'Solo un admin ve los usuarios' });
    res.json((await query('SELECT id,nombre,email,rol,activo,creado_en FROM usuarios WHERE tenant_id=$1 ORDER BY id', [T])).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/usuarios', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const b = req.body || {};
    if (!b.email || !b.password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const rol = ROLES.includes(b.rol) ? b.rol : 'administrativo';
    const hash = bcrypt.hashSync(String(b.password), 10);
    const r = await query('INSERT INTO usuarios(tenant_id,nombre,email,password_hash,rol) VALUES($1,$2,$3,$4,$5) RETURNING id,nombre,email,rol,activo',
      [T, b.nombre || b.email, String(b.email).trim(), hash, rol]);
    await audit(req, { accion: 'crear_usuario', entidad: 'usuario', entidad_id: r.rows[0].id, despues: { email: r.rows[0].email, rol } });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'Ya existe un usuario con ese email' : e.message }); }
});
app.patch('/api/usuarios/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const b = req.body || {};
    const antes = (await query('SELECT id,nombre,email,rol,activo FROM usuarios WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    const sets = [], vals = []; let i = 1;
    if ('nombre' in b) { sets.push(`nombre=$${i++}`); vals.push(b.nombre); }
    if ('rol' in b && ROLES.includes(b.rol)) { sets.push(`rol=$${i++}`); vals.push(b.rol); }
    if ('activo' in b) { sets.push(`activo=$${i++}`); vals.push(!!b.activo); }
    if (b.password) { sets.push(`password_hash=$${i++}`); vals.push(bcrypt.hashSync(String(b.password), 10)); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id, T);
    const r = await query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id=$${i++} AND tenant_id=$${i} RETURNING id,nombre,email,rol,activo`, vals);
    await audit(req, { accion: 'editar_usuario', entidad: 'usuario', entidad_id: antes.id, antes, despues: r.rows[0] });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/usuarios/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (req.user && String(req.user.id) === String(req.params.id)) return res.status(409).json({ error: 'No podés eliminar tu propio usuario' });
    const antes = (await query('SELECT id,email FROM usuarios WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM usuarios WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_usuario', entidad: 'usuario', entidad_id: req.params.id, antes });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- admin: organizaciones (super-admin de plataforma) ----------
const slugify = (s) => (s || 'org').toString().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'org';
app.get('/api/admin/tenants', requireAdmin, async (req, res) => {
  try {
    const rows = (await query(
      `SELECT t.id,t.nombre,t.slug,t.token,t.plan,t.activo,t.creado_en,
        (SELECT COUNT(*) FROM proyectos p WHERE p.tenant_id=t.id) AS proyectos
       FROM tenants t ORDER BY t.id`)).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/tenants', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const slug = slugify(b.slug || b.nombre);
    const token = (b.token && String(b.token).trim()) || (slug + '-' + crypto.randomBytes(6).toString('hex'));
    const r = await query('INSERT INTO tenants(nombre,slug,token,plan) VALUES($1,$2,$3,$4) RETURNING *',
      [b.nombre || 'Organización', slug, token, b.plan || 'basico']);
    const tenant = r.rows[0];
    let admin = null;
    if (b.admin_email && b.admin_password) {
      const hash = bcrypt.hashSync(String(b.admin_password), 10);
      const ru = await query('INSERT INTO usuarios(tenant_id,nombre,email,password_hash,rol) VALUES($1,$2,$3,$4,$5) RETURNING id,nombre,email,rol',
        [tenant.id, b.admin_nombre || b.admin_email, String(b.admin_email).trim(), hash, 'admin']);
      admin = ru.rows[0];
    }
    await loadTenants();
    await audit(req, { accion: 'crear_tenant', entidad: 'tenant', entidad_id: tenant.id, despues: { nombre: tenant.nombre, slug: tenant.slug, admin: admin ? admin.email : null } });
    res.status(201).json({ ...tenant, admin });
  } catch (e) { res.status(e.code === '23505' ? 409 : 500).json({ error: e.code === '23505' ? 'Ya existe una organización con ese slug o token' : e.message }); }
});
app.patch('/api/admin/tenants/:id', requireAdmin, async (req, res) => {
  try {
    const sets = [], vals = []; let i = 1;
    for (const k of ['nombre', 'plan', 'activo']) if (k in (req.body || {})) { sets.push(`${k}=$${i++}`); vals.push(req.body[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id);
    const r = await query(`UPDATE tenants SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`, vals);
    if (!r.rows[0]) return res.status(404).json({ error: 'No encontrada' });
    await loadTenants();
    await audit(req, { accion: 'editar_tenant', entidad: 'tenant', entidad_id: r.rows[0].id, despues: r.rows[0] });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/admin/tenants/:id/rotar-token', requireAdmin, async (req, res) => {
  try {
    const t = (await query('SELECT * FROM tenants WHERE id=$1', [req.params.id])).rows[0];
    if (!t) return res.status(404).json({ error: 'No encontrada' });
    const token = slugify(t.slug) + '-' + crypto.randomBytes(6).toString('hex');
    const r = await query('UPDATE tenants SET token=$1 WHERE id=$2 RETURNING *', [token, req.params.id]);
    await loadTenants();
    await audit(req, { accion: 'rotar_token', entidad: 'tenant', entidad_id: t.id });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- proyectos / obras ----------
app.get('/api/proyectos', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const tipo = req.query.tipo || null;
    const arch = req.query.archivados === '1';
    const ps = (await query('SELECT * FROM proyectos WHERE tenant_id=$1 AND ($2::text IS NULL OR tipo=$2) AND COALESCE(archivado,false)=$3 ORDER BY creado_en DESC', [T, tipo, arch])).rows;
    const parts = (await query('SELECT pa.*, c.proyecto_id FROM partidas pa JOIN capitulos c ON c.id=pa.capitulo_id WHERE pa.tenant_id=$1', [T])).rows;
    const ents = (await query('SELECT * FROM entregables WHERE tenant_id=$1', [T])).rows;
    const out = ps.map((p) => {
      const f = { gg: p.gg, utilidad: p.utilidad, it: p.it };
      let costo = 0, venta = 0;
      if (p.tipo === 'obra') {
        let _ap = 0, _ah = 0, _at = 0, _ad = 0;
        parts.filter((x) => x.proyecto_id === p.id).forEach((pa) => { const r = calcPartida(pa, f); costo += r.costo; venta += r.venta; const w = N(pa.cantidad) * N(pa.pu_costo); _ap += w; _at++; if (pa.completada) { _ah += w; _ad++; } });
        p.avance = _ap > 0 ? Math.round(_ah / _ap * 100) : (_at ? Math.round(_ad / _at * 100) : 0);
      } else {
        ents.filter((e) => e.proyecto_id === p.id).forEach((e) => { costo += N(e.costo); venta += N(e.precio); });
      }
      return { ...p, costo, venta, neto: venta - N(p.credito_diseno) };
    });
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/proyectos/:id', async (req, res) => {
  try { const T = tid(req, res); if (!T) return; const p = await getProyecto(req.params.id, T); if (!p) return res.status(404).json({ error: 'No encontrado' }); res.json(p); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/proyectos', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const b = req.body || {};
    const tipo = b.tipo === 'obra' ? 'obra' : 'proyecto';
    const r = await query(
      `INSERT INTO proyectos(tenant_id,tipo,nombre,cliente,ubicacion,responsable,estado,superficie,tc,gg,utilidad,it)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [T, tipo, b.nombre || 'Nuevo', b.cliente || null, b.ubicacion || null, b.responsable || null,
        b.estado || (tipo === 'obra' ? 'en curso' : 'borrador'), b.superficie || null,
        b.tc || 6.96, b.gg != null ? b.gg : 0.10, b.utilidad != null ? b.utilidad : 0.15, b.it != null ? b.it : 0.0309]);
    await audit(req, { accion: 'crear', entidad: tipo, entidad_id: r.rows[0].id, despues: r.rows[0] });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PFIELDS = ['nombre', 'cliente', 'ubicacion', 'responsable', 'estado', 'version', 'superficie', 'moneda', 'tc', 'gg', 'utilidad', 'it', 'credito_diseno', 'ini', 'fin', 'avance', 'estado_cobro', 'estado_costo', 'archivado'];
app.patch('/api/proyectos/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (['estado', 'estado_cobro', 'estado_costo'].some((k) => k in (req.body || {})) && !needApprove(req, res)) return;
    const antes = (await query('SELECT * FROM proyectos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    const sets = [], vals = []; let i = 1;
    for (const k of PFIELDS) if (k in (req.body || {})) { sets.push(`${k}=$${i++}`); vals.push(req.body[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id, T);
    const r = await query(`UPDATE proyectos SET ${sets.join(', ')} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, vals);
    await audit(req, { accion: 'editar', entidad: antes.tipo, entidad_id: antes.id, antes, despues: r.rows[0] });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/proyectos/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM proyectos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM proyectos WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar', entidad: antes.tipo, entidad_id: antes.id, antes });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// convertir proyecto (diseño) -> obra (ejecución)
app.post('/api/proyectos/:id/convertir', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!needApprove(req, res)) return;
    const src = (await query('SELECT * FROM proyectos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!src) return res.status(404).json({ error: 'No encontrado' });
    if (src.tipo !== 'proyecto') return res.status(409).json({ error: 'Solo se convierten proyectos de diseño' });
    const precio = N((await query('SELECT COALESCE(SUM(precio),0) s FROM entregables WHERE proyecto_id=$1 AND tenant_id=$2', [src.id, T])).rows[0].s);
    const credito = (src.estado === 'aceptado' || src.estado === 'vendido') ? precio : 0;
    const nombre = /dise[ñn]o/i.test(src.nombre) ? src.nombre.replace(/dise[ñn]o/i, 'Ejecución') : src.nombre + ' — Ejecución';
    const obra = (await query(
      `INSERT INTO proyectos(tenant_id,tipo,nombre,cliente,ubicacion,responsable,estado,version,superficie,tc,gg,utilidad,it,credito_diseno,proyecto_origen_id)
       VALUES($1,'obra',$2,$3,$4,$5,'en curso','V.01',$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [T, nombre, src.cliente, src.ubicacion, src.responsable, src.superficie, src.tc, src.gg, src.utilidad, src.it, credito, src.id])).rows[0];
    await query('UPDATE proyectos SET estado=$1 WHERE id=$2 AND tenant_id=$3', ['aceptado', src.id, T]);
    await audit(req, { accion: 'convertir_a_obra', entidad: 'proyecto', entidad_id: src.id, detalle: `Obra #${obra.id} creada · crédito diseño Bs ${credito}` });
    res.status(201).json(obra);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- capitulos ----------
app.post('/api/proyectos/:id/capitulos', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await ownProy(T, req.params.id))) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const b = req.body || {};
    const orden = N((await query('SELECT COALESCE(MAX(orden),-1)+1 o FROM capitulos WHERE proyecto_id=$1', [req.params.id])).rows[0].o);
    const r = await query(
      'INSERT INTO capitulos(tenant_id,proyecto_id,grupo,grupo_nombre,num,nombre,orden) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [T, req.params.id, b.grupo || 'A', b.grupo_nombre || 'OBRA', b.num || (orden + 1), b.nombre || 'Nuevo capítulo', orden]);
    await audit(req, { accion: 'crear_capitulo', entidad: 'capitulo', entidad_id: r.rows[0].id, despues: r.rows[0] });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const CFIELDS = ['grupo', 'grupo_nombre', 'num', 'nombre', 'orden'];
app.patch('/api/capitulos/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM capitulos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    const sets = [], vals = []; let i = 1;
    for (const k of CFIELDS) if (k in (req.body || {})) { sets.push(`${k}=$${i++}`); vals.push(req.body[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id, T);
    const r = await query(`UPDATE capitulos SET ${sets.join(', ')} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, vals);
    await audit(req, { accion: 'editar_capitulo', entidad: 'capitulo', entidad_id: antes.id, antes, despues: r.rows[0] });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/capitulos/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM capitulos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM capitulos WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_capitulo', entidad: 'capitulo', entidad_id: req.params.id, antes });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- partidas ----------
app.post('/api/capitulos/:id/partidas', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await ownCap(T, req.params.id))) return res.status(404).json({ error: 'Capítulo no encontrado' });
    const b = req.body || {};
    const orden = N((await query('SELECT COALESCE(MAX(orden),-1)+1 o FROM partidas WHERE capitulo_id=$1', [req.params.id])).rows[0].o);
    const r = await query(
      'INSERT INTO partidas(tenant_id,capitulo_id,descripcion,unidad,cantidad,factor,pu_costo,orden) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [T, req.params.id, b.descripcion || 'Nueva partida', b.unidad || 'glb', b.cantidad != null ? b.cantidad : 1, b.factor != null ? b.factor : 1, b.pu_costo != null ? b.pu_costo : 0, orden]);
    await audit(req, { accion: 'crear_partida', entidad: 'partida', entidad_id: r.rows[0].id, despues: r.rows[0] });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const PAFIELDS = ['descripcion', 'unidad', 'cantidad', 'factor', 'pu_costo', 'orden', 'completada'];
app.patch('/api/partidas/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM partidas WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    const sets = [], vals = []; let i = 1;
    for (const k of PAFIELDS) if (k in (req.body || {})) { sets.push(`${k}=$${i++}`); vals.push(req.body[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id, T);
    const r = await query(`UPDATE partidas SET ${sets.join(', ')} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, vals);
    await audit(req, { accion: 'editar_partida', entidad: 'partida', entidad_id: antes.id, antes, despues: r.rows[0], detalle: antes.descripcion });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/partidas/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM partidas WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM partidas WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_partida', entidad: 'partida', entidad_id: req.params.id, antes });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- entregables (proyecto diseño) ----------
app.post('/api/proyectos/:id/entregables', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await ownProy(T, req.params.id))) return res.status(404).json({ error: 'Proyecto no encontrado' });
    const b = req.body || {};
    const orden = N((await query('SELECT COALESCE(MAX(orden),-1)+1 o FROM entregables WHERE proyecto_id=$1', [req.params.id])).rows[0].o);
    const r = await query('INSERT INTO entregables(tenant_id,proyecto_id,nombre,costo,precio,orden) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
      [T, req.params.id, b.nombre || 'Nuevo entregable', b.costo || 0, b.precio || 0, orden]);
    await audit(req, { accion: 'crear_entregable', entidad: 'entregable', entidad_id: r.rows[0].id, despues: r.rows[0] });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/entregables/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM entregables WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    const sets = [], vals = []; let i = 1;
    for (const k of ['nombre', 'costo', 'precio', 'orden']) if (k in (req.body || {})) { sets.push(`${k}=$${i++}`); vals.push(req.body[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id, T);
    const r = await query(`UPDATE entregables SET ${sets.join(', ')} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, vals);
    await audit(req, { accion: 'editar_entregable', entidad: 'entregable', entidad_id: antes.id, antes, despues: r.rows[0] });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/entregables/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM entregables WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM entregables WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_entregable', entidad: 'entregable', entidad_id: req.params.id, antes });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- resumen IA de documentos (persistido, se genera una sola vez al subir) ----
const RESUMEN_SYS = `Sos un asistente que resume documentos para un estudio de arquitectura en Bolivia. Te paso el contenido (o una imagen/PDF) de un archivo. Devolvé SOLO un resumen de 2 a 4 frases en español rioplatense, claro y útil, para que alguien entienda de qué trata el archivo SIN abrirlo. Si es una cotización o presupuesto, mencioná cliente o proyecto, el total y la cantidad de ítems. Si es un plano, contrato o documento técnico, describí qué muestra o de qué trata. Incluí montos o fechas clave si aparecen. No inventes nada; si el contenido no alcanza, decílo en una frase. Sin preámbulos ni markdown.`;
async function docResumenParts(mime, nombre, buffer) {
  const m = (mime || '').toLowerCase(), nm = (nombre || 'archivo');
  const ext = (nm.split('.').pop() || '').toLowerCase();
  const isXlsx = m.includes('spreadsheet') || m.includes('excel') || ['xlsx', 'xls'].includes(ext);
  const isPdf = m.includes('pdf') || ext === 'pdf';
  const isImg = m.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext);
  const isTxt = m.startsWith('text/') || ['txt', 'csv', 'md'].includes(ext);
  if (isXlsx) {
    try {
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
      let txt = '';
      wb.worksheets.slice(0, 2).forEach((ws) => {
        txt += `Hoja "${ws.name}":\n`; let n = 0;
        ws.eachRow((row) => { if (n++ > 45) return; const vals = (row.values || []).slice(1, 9).map((v) => (v == null ? '' : (typeof v === 'object' ? (v.text || v.result || '') : v))); txt += vals.join(' | ') + '\n'; });
      });
      return { parts: [{ text: `Contenido de la planilla "${nm}":\n${txt.slice(0, 6000)}` }] };
    } catch (e) { return { skip: true, motivo: 'No se pudo leer la planilla.' }; }
  }
  if ((isPdf || isImg) && buffer.length <= 12 * 1024 * 1024) {
    const mt = isPdf ? 'application/pdf' : (m.startsWith('image/') ? m : 'image/' + (ext === 'jpg' ? 'jpeg' : ext));
    return { parts: [{ inlineData: { mimeType: mt, data: buffer.toString('base64') } }, { text: `Resumí este archivo ("${nm}").` }] };
  }
  if (isTxt) return { parts: [{ text: `Contenido de "${nm}":\n${buffer.toString('utf8').slice(0, 6000)}` }] };
  return { skip: true, motivo: 'Tipo de archivo no resumible automáticamente.' };
}
async function geminiSummarize(parts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const body = { systemInstruction: { parts: [{ text: RESUMEN_SYS }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } } };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const data = await r.json();
  const cand = (data.candidates && data.candidates[0]) || null;
  const um = data.usageMetadata || {};
  const usage = { tokens_in: um.promptTokenCount || 0, tokens_out: um.candidatesTokenCount || 0, tokens_think: um.thoughtsTokenCount || 0, tokens_total: um.totalTokenCount || 0 };
  if (!usage.tokens_total) usage.tokens_total = usage.tokens_in + usage.tokens_out + usage.tokens_think;
  let out = '';
  if (cand && cand.content && Array.isArray(cand.content.parts)) out = cand.content.parts.map((p) => p.text || '').join('').trim();
  return { text: out, usage, model };
}
async function summarizeDoc(T, docId, mime, nombre, buffer, usuario) {
  try {
    const pr = await docResumenParts(mime, nombre, buffer);
    if (pr.skip) { await query("UPDATE documentos SET resumen=$1, resumen_estado='na', resumen_en=now() WHERE id=$2 AND tenant_id=$3", [pr.motivo || null, docId, T]); return; }
    const g = await geminiSummarize(pr.parts);
    await recordIaUso(T, usuario || 'sistema', g.model, g.usage);
    await query("UPDATE documentos SET resumen=$1, resumen_estado='listo', resumen_en=now() WHERE id=$2 AND tenant_id=$3", [g.text || '(sin resumen)', docId, T]);
  } catch (e) {
    const estado = e.code === 'NO_KEY' ? 'na' : 'error';
    const txt = e.code === 'NO_KEY' ? '(Resumen IA no disponible: configurá la IA del servidor.)' : null;
    await query('UPDATE documentos SET resumen=$1, resumen_estado=$2, resumen_en=now() WHERE id=$3 AND tenant_id=$4', [txt, estado, docId, T]).catch(() => {});
    if (e.code !== 'NO_KEY') console.warn('[resumen] doc ' + docId + ':', e.message);
  }
}
async function getFileBytes(row) {
  if (row.storage === 'r2') {
    const out = await s3.send(new S3.GetObjectCommand({ Bucket: R2.bucket, Key: row.r2_key }));
    const chunks = []; for await (const c of out.Body) chunks.push(c); return Buffer.concat(chunks);
  }
  return row.blob;
}

// ---------- documentos ----------
app.get('/api/proyectos/:id/documentos', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const r = await query('SELECT id,proyecto_id,categoria,nombre,mime,bytes,storage,version,vigente,eliminado,reemplaza_a,autor,creado_en,resumen,resumen_estado,resumen_en FROM documentos WHERE proyecto_id=$1 AND tenant_id=$2 AND vigente AND NOT eliminado ORDER BY categoria, creado_en DESC', [req.params.id, T]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/proyectos/:id/documentos', upload.single('file'), async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await ownProy(T, req.params.id))) return res.status(404).json({ error: 'Proyecto no encontrado' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
    const cat = req.body.categoria || 'anexo';
    const st = await putFile(T, req.params.id, req.file);
    const r = await query('INSERT INTO documentos(tenant_id,proyecto_id,categoria,nombre,mime,bytes,storage,r2_key,blob,autor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,categoria,nombre,bytes,version',
      [T, req.params.id, cat, req.file.originalname, req.file.mimetype, req.file.size, st.storage, st.r2_key, st.blob, actor(req)]);
    await audit(req, { accion: 'subir_documento', entidad: 'documento', entidad_id: r.rows[0].id, detalle: `${cat} · ${req.file.originalname}` });
    summarizeDoc(T, r.rows[0].id, req.file.mimetype, req.file.originalname, req.file.buffer, actor(req));
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/documentos/:id/reemplazar', upload.single('file'), async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
    const old = (await query('SELECT * FROM documentos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!old) return res.status(404).json({ error: 'No encontrado' });
    const st = await putFile(T, old.proyecto_id, req.file);
    const r = await query('INSERT INTO documentos(tenant_id,proyecto_id,categoria,nombre,mime,bytes,storage,r2_key,blob,version,reemplaza_a,autor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,categoria,nombre,version',
      [T, old.proyecto_id, old.categoria, req.file.originalname, req.file.mimetype, req.file.size, st.storage, st.r2_key, st.blob, (old.version || 1) + 1, old.id, actor(req)]);
    await query('UPDATE documentos SET vigente=false WHERE id=$1 AND tenant_id=$2', [old.id, T]);
    await audit(req, { accion: 'reemplazar_documento', entidad: 'documento', entidad_id: r.rows[0].id, antes: { nombre: old.nombre, version: old.version }, despues: { nombre: req.file.originalname, version: (old.version || 1) + 1 } });
    summarizeDoc(T, r.rows[0].id, req.file.mimetype, req.file.originalname, req.file.buffer, actor(req));
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/documentos/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const old = (await query('SELECT id,nombre,categoria FROM documentos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!old) return res.status(404).json({ error: 'No encontrado' });
    await query('UPDATE documentos SET vigente=false, eliminado=true WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_documento', entidad: 'documento', entidad_id: req.params.id, antes: old });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/documentos/:id/download', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const row = (await query('SELECT * FROM documentos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    await streamFile(res, row, !!req.query.dl);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/documentos/:id/resumen', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const row = (await query('SELECT * FROM documentos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    await query("UPDATE documentos SET resumen_estado='pendiente' WHERE id=$1 AND tenant_id=$2", [row.id, T]);
    const buf = await getFileBytes(row);
    await summarizeDoc(T, row.id, row.mime, row.nombre, buf, actor(req));
    const upd = (await query('SELECT id,resumen,resumen_estado,resumen_en FROM documentos WHERE id=$1 AND tenant_id=$2', [row.id, T])).rows[0];
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- hitos de cobro (obras) ----------
app.post('/api/proyectos/:id/hitos', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await ownProy(T, req.params.id))) return res.status(404).json({ error: 'Obra no encontrada' });
    const b = req.body || {};
    const orden = N((await query('SELECT COALESCE(MAX(orden),-1)+1 o FROM hitos_cobro WHERE obra_id=$1', [req.params.id])).rows[0].o);
    const r = await query('INSERT INTO hitos_cobro(tenant_id,obra_id,nombre,porcentaje,fecha,estado,orden) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [T, req.params.id, b.nombre || 'Hito', b.porcentaje != null ? b.porcentaje : 0, b.fecha || null, b.estado || 'pendiente', orden]);
    await audit(req, { accion: 'crear_hito', entidad: 'hito', entidad_id: r.rows[0].id, despues: r.rows[0] });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const HFIELDS = ['nombre', 'porcentaje', 'fecha', 'estado', 'orden'];
app.patch('/api/hitos/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if ('estado' in (req.body || {}) && !needApprove(req, res)) return;
    const antes = (await query('SELECT * FROM hitos_cobro WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    const sets = [], vals = []; let i = 1;
    for (const k of HFIELDS) if (k in (req.body || {})) { sets.push(`${k}=$${i++}`); vals.push(req.body[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id, T);
    const r = await query(`UPDATE hitos_cobro SET ${sets.join(', ')} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, vals);
    await audit(req, { accion: 'editar_hito', entidad: 'hito', entidad_id: antes.id, antes, despues: r.rows[0] });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/hitos/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM hitos_cobro WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM hitos_cobro WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_hito', entidad: 'hito', entidad_id: req.params.id, antes });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- hitos de pago (obras) ----------
app.post('/api/proyectos/:id/hitos-pago', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await ownProy(T, req.params.id))) return res.status(404).json({ error: 'Obra no encontrada' });
    const b = req.body || {};
    const orden = N((await query('SELECT COALESCE(MAX(orden),-1)+1 o FROM hitos_pago WHERE obra_id=$1', [req.params.id])).rows[0].o);
    const r = await query('INSERT INTO hitos_pago(tenant_id,obra_id,nombre,porcentaje,fecha,estado,orden,proveedor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [T, req.params.id, b.nombre || 'Hito de pago', b.porcentaje != null ? b.porcentaje : 0, b.fecha || null, b.estado || 'pendiente', orden, b.proveedor_id || null]);
    await audit(req, { accion: 'crear_hito_pago', entidad: 'hito_pago', entidad_id: r.rows[0].id, despues: r.rows[0] });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
const HPFIELDS = ['nombre', 'porcentaje', 'fecha', 'estado', 'orden', 'proveedor_id'];
const HP_ESTADOS = ['pendiente', 'facturado', 'transferencia_solicitada', 'pagado'];
app.patch('/api/hitos-pago/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if ('estado' in (req.body || {})) {
      if (!HP_ESTADOS.includes(req.body.estado)) return res.status(400).json({ error: 'Estado inválido. Válidos: ' + HP_ESTADOS.join(', ') });
      if (!needApprove(req, res)) return;
    }
    const antes = (await query('SELECT * FROM hitos_pago WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    const sets = [], vals = []; let i = 1;
    for (const k of HPFIELDS) if (k in (req.body || {})) { sets.push(`${k}=$${i++}`); vals.push(req.body[k] === '' ? null : req.body[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id, T);
    const r = await query(`UPDATE hitos_pago SET ${sets.join(', ')} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, vals);
    await audit(req, { accion: 'editar_hito_pago', entidad: 'hito_pago', entidad_id: antes.id, antes, despues: r.rows[0] });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/hitos-pago/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const antes = (await query('SELECT * FROM hitos_pago WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM hitos_pago WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await query("UPDATE tareas SET estado='hecha', completado_en=now(), detalle=COALESCE(detalle,'')||' (hito de pago eliminado)' WHERE tenant_id=$1 AND estado!='hecha' AND detalle LIKE $2", [T, '%[hito_pago:' + req.params.id + ']%']);
    await audit(req, { accion: 'eliminar_hito_pago', entidad: 'hito_pago', entidad_id: req.params.id, antes });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- documentos del hito de pago + verificación IA ----------
async function hpCostoObra(T, obraId) {
  const t = (await query('SELECT tipo FROM proyectos WHERE id=$1 AND tenant_id=$2', [obraId, T])).rows[0];
  if (t && t.tipo === 'proyecto') {
    const r = (await query('SELECT COALESCE(SUM(costo),0) c FROM entregables WHERE proyecto_id=$1 AND tenant_id=$2', [obraId, T])).rows[0];
    return N(r.c);
  }
  const r = (await query('SELECT COALESCE(SUM(pa.cantidad*pa.pu_costo),0) c FROM partidas pa JOIN capitulos c2 ON c2.id=pa.capitulo_id WHERE c2.proyecto_id=$1 AND pa.tenant_id=$2', [obraId, T])).rows[0];
  return N(r.c);
}
async function hpContexto(T, hitoId) {
  return (await query(`SELECT hp.*, pr.nombre AS proveedor_nombre, pr.nit AS proveedor_nit, pr.email AS proveedor_email, o.nombre AS obra_nombre
    FROM hitos_pago hp LEFT JOIN proveedores pr ON pr.id=hp.proveedor_id JOIN proyectos o ON o.id=hp.obra_id
    WHERE hp.id=$1 AND hp.tenant_id=$2`, [hitoId, T])).rows[0];
}
function normTxt(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
// comparación pura (testeable): datos extraídos del documento vs lo esperado del hito
function matchVerificacion(ex, esp, opts) {
  const problemas = [];
  const monto = Number(ex && ex.monto);
  if (!monto || !isFinite(monto)) problemas.push('No pude leer el monto del documento');
  else {
    const tol = Math.max(esp.monto * 0.02, 1);
    if (Math.abs(monto - esp.monto) > tol) problemas.push(`Monto no coincide: el documento dice Bs ${monto} y lo esperado es Bs ${Math.round(esp.monto * 100) / 100} (tolerancia 2%)`);
  }
  const nitDoc = String((ex && ex.nit) || '').replace(/\D/g, '');
  const nitEsp = String(esp.nit || '').replace(/\D/g, '');
  if (opts && opts.soloMonto) { /* cobros: el nombre del ordenante varía, solo validamos monto */ }
  else if (nitEsp && nitDoc) {
    if (nitDoc !== nitEsp) problemas.push(`NIT no coincide: documento ${nitDoc} vs proveedor ${nitEsp}`);
  } else {
    const a = normTxt(ex && ex.nombre), b = normTxt(esp.nombre);
    const okNombre = a && b && (a.includes(b) || b.includes(a) || b.split(' ').filter((w) => w.length > 3 && a.includes(w)).length >= 1);
    if (!okNombre) problemas.push(`No pude confirmar al proveedor «${esp.nombre}» en el documento` + (ex && ex.nombre ? ` (leí «${ex.nombre}»)` : ''));
  }
  return { ok: problemas.length === 0, problemas, extraido: ex || null, esperado: { nombre: esp.nombre, nit: esp.nit || null, monto: Math.round(esp.monto * 100) / 100 } };
}
const VERIF_SYS = 'Sos un extractor de datos de documentos financieros bolivianos (facturas y comprobantes de transferencia bancaria). Respondé SOLO un JSON válido con esta forma exacta: {"nombre": string|null, "nit": string|null, "monto": number|null, "moneda": string|null, "fecha": string|null, "numero": string|null}. "nombre" = razón social del EMISOR si es factura, o del BENEFICIARIO/destinatario si es comprobante de transferencia. "nit" = NIT/CI de esa misma parte si aparece. "monto" = importe total en números. Si un dato no aparece, null.';
async function geminiExtraerDoc(mime, nombre, buffer, tipo) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const parts = [{ inlineData: { mimeType: mime, data: buffer.toString('base64') } }, { text: `Extraé los datos de ${tipo === 'factura' ? 'esta factura' : 'este comprobante de transferencia'} ("${nombre}").` }];
  const body = { systemInstruction: { parts: [{ text: VERIF_SYS }] }, contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, maxOutputTokens: 300, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } } };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const data = await r.json();
  const um = data.usageMetadata || {};
  const usage = { tokens_in: um.promptTokenCount || 0, tokens_out: um.candidatesTokenCount || 0, tokens_think: um.thoughtsTokenCount || 0, tokens_total: um.totalTokenCount || 0 };
  let txt = '';
  const cand = (data.candidates && data.candidates[0]) || null;
  if (cand && cand.content && Array.isArray(cand.content.parts)) txt = cand.content.parts.map((p) => p.text || '').join('').trim();
  txt = txt.replace(/^```json?\s*/i, '').replace(/```\s*$/, '').trim();
  let datos = null; try { datos = JSON.parse(txt); } catch (e) { datos = null; }
  return { datos, usage, model };
}
app.get('/api/hitos-pago/:id/docs', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await query('SELECT 1 FROM hitos_pago WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rowCount) return res.status(404).json({ error: 'Hito no encontrado' });
    const rows = (await query('SELECT id,tipo,nota,nombre,mime,bytes,verificacion,autor,creado_en FROM hito_pago_docs WHERE hito_pago_id=$1 AND tenant_id=$2 ORDER BY creado_en DESC, id DESC', [req.params.id, T])).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/hitos-pago/:id/docs', upload.single('file'), async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol no puede editar' });
    const h = await hpContexto(T, req.params.id);
    if (!h) return res.status(404).json({ error: 'Hito no encontrado' });
    const tipo = ['factura', 'comprobante', 'otro'].includes(req.body && req.body.tipo) ? req.body.tipo : 'otro';
    const nota = String((req.body && req.body.nota) || '').trim().slice(0, 2000) || null;
    if (!nota && !req.file) return res.status(400).json({ error: 'Adjuntá un archivo o escribí una nota' });
    if ((tipo === 'factura' || tipo === 'comprobante') && !req.file) return res.status(400).json({ error: 'Para ' + tipo + ' tenés que adjuntar el archivo' });
    let st = { storage: null, r2_key: null, blob: null }, nombre = null, mime = null, bytes = null;
    if (req.file) { st = await putFile(T, h.obra_id, req.file); nombre = req.file.originalname; mime = req.file.mimetype; bytes = req.file.size; }
    const ins = (await query('INSERT INTO hito_pago_docs(tenant_id,hito_pago_id,tipo,nota,nombre,mime,bytes,storage,r2_key,blob,autor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,tipo,nota,nombre,mime,bytes,autor,creado_en',
      [T, h.id, tipo, nota, nombre, mime, bytes, st.storage, st.r2_key, st.blob, actor(req)])).rows[0];
    await audit(req, { accion: 'doc_hito_pago', entidad: 'hito_pago', entidad_id: h.id, despues: { obra_id: h.obra_id, tipo, archivo: nombre, nota: nota ? nota.slice(0, 80) : null } });
    let verificacion = null, estado = h.estado;
    if ((tipo === 'factura' || tipo === 'comprobante') && req.file) {
      if (!/^image\//.test(mime) && mime !== 'application/pdf') {
        verificacion = { ok: false, error: 'Solo puedo verificar imágenes o PDF', problemas: ['Formato no verificable: ' + mime] };
      } else if (!h.proveedor_id) {
        verificacion = { ok: false, problemas: ['El hito no tiene proveedor asignado — asignalo y volvé a subir'] };
      } else {
        const costo = await hpCostoObra(T, h.obra_id);
        const esperado = {
          nombre: h.proveedor_nombre, nit: h.proveedor_nit,
          monto: tipo === 'comprobante' && h.monto_solicitado != null ? N(h.monto_solicitado) : N(h.porcentaje) / 100 * costo,
        };
        try {
          const g = await geminiExtraerDoc(mime, nombre, req.file.buffer, tipo);
          await recordIaUso(T, actor(req), g.model, g.usage);
          verificacion = g.datos ? matchVerificacion(g.datos, esperado) : { ok: false, problemas: ['La IA no devolvió datos legibles del documento'], esperado };
        } catch (e) {
          verificacion = { ok: false, error: e.code === 'NO_KEY' ? 'IA no configurada en el servidor' : 'No se pudo verificar: ' + e.message, problemas: ['Verificación IA no disponible — un aprobador puede cambiar el estado manualmente'], esperado };
        }
        if (verificacion.ok) {
          if (tipo === 'factura' && h.estado === 'pendiente') {
            await query("UPDATE hitos_pago SET estado='facturado' WHERE id=$1 AND tenant_id=$2", [h.id, T]);
            estado = 'facturado';
            await audit(req, { accion: 'factura_verificada', entidad: 'hito_pago', entidad_id: h.id, despues: { obra_id: h.obra_id, archivo: nombre, monto: verificacion.esperado.monto, proveedor: h.proveedor_nombre } });
          } else if (tipo === 'comprobante' && (h.estado === 'transferencia_solicitada' || h.estado === 'facturado')) {
            await query("UPDATE hitos_pago SET estado='pagado' WHERE id=$1 AND tenant_id=$2", [h.id, T]);
            estado = 'pagado';
            await audit(req, { accion: 'pago_confirmado', entidad: 'hito_pago', entidad_id: h.id, despues: { obra_id: h.obra_id, archivo: nombre, monto: verificacion.esperado.monto, proveedor: h.proveedor_nombre } });
            await query("UPDATE tareas SET estado='hecha', completado_en=now() WHERE tenant_id=$1 AND estado!='hecha' AND detalle LIKE $2", [T, '%[hito_pago:' + h.id + ']%']);
          }
        } else {
          await audit(req, { accion: 'verificacion_rechazada', entidad: 'hito_pago', entidad_id: h.id, despues: { obra_id: h.obra_id, tipo, archivo: nombre, problemas: (verificacion.problemas || []).slice(0, 4) } });
        }
        await query('UPDATE hito_pago_docs SET verificacion=$1 WHERE id=$2 AND tenant_id=$3', [JSON.stringify(verificacion), ins.id, T]);
      }
    }
    res.status(201).json({ doc: ins, verificacion, estado });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/hito-pago-docs/:id/archivo', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const row = (await query('SELECT * FROM hito_pago_docs WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!row || !row.storage) return res.status(404).json({ error: 'Sin archivo' });
    await streamFile(res, row, !!req.query.dl);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/hito-pago-docs/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol no puede editar' });
    const old = (await query('SELECT id,hito_pago_id,tipo,nombre,verificacion FROM hito_pago_docs WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!old) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM hito_pago_docs WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_doc_hito_pago', entidad: 'hito_pago', entidad_id: old.hito_pago_id, antes: { id: old.id, tipo: old.tipo, nombre: old.nombre } });
    // integridad: si este doc era la verificación que justificaba el estado actual, retroceder
    let estado = null;
    if (old.verificacion && old.verificacion.ok === true && (old.tipo === 'factura' || old.tipo === 'comprobante')) {
      const h = (await query('SELECT * FROM hitos_pago WHERE id=$1 AND tenant_id=$2', [old.hito_pago_id, T])).rows[0];
      const otros = (await query(`SELECT 1 FROM hito_pago_docs WHERE hito_pago_id=$1 AND tenant_id=$2 AND tipo=$3 AND (verificacion->>'ok')='true' LIMIT 1`, [old.hito_pago_id, T, old.tipo])).rowCount > 0;
      if (h && !otros) {
        if (old.tipo === 'factura' && h.estado === 'facturado') estado = 'pendiente';
        if (old.tipo === 'comprobante' && h.estado === 'pagado') estado = h.monto_solicitado != null ? 'transferencia_solicitada' : 'facturado';
        if (estado) {
          await query('UPDATE hitos_pago SET estado=$1 WHERE id=$2 AND tenant_id=$3', [estado, h.id, T]);
          await audit(req, { accion: 'retroceso_estado', entidad: 'hito_pago', entidad_id: h.id, antes: { estado: h.estado, obra_id: h.obra_id }, despues: { estado, obra_id: h.obra_id }, detalle: 'se eliminó el ' + old.tipo + ' que lo verificaba' });
        }
      }
    }
    res.json({ ok: true, estado });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/hitos-pago/:id/solicitar-transferencia', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol no puede editar' });
    const h = await hpContexto(T, req.params.id);
    if (!h) return res.status(404).json({ error: 'Hito no encontrado' });
    if (h.estado !== 'facturado') return res.status(400).json({ error: 'Para solicitar la transferencia el hito tiene que estar en «facturado» (con factura verificada)' });
    if (!h.proveedor_id) return res.status(400).json({ error: 'El hito no tiene proveedor asignado' });
    const costo = await hpCostoObra(T, h.obra_id);
    const monto = Math.round(N(h.porcentaje) / 100 * costo * 100) / 100;
    await query("UPDATE hitos_pago SET estado='transferencia_solicitada', monto_solicitado=$1 WHERE id=$2 AND tenant_id=$3", [monto, h.id, T]);
    const aprob = (await query("SELECT id,nombre FROM usuarios WHERE tenant_id=$1 AND activo AND rol='aprobador' ORDER BY id LIMIT 1", [T])).rows[0]
      || (await query("SELECT id,nombre FROM usuarios WHERE tenant_id=$1 AND activo AND rol='admin' ORDER BY id LIMIT 1", [T])).rows[0];
    const fmt = 'Bs ' + Math.round(monto).toLocaleString('es-BO');
    if (aprob) {
      await query('INSERT INTO tareas(tenant_id,titulo,detalle,estado,prioridad,asignado_a,proyecto_id) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [T, ('Autorizar transferencia · ' + fmt + ' a ' + h.proveedor_nombre).slice(0, 200),
          'Obra: ' + h.obra_nombre + ' · Hito: ' + (h.nombre || 'Hito') + ' · Monto congelado: ' + fmt + '. Autorizá la transferencia en el banco y cargá el comprobante desde Tareas o desde el hito (📋). [hito_pago:' + h.id + ']',
          'pendiente', 'alta', aprob.id, h.obra_id]);
    }
    await audit(req, { accion: 'solicitar_transferencia', entidad: 'hito_pago', entidad_id: h.id, despues: { obra_id: h.obra_id, monto_solicitado: monto, proveedor: h.proveedor_nombre, asignado: aprob ? aprob.nombre : null } });
    res.json({ ok: true, estado: 'transferencia_solicitada', monto_solicitado: monto, asignado: aprob ? aprob.nombre : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/transferencias-pendientes', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const rows = (await query(`SELECT hp.id, hp.nombre, hp.monto_solicitado, hp.fecha, hp.obra_id, o.nombre AS obra, pr.nombre AS proveedor, pr.email AS proveedor_email
      FROM hitos_pago hp JOIN proyectos o ON o.id=hp.obra_id LEFT JOIN proveedores pr ON pr.id=hp.proveedor_id
      WHERE hp.tenant_id=$1 AND hp.estado='transferencia_solicitada' ORDER BY hp.id`, [T])).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- documentos del hito de cobro + verificación IA (solo monto) ----------
async function hcBase(T, proyId) {
  const p = (await query('SELECT tipo, gg, utilidad, it, credito_diseno FROM proyectos WHERE id=$1 AND tenant_id=$2', [proyId, T])).rows[0];
  if (!p) return 0;
  if (p.tipo === 'proyecto') {
    const r = (await query('SELECT COALESCE(SUM(precio),0) v FROM entregables WHERE proyecto_id=$1 AND tenant_id=$2', [proyId, T])).rows[0];
    return N(r.v);
  }
  const parts = (await query('SELECT pa.* FROM partidas pa JOIN capitulos c2 ON c2.id=pa.capitulo_id WHERE c2.proyecto_id=$1 AND pa.tenant_id=$2', [proyId, T])).rows;
  const f = { gg: p.gg, utilidad: p.utilidad, it: p.it };
  let venta = 0; parts.forEach((pa) => { venta += calcPartida(pa, f).venta; });
  return venta - N(p.credito_diseno);
}
app.get('/api/hitos/:id/docs', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await query('SELECT 1 FROM hitos_cobro WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rowCount) return res.status(404).json({ error: 'Hito no encontrado' });
    const rows = (await query('SELECT id,tipo,nota,nombre,mime,bytes,verificacion,autor,creado_en FROM hito_cobro_docs WHERE hito_cobro_id=$1 AND tenant_id=$2 ORDER BY creado_en DESC, id DESC', [req.params.id, T])).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/hitos/:id/docs', upload.single('file'), async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol no puede editar' });
    const h = (await query('SELECT hc.*, o.nombre AS obra_nombre, o.cliente FROM hitos_cobro hc JOIN proyectos o ON o.id=hc.obra_id WHERE hc.id=$1 AND hc.tenant_id=$2', [req.params.id, T])).rows[0];
    if (!h) return res.status(404).json({ error: 'Hito no encontrado' });
    const tipo = ['factura', 'comprobante', 'otro'].includes(req.body && req.body.tipo) ? req.body.tipo : 'otro';
    const nota = String((req.body && req.body.nota) || '').trim().slice(0, 2000) || null;
    if (!nota && !req.file) return res.status(400).json({ error: 'Adjuntá un archivo o escribí una nota' });
    if ((tipo === 'factura' || tipo === 'comprobante') && !req.file) return res.status(400).json({ error: 'Para ' + tipo + ' tenés que adjuntar el archivo' });
    let st = { storage: null, r2_key: null, blob: null }, nombre = null, mime = null, bytes = null;
    if (req.file) { st = await putFile(T, h.obra_id, req.file); nombre = req.file.originalname; mime = req.file.mimetype; bytes = req.file.size; }
    const ins = (await query('INSERT INTO hito_cobro_docs(tenant_id,hito_cobro_id,tipo,nota,nombre,mime,bytes,storage,r2_key,blob,autor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,tipo,nota,nombre,mime,bytes,autor,creado_en',
      [T, h.id, tipo, nota, nombre, mime, bytes, st.storage, st.r2_key, st.blob, actor(req)])).rows[0];
    await audit(req, { accion: 'doc_hito_cobro', entidad: 'hito', entidad_id: h.id, despues: { obra_id: h.obra_id, tipo, archivo: nombre, nota: nota ? nota.slice(0, 80) : null } });
    let verificacion = null, estado = h.estado;
    if ((tipo === 'factura' || tipo === 'comprobante') && req.file) {
      if (!/^image\//.test(mime) && mime !== 'application/pdf') {
        verificacion = { ok: false, error: 'Solo puedo verificar imágenes o PDF', problemas: ['Formato no verificable: ' + mime] };
      } else {
        const base = await hcBase(T, h.obra_id);
        const esperado = { nombre: h.cliente || null, nit: null, monto: N(h.porcentaje) / 100 * base };
        try {
          const g = await geminiExtraerDoc(mime, nombre, req.file.buffer, tipo);
          await recordIaUso(T, actor(req), g.model, g.usage);
          verificacion = g.datos ? matchVerificacion(g.datos, esperado, { soloMonto: true }) : { ok: false, problemas: ['La IA no devolvió datos legibles del documento'], esperado };
        } catch (e) {
          verificacion = { ok: false, error: e.code === 'NO_KEY' ? 'IA no configurada en el servidor' : 'No se pudo verificar: ' + e.message, problemas: ['Verificación IA no disponible — un aprobador puede cambiar el estado manualmente'], esperado };
        }
        if (verificacion.ok) {
          if (tipo === 'factura' && h.estado === 'pendiente') {
            await query("UPDATE hitos_cobro SET estado='facturado' WHERE id=$1 AND tenant_id=$2", [h.id, T]);
            estado = 'facturado';
            await audit(req, { accion: 'factura_cobro_verificada', entidad: 'hito', entidad_id: h.id, despues: { obra_id: h.obra_id, archivo: nombre, monto: verificacion.esperado.monto } });
          } else if (tipo === 'comprobante' && (h.estado === 'facturado' || h.estado === 'pendiente')) {
            await query("UPDATE hitos_cobro SET estado='cobrado' WHERE id=$1 AND tenant_id=$2", [h.id, T]);
            estado = 'cobrado';
            await audit(req, { accion: 'cobro_confirmado', entidad: 'hito', entidad_id: h.id, despues: { obra_id: h.obra_id, archivo: nombre, monto: verificacion.esperado.monto } });
          }
        } else {
          await audit(req, { accion: 'verificacion_cobro_rechazada', entidad: 'hito', entidad_id: h.id, despues: { obra_id: h.obra_id, tipo, archivo: nombre, problemas: (verificacion.problemas || []).slice(0, 4) } });
        }
        await query('UPDATE hito_cobro_docs SET verificacion=$1 WHERE id=$2 AND tenant_id=$3', [JSON.stringify(verificacion), ins.id, T]);
      }
    }
    res.status(201).json({ doc: ins, verificacion, estado });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/hito-cobro-docs/:id/archivo', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const row = (await query('SELECT * FROM hito_cobro_docs WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!row || !row.storage) return res.status(404).json({ error: 'Sin archivo' });
    await streamFile(res, row, !!req.query.dl);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/hito-cobro-docs/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol no puede editar' });
    const old = (await query('SELECT id,hito_cobro_id,tipo,nombre,verificacion FROM hito_cobro_docs WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!old) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM hito_cobro_docs WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_doc_hito_cobro', entidad: 'hito', entidad_id: old.hito_cobro_id, antes: { id: old.id, tipo: old.tipo, nombre: old.nombre } });
    let estado = null;
    if (old.verificacion && old.verificacion.ok === true && (old.tipo === 'factura' || old.tipo === 'comprobante')) {
      const h = (await query('SELECT * FROM hitos_cobro WHERE id=$1 AND tenant_id=$2', [old.hito_cobro_id, T])).rows[0];
      const otros = (await query(`SELECT 1 FROM hito_cobro_docs WHERE hito_cobro_id=$1 AND tenant_id=$2 AND tipo=$3 AND (verificacion->>'ok')='true' LIMIT 1`, [old.hito_cobro_id, T, old.tipo])).rowCount > 0;
      if (h && !otros) {
        if (old.tipo === 'factura' && h.estado === 'facturado') estado = 'pendiente';
        if (old.tipo === 'comprobante' && h.estado === 'cobrado') estado = 'facturado';
        if (estado) {
          await query('UPDATE hitos_cobro SET estado=$1 WHERE id=$2 AND tenant_id=$3', [estado, h.id, T]);
          await audit(req, { accion: 'retroceso_estado_cobro', entidad: 'hito', entidad_id: h.id, antes: { estado: h.estado, obra_id: h.obra_id }, despues: { estado, obra_id: h.obra_id }, detalle: 'se eliminó el ' + old.tipo + ' que lo verificaba' });
        }
      }
    }
    res.json({ ok: true, estado });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- proveedores ----------
const PROVFIELDS = ['nombre', 'email', 'nit', 'razon_social', 'telefono', 'contacto', 'rubro', 'notas', 'activo'];
app.get('/api/proveedores', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const rows = (await query('SELECT * FROM proveedores WHERE tenant_id=$1 ORDER BY activo DESC, lower(nombre)', [T])).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/proveedores', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol no puede editar' });
    const b = req.body || {};
    const nombre = String(b.nombre || '').trim().slice(0, 200);
    if (!nombre) return res.status(400).json({ error: 'El proveedor necesita un nombre' });
    const r = await query('INSERT INTO proveedores(tenant_id,nombre,email,nit,razon_social,telefono,contacto,rubro,notas) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [T, nombre, b.email || null, b.nit || null, b.razon_social || null, b.telefono || null, b.contacto || null, b.rubro || null, b.notas || null]);
    await audit(req, { accion: 'crear_proveedor', entidad: 'proveedor', entidad_id: r.rows[0].id, despues: r.rows[0] });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/proveedores/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol no puede editar' });
    const antes = (await query('SELECT * FROM proveedores WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    const sets = [], vals = []; let i = 1;
    for (const k of PROVFIELDS) if (k in (req.body || {})) { sets.push(`${k}=$${i++}`); vals.push(req.body[k] === '' ? null : req.body[k]); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    vals.push(req.params.id, T);
    const r = await query(`UPDATE proveedores SET ${sets.join(', ')} WHERE id=$${i++} AND tenant_id=$${i} RETURNING *`, vals);
    await audit(req, { accion: 'editar_proveedor', entidad: 'proveedor', entidad_id: antes.id, antes, despues: r.rows[0] });
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/proveedores/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!can(req, 'WRITE')) return res.status(403).json({ error: 'Tu rol no puede editar' });
    const antes = (await query('SELECT * FROM proveedores WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!antes) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM proveedores WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_proveedor', entidad: 'proveedor', entidad_id: req.params.id, antes });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- correo a proveedor (confirmación de pago) ----------
// SMTP queda listo: con SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM en Railway manda directo.
// Sin configurar responde 501 con el payload para que el front abra el cliente de correo (mailto).
function smtpReady() { return !!(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS); }
async function armarCorreoPago(T, hitoId) {
  const h = (await query(`SELECT hp.*, pr.nombre AS proveedor_nombre, pr.email AS proveedor_email, pr.contacto AS proveedor_contacto, o.nombre AS obra_nombre
    FROM hitos_pago hp LEFT JOIN proveedores pr ON pr.id=hp.proveedor_id JOIN proyectos o ON o.id=hp.obra_id
    WHERE hp.id=$1 AND hp.tenant_id=$2`, [hitoId, T])).rows[0];
  if (!h) return { err: [404, 'Hito de pago no encontrado'] };
  if (!h.proveedor_id) return { err: [400, 'El hito no tiene proveedor asignado'] };
  if (!h.proveedor_email) return { err: [400, `El proveedor ${h.proveedor_nombre} no tiene correo cargado`] };
  const monto = N(h.porcentaje) / 100 * (await hpCostoObra(T, h.obra_id));
  const fmt = (v) => 'Bs ' + Math.round(v).toLocaleString('es-BO');
  const subject = `Confirmación de pago · ${h.obra_nombre} · ${h.nombre || 'Hito'}`;
  const body = `Estimados ${h.proveedor_contacto || h.proveedor_nombre}:\n\n` +
    `Confirmamos el pago correspondiente al hito «${h.nombre || 'Hito'}» (${+N(h.porcentaje).toFixed(2)}% del costo directo) ` +
    `de la obra ${h.obra_nombre}, por un monto de ${fmt(monto)}.\n\n` +
    `Cualquier consulta sobre este pago, respondan a este correo.\n\nSaludos,\nOrigina Group`;
  return { h, subject, body };
}
app.post('/api/hitos-pago/:id/correo', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const { err, h, subject, body } = await armarCorreoPago(T, req.params.id);
    if (err) return res.status(err[0]).json({ error: err[1] });
    if (!smtpReady()) {
      return res.status(501).json({ error: 'SMTP no configurado en el servidor', mailto: { to: h.proveedor_email, subject, body } });
    }
    const nodemailer = require('nodemailer');
    const tr = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port: +process.env.SMTP_PORT,
      secure: +process.env.SMTP_PORT === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await tr.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to: h.proveedor_email, subject, text: body });
    await audit(req, { accion: 'correo_pago', entidad: 'hito_pago', entidad_id: h.id, despues: { obra_id: h.obra_id }, detalle: `a ${h.proveedor_nombre} <${h.proveedor_email}>` });
    res.json({ ok: true, enviado_a: h.proveedor_email });
  } catch (e) { res.status(502).json({ error: 'No se pudo enviar: ' + e.message }); }
});

// ---------- versiones ----------
app.get('/api/proyectos/:id/versiones', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const r = await query('SELECT id,version,nota,autor,creado_en FROM versiones WHERE proyecto_id=$1 AND tenant_id=$2 ORDER BY creado_en DESC', [req.params.id, T]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/proyectos/:id/versiones', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const snap = await getProyecto(req.params.id, T);
    if (!snap) return res.status(404).json({ error: 'No encontrado' });
    const m = (snap.version || 'V.01').match(/(\d+)/);
    const next = 'V.' + String((m ? parseInt(m[1]) : 0) + 1).padStart(2, '0');
    await query('UPDATE proyectos SET version=$1 WHERE id=$2 AND tenant_id=$3', [next, req.params.id, T]);
    const autor = actor(req);
    const r = await query('INSERT INTO versiones(tenant_id,proyecto_id,version,nota,autor,snapshot) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,version,nota,autor,creado_en',
      [T, req.params.id, next, (req.body || {}).nota || null, autor, JSON.stringify(snap)]);
    await audit(req, { accion: 'guardar_version', entidad: snap.tipo, entidad_id: snap.id, detalle: next });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- flujo (scopeado a la organización) ----------
app.get('/api/flujo', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const proyectos = (await query("SELECT * FROM proyectos WHERE tipo='proyecto' AND tenant_id=$1", [T])).rows;
    const obras = (await query("SELECT * FROM proyectos WHERE tipo='obra' AND tenant_id=$1", [T])).rows;
    const ents = (await query('SELECT * FROM entregables WHERE tenant_id=$1', [T])).rows;
    const parts = (await query('SELECT pa.*, c.proyecto_id FROM partidas pa JOIN capitulos c ON c.id=pa.capitulo_id WHERE pa.tenant_id=$1', [T])).rows;
    const hitosAll = (await query('SELECT * FROM hitos_cobro WHERE tenant_id=$1', [T])).rows;
    const hitosPagoAll = (await query('SELECT hp.*, pr.nombre AS proveedor_nombre FROM hitos_pago hp LEFT JOIN proveedores pr ON pr.id=hp.proveedor_id WHERE hp.tenant_id=$1', [T])).rows;
    const niv = { teorico: { por_cobrar: 0, por_pagar: 0 }, efectivo: { por_cobrar: 0, comprometido: 0 }, banco: { cobrado: 0, pagado: 0 } };
    const trans = [];
    const tpush = (nivel, lado, tipo, proyecto_id, ptipo, nombre, detalle, monto) => { if (monto > 0) trans.push({ nivel, lado, tipo, proyecto_id, ptipo, nombre, detalle, monto }); };
    const pf = [];
    for (const p of proyectos) {
      let precio = 0, costo = 0;
      ents.filter((e) => e.proyecto_id === p.id).forEach((e) => { precio += N(e.precio); costo += N(e.costo); });
      const ec = p.estado_cobro || 'cotizado', eo = p.estado_costo || 'presupuestado';
      const hsP = hitosAll.filter((h) => h.obra_id === p.id);
      if (hsP.length) {
        hsP.forEach((h) => {
          const m = N(h.porcentaje) / 100 * precio;
          const det = `Hito «${h.nombre || 'Hito'}» · ${+(+N(h.porcentaje)).toFixed(2)}% del precio`;
          if (h.estado === 'cobrado') { niv.banco.cobrado += m; tpush('banco', 'entrada', 'hito', p.id, 'proyecto', p.nombre, det + ' · cobrado', m); }
          else if (h.estado === 'facturado') { niv.efectivo.por_cobrar += m; tpush('efectivo', 'entrada', 'hito', p.id, 'proyecto', p.nombre, det + ' · facturado, esperando pago', m); }
          else { niv.teorico.por_cobrar += m; tpush('teorico', 'entrada', 'hito', p.id, 'proyecto', p.nombre, det + ' · pendiente', m); }
        });
      } else if (ec === 'cotizado') { niv.teorico.por_cobrar += precio; tpush('teorico', 'entrada', 'diseno', p.id, 'proyecto', p.nombre, 'estado de cobro «cotizado» · precio de entregables', precio); }
      else if (ec === 'facturado') { niv.efectivo.por_cobrar += precio; tpush('efectivo', 'entrada', 'diseno', p.id, 'proyecto', p.nombre, 'estado de cobro «facturado» · esperando pago', precio); }
      else if (ec === 'cobrado') { niv.banco.cobrado += precio; tpush('banco', 'entrada', 'diseno', p.id, 'proyecto', p.nombre, 'estado de cobro «cobrado»', precio); }
      const hpP = hitosPagoAll.filter((h) => h.obra_id === p.id);
      if (hpP.length) {
        hpP.forEach((h) => {
          const m = N(h.porcentaje) / 100 * costo;
          const det = `Hito de pago «${h.nombre || 'Hito'}» · ${+(+N(h.porcentaje)).toFixed(2)}% del costo` + (h.proveedor_nombre ? ` · ${h.proveedor_nombre}` : '');
          if (h.estado === 'pagado') { niv.banco.pagado += m; tpush('banco', 'salida', 'hito_pago', p.id, 'proyecto', p.nombre, det + ' · pagado', m); }
          else if (h.estado === 'transferencia_solicitada') { niv.efectivo.comprometido += m; tpush('efectivo', 'salida', 'hito_pago', p.id, 'proyecto', p.nombre, det + ' · transferencia solicitada', m); }
          else if (h.estado === 'facturado') { niv.efectivo.comprometido += m; tpush('efectivo', 'salida', 'hito_pago', p.id, 'proyecto', p.nombre, det + ' · factura recibida, pago pendiente', m); }
          else { niv.teorico.por_pagar += m; tpush('teorico', 'salida', 'hito_pago', p.id, 'proyecto', p.nombre, det + ' · pendiente', m); }
        });
      } else if (eo === 'presupuestado') { niv.teorico.por_pagar += costo; tpush('teorico', 'salida', 'diseno', p.id, 'proyecto', p.nombre, 'estado de costo «presupuestado» · costo de entregables', costo); }
      else if (eo === 'comprometido') { niv.efectivo.comprometido += costo; tpush('efectivo', 'salida', 'diseno', p.id, 'proyecto', p.nombre, 'estado de costo «comprometido» · factura recibida', costo); }
      else if (eo === 'pagado') { niv.banco.pagado += costo; tpush('banco', 'salida', 'diseno', p.id, 'proyecto', p.nombre, 'estado de costo «pagado»', costo); }
      pf.push({ id: p.id, nombre: p.nombre, precio, costo, estado_cobro: ec, estado_costo: eo, hitos: hsP.length, hitos_pago: hpP.length });
    }
    const of = [];
    for (const o of obras) {
      const f = { gg: o.gg, utilidad: o.utilidad, it: o.it };
      let costo = 0, venta = 0;
      parts.filter((x) => x.proyecto_id === o.id).forEach((pa) => { const r = calcPartida(pa, f); costo += r.costo; venta += r.venta; });
      const neto = venta - N(o.credito_diseno);
      const hs = hitosAll.filter((h) => h.obra_id === o.id);
      if (hs.length) {
        hs.forEach((h) => {
          const m = N(h.porcentaje) / 100 * neto;
          const det = `Hito «${h.nombre || 'Hito'}» · ${+(+N(h.porcentaje)).toFixed(2)}% del neto`;
          if (h.estado === 'cobrado') { niv.banco.cobrado += m; tpush('banco', 'entrada', 'hito', o.id, 'obra', o.nombre, det + ' · cobrado', m); }
          else if (h.estado === 'facturado') { niv.efectivo.por_cobrar += m; tpush('efectivo', 'entrada', 'hito', o.id, 'obra', o.nombre, det + ' · facturado, esperando pago', m); }
          else { niv.teorico.por_cobrar += m; tpush('teorico', 'entrada', 'hito', o.id, 'obra', o.nombre, det + ' · pendiente', m); }
        });
      } else {
        niv.teorico.por_cobrar += neto;
        tpush('teorico', 'entrada', 'obra', o.id, 'obra', o.nombre, 'sin hitos cargados → entra el 100% del neto', neto);
      }
      const hp = hitosPagoAll.filter((h) => h.obra_id === o.id);
      if (hp.length) {
        hp.forEach((h) => {
          const m = N(h.porcentaje) / 100 * costo;
          const det = `Hito de pago «${h.nombre || 'Hito'}» · ${+(+N(h.porcentaje)).toFixed(2)}% del costo` + (h.proveedor_nombre ? ` · ${h.proveedor_nombre}` : '');
          if (h.estado === 'pagado') { niv.banco.pagado += m; tpush('banco', 'salida', 'hito_pago', o.id, 'obra', o.nombre, det + ' · pagado', m); }
          else if (h.estado === 'transferencia_solicitada') { niv.efectivo.comprometido += m; tpush('efectivo', 'salida', 'hito_pago', o.id, 'obra', o.nombre, det + ' · transferencia solicitada', m); }
          else if (h.estado === 'facturado') { niv.efectivo.comprometido += m; tpush('efectivo', 'salida', 'hito_pago', o.id, 'obra', o.nombre, det + ' · factura recibida, pago pendiente', m); }
          else { niv.teorico.por_pagar += m; tpush('teorico', 'salida', 'hito_pago', o.id, 'obra', o.nombre, det + ' · pendiente', m); }
        });
      } else {
        niv.teorico.por_pagar += costo;
        tpush('teorico', 'salida', 'obra_costo', o.id, 'obra', o.nombre, 'sin hitos de pago → 100% del costo en teórico', costo);
      }
      of.push({ id: o.id, nombre: o.nombre, venta, costo, neto, hitos: hs.length, hitos_pago: hp.length });
    }
    res.json({ niveles: niv, trans, proyectos: pf, obras: of, nota: 'Proyectos (diseño) se mueven por estado de cobro y de costo. Las obras se reparten por hitos de cobro; el costo agregado va al teórico.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- Asistente IA ----------
const APP_MAP = {
  Flujo: 'Pestaña Flujo (barra lateral). Indicadores como filas-ecuación (Neto teórico = contratos firmados − costos presupuestados · Neto facturado = facturas emitidas por cobrar − facturas de proveedores por pagar · Saldo en bancos = cobros acreditados − pagos ejecutados · Saldo proyectado = suma), gráfico de proyección de caja y tablas por proyecto y obra.',
  Detalle_Flujo: 'Pestaña Detalle Flujo (barra lateral). Reflejo vivo del sistema: cada transacción que suma o resta a los cuatro indicadores, con su regla, monto y link al proyecto/obra. Ahí se ve por qué cada número del Flujo da lo que da.',
  Proveedores: 'Pestaña Proveedores (barra lateral). Catálogo de proveedores (nombre, correo, NIT, razón social, teléfono, contacto, rubro, notas). Se asignan a hitos de pago en cada obra (vista costo) y desde ahí se envían confirmaciones de pago por correo.',
  Proyectos: 'Pestaña Proyectos (barra lateral). Lista de proyectos de diseño. Al abrir uno: entregables (costo/precio/margen), precio total, Flujo del proyecto (estado de cobro y de costo), documentos compactos en el encabezado (Cotización, PDF del diseño, Anexos) y botón Generar obra / Ir a obra.',
  Obras: 'Pestaña Obras (barra lateral). Lista de obras de ejecución. Al abrir una: factores GG/Utilidad/IT/TC, toggle Costo directo vs Precio de venta, partidas por capítulo, hitos de cobro en vista venta e hitos de pago a proveedores en vista costo (con %, monto, fecha, estado y proveedor), historial de la obra al final, y documentos en el encabezado.',
  Sistema: 'Pestaña Sistema (barra lateral). Gestión de usuarios y roles (solo admin), organizaciones (solo super-admin con llave maestra), snapshots de respaldo y registro de auditoría con el detalle antes→después.',
  Documentos: 'Los documentos se cargan dentro de cada proyecto u obra, en el encabezado, en las tres categorías con el botón +. Se ven con Ver, se cambian con Reemplazar.',
  Estados_cobro: 'cotizado (Teórico) → facturado (Por cobrar/Efectivo) → cobrado (Banco). Cambiar el estado o mover un hito requiere rol aprobador o admin.',
  Estados_costo: 'presupuestado (Teórico) → comprometido (Por pagar/Efectivo) → pagado (Banco).',
};
function audLinea(a) {
  const verbo = HIST_VERBOS[a.accion] || (a.accion + ' ' + (a.entidad || '')).trim();
  const nombre = histNombre(a.antes) || histNombre(a.despues) || '';
  const diff = a.accion && /^editar/.test(a.accion) ? histDiff(a.antes, a.despues) : '';
  let fecha = '';
  try { fecha = new Date(a.creado_en).toLocaleString('sv-SE', { timeZone: 'America/La_Paz' }).slice(0, 16); } catch (e) { fecha = String(a.creado_en).slice(0, 16); }
  return {
    fecha, usuario: a.usuario || '—',
    accion: verbo + (nombre ? ` «${String(nombre).slice(0, 60)}»` : '') + (diff ? ` — ${diff}` : '') + (a.detalle && !nombre ? ` (${String(a.detalle).slice(0, 80)})` : ''),
    entidad: a.entidad || null,
  };
}
async function buildAssistantContext(T, orgNombre) {
  const hoy = new Date().toISOString().slice(0, 10);
  const proyectos = (await query("SELECT * FROM proyectos WHERE tipo='proyecto' AND tenant_id=$1", [T])).rows;
  const obras = (await query("SELECT * FROM proyectos WHERE tipo='obra' AND tenant_id=$1", [T])).rows;
  const ents = (await query('SELECT * FROM entregables WHERE tenant_id=$1', [T])).rows;
  const parts = (await query('SELECT pa.*, c.proyecto_id, c.nombre AS capitulo FROM partidas pa JOIN capitulos c ON c.id=pa.capitulo_id WHERE pa.tenant_id=$1', [T])).rows;
  const hitosAll = (await query('SELECT * FROM hitos_cobro WHERE tenant_id=$1', [T])).rows;
  const docs = (await query('SELECT d.categoria,d.nombre,d.creado_en,d.proyecto_id,p.nombre AS proyecto FROM documentos d JOIN proyectos p ON p.id=d.proyecto_id WHERE d.tenant_id=$1 ORDER BY d.proyecto_id,d.categoria', [T])).rows;
  const equipo = (await query('SELECT nombre,rol FROM usuarios WHERE tenant_id=$1 AND activo=true ORDER BY nombre', [T])).rows;
  const tareasRows = (await query("SELECT t.id,t.titulo,t.estado,t.prioridad,t.vence_el,ua.nombre AS asignado,p.nombre AS proyecto FROM tareas t LEFT JOIN usuarios ua ON ua.id=t.asignado_a LEFT JOIN proyectos p ON p.id=t.proyecto_id WHERE t.tenant_id=$1 ORDER BY (t.estado='hecha'), COALESCE(t.vence_el,'9999-12-31'), t.creado_en DESC LIMIT 80", [T])).rows;
  const hitosPagoAll = (await query('SELECT hp.*, pr.nombre AS proveedor_nombre FROM hitos_pago hp LEFT JOIN proveedores pr ON pr.id=hp.proveedor_id WHERE hp.tenant_id=$1', [T])).rows;
  const provs = (await query('SELECT nombre,email,rubro,contacto,activo FROM proveedores WHERE tenant_id=$1 ORDER BY activo DESC, lower(nombre)', [T])).rows;
  const audRows = (await query('SELECT usuario,accion,entidad,entidad_id,antes,despues,detalle,creado_en FROM auditoria WHERE tenant_id=$1 ORDER BY creado_en DESC LIMIT 120', [T])).rows;
  const bitaRows = (await query(`SELECT b.autor,b.nota,b.creado_en,pa.descripcion AS partida,o.nombre AS obra FROM partida_bitacora b LEFT JOIN partidas pa ON pa.id=b.partida_id LEFT JOIN proyectos o ON o.id=b.proyecto_id WHERE b.tenant_id=$1 AND b.nota IS NOT NULL ORDER BY b.creado_en DESC LIMIT 40`, [T])).rows;
  const niv = { teorico: { por_cobrar: 0, por_pagar: 0 }, efectivo: { por_cobrar: 0, comprometido: 0 }, banco: { cobrado: 0, pagado: 0 } };
  const eventos = [], sinFecha = [];
  const P = [];
  for (const p of proyectos) {
    let precio = 0, costo = 0;
    ents.filter((e) => e.proyecto_id === p.id).forEach((e) => { precio += N(e.precio); costo += N(e.costo); });
    const ec = p.estado_cobro || 'cotizado', eo = p.estado_costo || 'presupuestado';
    const hsPx = hitosAll.filter((h) => h.obra_id === p.id);
    if (hsPx.length) {
      hsPx.forEach((h) => {
        const m = N(h.porcentaje) / 100 * precio, fecha = isoDate(h.fecha);
        if (h.estado === 'cobrado') niv.banco.cobrado += m;
        else if (h.estado === 'facturado') { niv.efectivo.por_cobrar += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: p.nombre + ' · ' + (h.nombre || 'hito') + ' (por cobrar)', tipo: 'ingreso', monto: round2(m) }); }
        else { niv.teorico.por_cobrar += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: p.nombre + ' · ' + (h.nombre || 'hito') + ' (hito pendiente)', tipo: 'ingreso', monto: round2(m) }); }
      });
    } else if (ec === 'cotizado') niv.teorico.por_cobrar += precio; else if (ec === 'facturado') { niv.efectivo.por_cobrar += precio; sinFecha.push({ concepto: p.nombre + ' (diseño, facturado)', tipo: 'ingreso', monto: round2(precio) }); } else if (ec === 'cobrado') niv.banco.cobrado += precio;
    const hpPx = hitosPagoAll.filter((h) => h.obra_id === p.id);
    if (hpPx.length) {
      hpPx.forEach((h) => {
        const m = N(h.porcentaje) / 100 * costo, fecha = isoDate(h.fecha);
        const quien = h.proveedor_nombre ? ' a ' + h.proveedor_nombre : '';
        if (h.estado === 'pagado') niv.banco.pagado += m;
        else if (h.estado === 'transferencia_solicitada') { niv.efectivo.comprometido += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: p.nombre + ' · pago ' + (h.nombre || 'hito') + quien + ' (transferencia solicitada)', tipo: 'egreso', monto: round2(m) }); }
        else if (h.estado === 'facturado') { niv.efectivo.comprometido += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: p.nombre + ' · pago ' + (h.nombre || 'hito') + quien + ' (factura recibida)', tipo: 'egreso', monto: round2(m) }); }
        else { niv.teorico.por_pagar += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: p.nombre + ' · pago ' + (h.nombre || 'hito') + quien + ' (pendiente)', tipo: 'egreso', monto: round2(m) }); }
      });
    } else if (eo === 'presupuestado') niv.teorico.por_pagar += costo; else if (eo === 'comprometido') { niv.efectivo.comprometido += costo; sinFecha.push({ concepto: p.nombre + ' (diseño, costo comprometido)', tipo: 'egreso', monto: round2(costo) }); } else if (eo === 'pagado') niv.banco.pagado += costo;
    P.push({ nombre: p.nombre, cliente: p.cliente || null, estado: p.estado, estado_cobro: ec, estado_costo: eo, costo: round2(costo), precio: round2(precio) });
  }
  const O = [];
  for (const o of obras) {
    const f = { gg: o.gg, utilidad: o.utilidad, it: o.it };
    let costo = 0, venta = 0;
    parts.filter((x) => x.proyecto_id === o.id).forEach((pa) => { const r = calcPartida(pa, f); costo += r.costo; venta += r.venta; });
    const neto = venta - N(o.credito_diseno);
    const hs = hitosAll.filter((h) => h.obra_id === o.id).sort((a, b) => N(a.orden) - N(b.orden));
    const hitosOut = hs.map((h) => {
      const m = N(h.porcentaje) / 100 * neto, fecha = isoDate(h.fecha);
      if (h.estado === 'cobrado') niv.banco.cobrado += m;
      else if (h.estado === 'facturado') { niv.efectivo.por_cobrar += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: o.nombre + ' · ' + h.nombre + ' (por cobrar)', tipo: 'ingreso', monto: round2(m) }); }
      else { niv.teorico.por_cobrar += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: o.nombre + ' · ' + h.nombre + ' (hito pendiente)', tipo: 'ingreso', monto: round2(m) }); }
      return { nombre: h.nombre, porcentaje: N(h.porcentaje), monto: round2(m), fecha, estado: h.estado || 'pendiente' };
    });
    if (!hs.length) niv.teorico.por_cobrar += neto;
    const hsp = hitosPagoAll.filter((h) => h.obra_id === o.id).sort((a, b) => N(a.orden) - N(b.orden));
    const hitosPagoOut = hsp.map((h) => {
      const m = N(h.porcentaje) / 100 * costo, fecha = isoDate(h.fecha);
      const quien = h.proveedor_nombre ? ' a ' + h.proveedor_nombre : '';
      if (h.estado === 'pagado') niv.banco.pagado += m;
      else if (h.estado === 'transferencia_solicitada') { niv.efectivo.comprometido += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: o.nombre + ' · pago ' + (h.nombre || 'hito') + quien + ' (transferencia solicitada)', tipo: 'egreso', monto: round2(m) }); }
      else if (h.estado === 'facturado') { niv.efectivo.comprometido += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: o.nombre + ' · pago ' + (h.nombre || 'hito') + quien + ' (factura recibida)', tipo: 'egreso', monto: round2(m) }); }
      else { niv.teorico.por_pagar += m; (fecha ? eventos : sinFecha).push({ fecha, concepto: o.nombre + ' · pago ' + (h.nombre || 'hito') + quien + ' (pendiente)', tipo: 'egreso', monto: round2(m) }); }
      return { nombre: h.nombre, porcentaje: N(h.porcentaje), monto: round2(m), fecha, estado: h.estado || 'pendiente', proveedor: h.proveedor_nombre || null };
    });
    if (!hsp.length) niv.teorico.por_pagar += costo;
    const obraParts = parts.filter((x) => x.proyecto_id === o.id);
    let _ap2 = 0, _ah2 = 0, _at2 = 0, _ad2 = 0;
    obraParts.forEach((pa) => { const w = N(pa.cantidad) * N(pa.pu_costo); _ap2 += w; _at2++; if (pa.completada) { _ah2 += w; _ad2++; } });
    const avanceCalc = _ap2 > 0 ? Math.round(_ah2 / _ap2 * 100) : (_at2 ? Math.round(_ad2 / _at2 * 100) : 0);
    const trabajos = obraParts.map((pa) => { const r = calcPartida(pa, f); return { descripcion: pa.descripcion, capitulo: pa.capitulo || null, unidad: pa.unidad, cantidad: N(pa.cantidad), completada: !!pa.completada, costo: round2(r.costo), venta: round2(r.venta) }; }).sort((a, b) => b.costo - a.costo).slice(0, 60);
    O.push({ nombre: o.nombre, cliente: o.cliente || null, estado: o.estado, avance: avanceCalc, superficie: o.superficie ? N(o.superficie) : null, costo: round2(costo), venta: round2(venta), credito_diseno: round2(N(o.credito_diseno)), neto: round2(neto), hitos: hitosOut, hitos_pago: hitosPagoOut, trabajos });
  }
  // proyección de caja: saldo real hoy + eventos con fecha (acumulado)
  const saldoActual = round2(niv.banco.cobrado - niv.banco.pagado);
  eventos.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  let acum = saldoActual;
  eventos.forEach((ev) => { acum += (ev.tipo === 'ingreso' ? ev.monto : -ev.monto); ev.saldo_proyectado = round2(acum); });
  return {
    hoy, organizacion: orgNombre,
    moneda: 'Bs (boliviano)',
    resumen_flujo: {
      saldo_banco_hoy: saldoActual,
      total_por_cobrar: round2(niv.teorico.por_cobrar + niv.efectivo.por_cobrar),
      total_por_pagar: round2(niv.teorico.por_pagar + niv.efectivo.comprometido),
      niveles: { teorico: { por_cobrar: round2(niv.teorico.por_cobrar), por_pagar: round2(niv.teorico.por_pagar) }, efectivo: { por_cobrar: round2(niv.efectivo.por_cobrar), comprometido: round2(niv.efectivo.comprometido) }, banco: { cobrado: round2(niv.banco.cobrado), pagado: round2(niv.banco.pagado) } },
    },
    proyectos: P, obras: O,
    proveedores: provs,
    actividad_reciente: audRows.map(audLinea),
    bitacora_reciente: bitaRows.map((b) => ({ fecha: isoDate(b.creado_en), autor: b.autor, obra: b.obra || null, partida: b.partida || null, nota: String(b.nota || '').slice(0, 160) })),
    documentos: docs.map((d) => ({ proyecto: d.proyecto, categoria: d.categoria, nombre: d.nombre, fecha: isoDate(d.creado_en) })),
    equipo: equipo.map((u) => ({ nombre: u.nombre, rol: u.rol })),
    tareas: tareasRows.map((t) => ({ id: t.id, titulo: t.titulo, estado: t.estado, prioridad: t.prioridad, vence: isoDate(t.vence_el), asignado_a: t.asignado || null, proyecto: t.proyecto || null })),
    proyeccion_caja: {
      saldo_actual: saldoActual,
      eventos,
      sin_fecha: sinFecha,
      nota: 'eventos: cobros futuros con fecha (de hitos), ordenados, con saldo_proyectado acumulado partiendo del saldo de banco de hoy. Para "cuánto efectivo a la fecha X" tomá el saldo_proyectado del último evento con fecha <= X. Los egresos con fecha salen de los hitos de pago a proveedores; los costos sin hitos de pago van en sin_fecha. Aclaralo si la pregunta depende de pagos.',
    },
    navegacion: APP_MAP,
  };
}
function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function isoDate(v) { if (!v) return null; if (v instanceof Date) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0'); return String(v).slice(0, 10); }
// precios Gemini por 1M de tokens (USD, contexto ≤200k). Override por env GEMINI_PRICE_IN/OUT. Los tokens de "thinking" se facturan como output.
const IA_PRICES = { 'gemini-2.5-flash': { in: 0.30, out: 2.50 }, 'gemini-2.5-flash-lite': { in: 0.10, out: 0.40 }, 'gemini-2.5-pro': { in: 1.25, out: 10.00 } };
function iaPrice(model) { const t = IA_PRICES[model] || IA_PRICES['gemini-2.5-flash']; return { in: process.env.GEMINI_PRICE_IN ? parseFloat(process.env.GEMINI_PRICE_IN) : t.in, out: process.env.GEMINI_PRICE_OUT ? parseFloat(process.env.GEMINI_PRICE_OUT) : t.out }; }
function iaCost(model, tokensIn, tokensOutBilled) { const p = iaPrice(model); return (tokensIn / 1e6) * p.in + (tokensOutBilled / 1e6) * p.out; }
async function recordIaUso(T, usuario, model, usage) {
  try {
    const billedOut = (usage.tokens_out || 0) + (usage.tokens_think || 0);
    const costo = iaCost(model, usage.tokens_in || 0, billedOut);
    await query('INSERT INTO ia_uso(tenant_id,usuario,modelo,tokens_in,tokens_out,tokens_think,tokens_total,costo_usd) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [T, usuario, model, usage.tokens_in || 0, usage.tokens_out || 0, usage.tokens_think || 0, usage.tokens_total || 0, costo]);
  } catch (e) { console.warn('[ia_uso] no se registró:', e.message); }
}
// herramienta de cotización (function calling)
const COTIZA_TOOL = { functionDeclarations: [{
  name: 'generar_cotizacion',
  description: 'Genera una cotización de un proyecto de diseño cuando el usuario pide cotizar o presupuestar. Estimá los entregables/fases con su costo y precio en bolivianos (Bs), usando los proyectos anteriores del estudio (en el JSON) como referencia de precios reales. Es una estimación base, editable.',
  parameters: { type: 'OBJECT', properties: {
    nombre: { type: 'STRING', description: 'Nombre del proyecto a cotizar' },
    cliente: { type: 'STRING', description: 'Cliente, si se conoce' },
    entregables: { type: 'ARRAY', description: 'Entregables/fases con costo y precio estimados en Bs', items: { type: 'OBJECT', properties: { nombre: { type: 'STRING' }, costo: { type: 'NUMBER' }, precio: { type: 'NUMBER' } }, required: ['nombre', 'precio'] } },
    notas: { type: 'STRING', description: 'Supuestos y aclaraciones de la estimación (en qué se basó, qué no incluye)' },
  }, required: ['nombre', 'entregables'] },
}] };
// herramienta de tareas (function calling) — crear tarea con confirmación
const CREAR_TAREA_DECL = {
  name: 'crear_tarea',
  description: 'Crea una tarea para el estudio cuando el usuario lo pide (ej. "creá una tarea para Paula de pedir la factura, vence el viernes"). El sistema le pedirá confirmación antes de guardarla.',
  parameters: { type: 'OBJECT', properties: {
    titulo: { type: 'STRING', description: 'Título corto y accionable' },
    detalle: { type: 'STRING', description: 'Detalle/contexto, opcional' },
    asignado_a: { type: 'STRING', description: 'Nombre de la persona del equipo (usá los nombres del campo equipo del JSON). Vacío si no se especifica.' },
    prioridad: { type: 'STRING', description: 'baja, media o alta', enum: ['baja', 'media', 'alta'] },
    vence_el: { type: 'STRING', description: 'Fecha de vencimiento YYYY-MM-DD, si corresponde' },
    proyecto: { type: 'STRING', description: 'Nombre del proyecto u obra a ligar (nombres reales del JSON). Vacío si es suelta.' },
  }, required: ['titulo'] },
};
const ASSISTANT_TOOLS = { functionDeclarations: [...COTIZA_TOOL.functionDeclarations, CREAR_TAREA_DECL] };
async function buildCotizacionXlsx(cot, tc) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Origina · Control Financiero'; wb.created = new Date();
  const ws = wb.addWorksheet('Cotización');
  ws.columns = [{ width: 48 }, { width: 16 }, { width: 16 }, { width: 12 }];
  ws.mergeCells('A1:D1'); const t = ws.getCell('A1'); t.value = 'COTIZACIÓN'; t.font = { bold: true, size: 16 };
  ws.mergeCells('A2:D2'); const n = ws.getCell('A2'); n.value = cot.nombre; n.font = { bold: true, size: 13 };
  ws.getCell('A3').value = 'Cliente'; ws.getCell('A3').font = { color: { argb: 'FF8A8A8A' } }; ws.getCell('B3').value = cot.cliente || '—';
  ws.getCell('A4').value = 'Fecha'; ws.getCell('A4').font = { color: { argb: 'FF8A8A8A' } }; ws.getCell('B4').value = new Date().toISOString().slice(0, 10);
  ws.getCell('A5').value = 'TC Bs/US$'; ws.getCell('A5').font = { color: { argb: 'FF8A8A8A' } }; ws.getCell('B5').value = tc;
  const h = ws.getRow(7); h.values = ['Entregable', 'Costo Bs', 'Precio Bs', 'Margen %']; h.font = { bold: true };
  h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDE7DA' } }; c.border = { bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } } }; });
  let r = 8; const first = r;
  (cot.entregables || []).forEach((e) => {
    const row = ws.getRow(r);
    row.getCell(1).value = e.nombre;
    row.getCell(2).value = Number(e.costo) || 0;
    row.getCell(3).value = Number(e.precio) || 0;
    row.getCell(4).value = { formula: `IF(C${r}=0,0,(C${r}-B${r})/C${r})` };
    row.getCell(2).numFmt = '#,##0'; row.getCell(3).numFmt = '#,##0'; row.getCell(4).numFmt = '0.0%';
    r++;
  });
  const last = r - 1;
  const tot = ws.getRow(r);
  tot.getCell(1).value = 'TOTAL DISEÑO'; tot.getCell(1).font = { bold: true };
  tot.getCell(2).value = { formula: `SUM(B${first}:B${last})` }; tot.getCell(2).numFmt = '#,##0'; tot.getCell(2).font = { bold: true };
  tot.getCell(3).value = { formula: `SUM(C${first}:C${last})` }; tot.getCell(3).numFmt = '#,##0'; tot.getCell(3).font = { bold: true };
  tot.getCell(4).value = { formula: `IF(C${r}=0,0,(C${r}-B${r})/C${r})` }; tot.getCell(4).numFmt = '0.0%'; tot.getCell(4).font = { bold: true };
  tot.eachCell((c) => { c.border = { top: { style: 'double', color: { argb: 'FF888888' } } }; });
  ws.getCell(`A${r + 2}`).value = 'Precio total US$'; ws.getCell(`A${r + 2}`).font = { bold: true };
  ws.getCell(`B${r + 2}`).value = { formula: `IF(B5=0,0,C${r}/B5)` }; ws.getCell(`B${r + 2}`).numFmt = '#,##0.00'; ws.getCell(`B${r + 2}`).font = { bold: true };
  if (cot.notas) { ws.getCell(`A${r + 4}`).value = 'Notas / supuestos'; ws.getCell(`A${r + 4}`).font = { bold: true }; ws.mergeCells(`A${r + 5}:D${r + 9}`); const nc = ws.getCell(`A${r + 5}`); nc.value = cot.notas; nc.alignment = { wrapText: true, vertical: 'top' }; }
  const buf = await wb.xlsx.writeBuffer();
  const slug = (cot.nombre || 'proyecto').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'proyecto';
  return { base64: Buffer.from(buf).toString('base64'), filename: `cotizacion-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx` };
}
async function geminiAsk(system, contextStr, pregunta, historial, tools) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const contents = [];
  (historial || []).slice(-8).forEach((m) => { if (m && m.text) contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.text).slice(0, 4000) }] }); });
  contents.push({ role: 'user', parts: [{ text: 'ESTADO ACTUAL DEL ESTUDIO (JSON):\n' + contextStr + '\n\nPREGUNTA DEL USUARIO:\n' + pregunta }] });
  const body = { systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { temperature: 0.4, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 2048 } } };
  if (tools) body.tools = [tools];
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); throw new Error('Gemini ' + r.status + ': ' + t.slice(0, 200)); }
  const data = await r.json();
  const cand = (data.candidates && data.candidates[0]) || null;
  const um = data.usageMetadata || {};
  const usage = { tokens_in: um.promptTokenCount || 0, tokens_out: um.candidatesTokenCount || 0, tokens_think: um.thoughtsTokenCount || 0, tokens_total: um.totalTokenCount || 0 };
  if (!usage.tokens_total) usage.tokens_total = usage.tokens_in + usage.tokens_out + usage.tokens_think;
  let out = '', fcall = null;
  if (cand && cand.content && Array.isArray(cand.content.parts)) {
    for (const p of cand.content.parts) { if (p.functionCall) fcall = p.functionCall; else if (typeof p.text === 'string') out += p.text; }
    out = out.trim();
  }
  if (!out && !fcall) {
    const fr = cand && cand.finishReason, blk = data.promptFeedback && data.promptFeedback.blockReason;
    console.warn('[asistente] respuesta vacía · finishReason=' + fr + ' block=' + blk);
    if (fr === 'MAX_TOKENS') out = 'Me quedé sin espacio para responder. Probá una pregunta un poco más acotada.';
    else if (blk) out = 'No puedo responder eso por las políticas del modelo.';
    else out = 'No pude generar una respuesta. Reformulá la pregunta y probá de nuevo.';
  }
  return { text: out, functionCall: fcall, usage, model };
}
const ASSISTANT_SYS = `Sos el asistente de Origina, una app de gestión financiera para un estudio de arquitectura en Bolivia. Hablás español rioplatense (vos), con tono claro, cálido y profesional, como un colega que conoce los números del estudio. Conciso pero no seco: si suma, agregá una observación útil.

Tenés en el contexto "actividad_reciente": las últimas acciones de los usuarios en la app (quién creó/editó/eliminó qué, con el detalle antes → después, hitos de pago, proveedores, correos de confirmación). Usala para responder preguntas tipo «quién cambió X», «quién registró pagos o facturas», «qué hizo tal usuario», con nombres, fechas y montos concretos. También tenés "bitacora_reciente" (notas de obra por partida con autor) y, dentro de cada obra, "hitos_pago" con proveedor y estado. Si te piden el historial completo de una obra puntual, además contales que está la card «Historial de la obra» al final del detalle de esa obra, con filtros.

Tenés el ESTADO COMPLETO del estudio en un JSON: proyectos de diseño, obras de ejecución (cada obra trae sus "trabajos" = partidas con costo y venta), flujo de caja en 3 niveles, hitos de cobro con fechas, documentos cargados, y una proyección de caja. También un mapa de navegación ("navegacion").

Cómo razonar:
- Interpretá la intención, no solo las palabras. Sinónimos: "trabajos/ítems/partidas" = trabajos de una obra; "plata/efectivo/caja/liquidez" = saldo y proyección; "lo que debo/deuda" = por pagar; "lo que me deben" = por cobrar; "ganancia" = margen. Si "el proyecto de X" puede ser el diseño o la obra, aclará a cuál o cubrí ambos en breve.
- Podés calcular: sumas, máximos/mínimos, rankings, márgenes, porcentajes, diferencias. Para "los más costosos / los que más facturan" ordená por el campo correcto y listá el top con sus montos.
- Si preguntan por algo que NO está en el estado exacto (ej. "trabajos comprometidos" cuando ninguno está en estado 'comprometido'), NO te quedes en "no hay": explicá brevemente la situación real y ofrecé proactivamente el dato más cercano y útil (ej. los trabajos presupuestados más caros), e invitá a seguir.
- Usá SIEMPRE datos reales del JSON. Nunca inventes cifras, fechas, nombres ni documentos. Si de verdad no hay nada relacionado, decílo y sugerí qué cargar o dónde verlo.

Plata a una fecha: usá proyeccion_caja.eventos (ordenados por fecha con saldo_proyectado acumulado). Para "¿cuánto efectivo al <fecha>?" tomá el saldo_proyectado del último evento con fecha <= esa fecha (si no hay ninguno antes, es el saldo_actual). Aclará qué cobros entran hasta ahí. Los egresos/costos todavía no tienen fecha de pago programada (van en sin_fecha): si la pregunta depende de pagos futuros, advertilo.

Navegación: para "¿dónde encuentro / cómo cargo / dónde está X?" respondé la ruta concreta con "navegacion" (qué pestaña, qué card, qué botón).

Cotizaciones: cuando el usuario pida cotizar o presupuestar un proyecto de diseño, en vez de responder con texto llamá a la función generar_cotizacion. Estimá los entregables/fases con su costo y precio en Bs basándote en los proyectos anteriores del estudio (mirá sus entregables y precios como referencia real, ajustando por alcance y m²). Dejá en "notas" los supuestos y qué no incluye. Es una estimación base editable; no la presentes como precio cerrado.

Tareas: en el JSON tenés "tareas" (las del estudio) y "equipo" (las personas). Para consultas sobre tareas (qué hay pendiente, qué le toca a alguien, qué está vencido) respondé desde ahí. Cuando el usuario pida crear o asignar una tarea, llamá a crear_tarea con el título y, si los menciona, la persona (nombre del equipo), la fecha (YYYY-MM-DD), la prioridad y el proyecto; el sistema le pedirá confirmación antes de guardar.

Formato: montos en Bs con separador de miles (ej. Bs 12.500). Respuestas breves; listas cortas cuando sumen; negritas solo si ayudan. Nunca vuelques el JSON crudo.`;
app.post('/api/assistant', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const pregunta = (req.body && req.body.pregunta || '').toString().trim();
    if (!pregunta) return res.status(400).json({ error: 'Falta la pregunta' });
    const orgNombre = (await query('SELECT nombre FROM tenants WHERE id=$1', [T])).rows[0]?.nombre || 'tu organización';
    const ctx = await buildAssistantContext(T, orgNombre);
    const ctxStr = JSON.stringify(ctx);
    try {
      const g = await geminiAsk(ASSISTANT_SYS, ctxStr, pregunta, req.body.historial, ASSISTANT_TOOLS);
      await recordIaUso(T, actor(req), g.model, g.usage);
      if (g.functionCall && g.functionCall.name === 'generar_cotizacion') {
        const a = g.functionCall.args || {};
        const entregables = Array.isArray(a.entregables) ? a.entregables.map((e) => ({ nombre: String(e.nombre || 'Entregable'), costo: Number(e.costo) || 0, precio: Number(e.precio) || 0 })) : [];
        const cot = { nombre: String(a.nombre || 'Proyecto'), cliente: String(a.cliente || ''), notas: String(a.notas || ''), entregables };
        const tcRow = (await query('SELECT tc FROM proyectos WHERE tenant_id=$1 AND tc IS NOT NULL ORDER BY creado_en DESC LIMIT 1', [T])).rows[0];
        const tc = tcRow && Number(tcRow.tc) ? Number(tcRow.tc) : 6.96;
        const { base64, filename } = await buildCotizacionXlsx(cot, tc);
        const totP = entregables.reduce((s, e) => s + e.precio, 0), totC = entregables.reduce((s, e) => s + e.costo, 0);
        const resumen = `Te armé una cotización para ${cot.nombre}${cot.cliente ? ' — ' + cot.cliente : ''}: ${entregables.length} entregable(s), costo estimado Bs ${totC.toLocaleString('es-BO')} y precio Bs ${totP.toLocaleString('es-BO')}${totP ? ' (margen ' + Math.round((totP - totC) / totP * 100) + '%)' : ''}. Son estimaciones basadas en tus proyectos anteriores — descargá el Excel y ajustá lo que necesites antes de enviarla.`;
        return res.json({ respuesta: resumen, cotizacion: cot, xlsx_base64: base64, filename });
      }
      if (g.functionCall && g.functionCall.name === 'crear_tarea') {
        const a = g.functionCall.args || {};
        let asignado = null;
        if (a.asignado_a) {
          const u = (await query('SELECT id,nombre FROM usuarios WHERE tenant_id=$1 AND activo=true AND lower(nombre) LIKE lower($2) ORDER BY nombre LIMIT 1', [T, '%' + String(a.asignado_a).trim() + '%'])).rows[0];
          if (u) asignado = { id: u.id, nombre: u.nombre };
        }
        let proyecto = null;
        if (a.proyecto) {
          const p = (await query('SELECT id,nombre FROM proyectos WHERE tenant_id=$1 AND lower(nombre) LIKE lower($2) ORDER BY creado_en DESC LIMIT 1', [T, '%' + String(a.proyecto).trim() + '%'])).rows[0];
          if (p) proyecto = { id: p.id, nombre: p.nombre };
        }
        const prioridad = ['baja', 'media', 'alta'].includes(a.prioridad) ? a.prioridad : 'media';
        const vence_el = /^\d{4}-\d{2}-\d{2}$/.test(a.vence_el || '') ? a.vence_el : null;
        const prop = { titulo: String(a.titulo || 'Tarea').slice(0, 200), detalle: String(a.detalle || ''), prioridad, vence_el, asignado_a: asignado, proyecto };
        const partes = [];
        if (asignado) partes.push('para ' + asignado.nombre);
        if (vence_el) partes.push('vence ' + vence_el);
        partes.push('prioridad ' + prioridad);
        if (proyecto) partes.push('en ' + proyecto.nombre);
        return res.json({ respuesta: `Te propongo crear esta tarea: "${prop.titulo}" (${partes.join(' · ')}). ¿La creo?`, tarea_propuesta: prop });
      }
      res.json({ respuesta: g.text });
    } catch (e) {
      if (e.code === 'NO_KEY') {
        const pc = ctx.proyeccion_caja;
        const prox = pc.eventos.slice(0, 5).map((ev) => `• ${ev.fecha} · ${ev.concepto}: Bs ${ev.monto.toLocaleString('es-BO')} (saldo proyectado Bs ${ev.saldo_proyectado.toLocaleString('es-BO')})`).join('\n');
        return res.json({ respuesta: `(El asistente IA no está configurado en el servidor: falta GEMINI_API_KEY. Igual te dejo el resumen real de caja.)\n\nSaldo en banco hoy: Bs ${pc.saldo_actual.toLocaleString('es-BO')}\nPor cobrar total: Bs ${ctx.resumen_flujo.total_por_cobrar.toLocaleString('es-BO')}\nPor pagar total: Bs ${ctx.resumen_flujo.total_por_pagar.toLocaleString('es-BO')}\n\nPróximos cobros con fecha:\n${prox || '— sin hitos con fecha —'}`, sin_ia: true });
      }
      throw e;
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// directorio mínimo del equipo (para asignar tareas) — READ, sin datos sensibles
app.get('/api/equipo', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const r = await query('SELECT id,nombre,rol FROM usuarios WHERE tenant_id=$1 AND activo=true ORDER BY nombre', [T]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Tareas (módulo de gestión de tareas) ----
const T_ESTADOS = ['pendiente', 'en_progreso', 'hecha'];
const T_PRIOS = ['baja', 'media', 'alta'];
async function getTarea(id, T) {
  const r = await query(
    `SELECT t.*, ua.nombre AS asignado_nombre, p.nombre AS proyecto_nombre
     FROM tareas t LEFT JOIN usuarios ua ON ua.id=t.asignado_a LEFT JOIN proyectos p ON p.id=t.proyecto_id
     WHERE t.id=$1 AND t.tenant_id=$2`, [id, T]);
  return r.rows[0] || null;
}
async function perteneceTenant(tabla, id, T) {
  if (id == null) return true;
  const r = await query(`SELECT 1 FROM ${tabla} WHERE id=$1 AND tenant_id=$2`, [id, T]);
  return r.rowCount > 0;
}
app.get('/api/tareas', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const cond = ['t.tenant_id=$1']; const args = [T];
    if (req.query.mias === '1' && req.user) { args.push(req.user.id); cond.push('t.asignado_a=$' + args.length); }
    if (req.query.estado && T_ESTADOS.includes(req.query.estado)) { args.push(req.query.estado); cond.push('t.estado=$' + args.length); }
    if (req.query.proyecto_id) { args.push(parseInt(req.query.proyecto_id)); cond.push('t.proyecto_id=$' + args.length); }
    if (req.query.vencidas === '1') cond.push("t.vence_el < CURRENT_DATE AND t.estado<>'hecha'");
    const r = await query(
      `SELECT t.*, ua.nombre AS asignado_nombre, p.nombre AS proyecto_nombre
       FROM tareas t LEFT JOIN usuarios ua ON ua.id=t.asignado_a LEFT JOIN proyectos p ON p.id=t.proyecto_id
       WHERE ${cond.join(' AND ')}
       ORDER BY (t.estado='hecha'), COALESCE(t.vence_el,'9999-12-31'),
         CASE t.prioridad WHEN 'alta' THEN 0 WHEN 'media' THEN 1 ELSE 2 END, t.creado_en DESC`, args);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/tareas/resumen', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const uid = req.user ? req.user.id : 0;
    const r = (await query(
      `SELECT COUNT(*) FILTER (WHERE estado<>'hecha') AS abiertas,
              COUNT(*) FILTER (WHERE estado<>'hecha' AND asignado_a=$2) AS mias_abiertas,
              COUNT(*) FILTER (WHERE estado<>'hecha' AND asignado_a=$2 AND vence_el<=CURRENT_DATE) AS mias_urgentes
       FROM tareas WHERE tenant_id=$1`, [T, uid])).rows[0];
    res.json({ abiertas: N(r.abiertas), mias_abiertas: N(r.mias_abiertas), mias_urgentes: N(r.mias_urgentes) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/tareas', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const b = req.body || {};
    const titulo = String(b.titulo || '').trim().slice(0, 200);
    if (!titulo) return res.status(400).json({ error: 'La tarea necesita un título.' });
    const estado = T_ESTADOS.includes(b.estado) ? b.estado : 'pendiente';
    const prioridad = T_PRIOS.includes(b.prioridad) ? b.prioridad : 'media';
    const asignado_a = b.asignado_a ? parseInt(b.asignado_a) : null;
    const proyecto_id = b.proyecto_id ? parseInt(b.proyecto_id) : null;
    const vence_el = /^\d{4}-\d{2}-\d{2}$/.test(b.vence_el || '') ? b.vence_el : null;
    if (!(await perteneceTenant('usuarios', asignado_a, T))) return res.status(400).json({ error: 'Esa persona no es de tu organización.' });
    if (!(await perteneceTenant('proyectos', proyecto_id, T))) return res.status(400).json({ error: 'Ese proyecto no es de tu organización.' });
    const compl = estado === 'hecha' ? 'now()' : 'NULL';
    const ins = (await query(
      `INSERT INTO tareas(tenant_id,titulo,detalle,estado,prioridad,asignado_a,creado_por,proyecto_id,vence_el,completado_en)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,${compl}) RETURNING id`,
      [T, titulo, String(b.detalle || '') || null, estado, prioridad, asignado_a, (req.user ? req.user.id : null), proyecto_id, vence_el])).rows[0];
    const tarea = await getTarea(ins.id, T);
    await audit(req, { accion: 'crear', entidad: 'tarea', entidad_id: ins.id, despues: tarea });
    res.status(201).json(tarea);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/tareas/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const id = parseInt(req.params.id);
    const antes = await getTarea(id, T);
    if (!antes) return res.status(404).json({ error: 'Tarea no encontrada.' });
    const b = req.body || {};
    const sets = [], args = [];
    const put = (col, val) => { args.push(val); sets.push(`${col}=$${args.length}`); };
    if (b.titulo !== undefined) { const t = String(b.titulo).trim().slice(0, 200); if (!t) return res.status(400).json({ error: 'El título no puede quedar vacío.' }); put('titulo', t); }
    if (b.detalle !== undefined) put('detalle', String(b.detalle || '') || null);
    if (b.prioridad !== undefined) { if (!T_PRIOS.includes(b.prioridad)) return res.status(400).json({ error: 'Prioridad inválida.' }); put('prioridad', b.prioridad); }
    if (b.asignado_a !== undefined) { const a = b.asignado_a ? parseInt(b.asignado_a) : null; if (!(await perteneceTenant('usuarios', a, T))) return res.status(400).json({ error: 'Esa persona no es de tu organización.' }); put('asignado_a', a); }
    if (b.proyecto_id !== undefined) { const p = b.proyecto_id ? parseInt(b.proyecto_id) : null; if (!(await perteneceTenant('proyectos', p, T))) return res.status(400).json({ error: 'Ese proyecto no es de tu organización.' }); put('proyecto_id', p); }
    if (b.vence_el !== undefined) put('vence_el', /^\d{4}-\d{2}-\d{2}$/.test(b.vence_el || '') ? b.vence_el : null);
    if (b.estado !== undefined) {
      if (!T_ESTADOS.includes(b.estado)) return res.status(400).json({ error: 'Estado inválido.' });
      put('estado', b.estado);
      sets.push(b.estado === 'hecha' ? 'completado_en=now()' : 'completado_en=NULL');
    }
    if (!sets.length) return res.json(antes);
    sets.push('actualizado_en=now()');
    args.push(id, T);
    await query(`UPDATE tareas SET ${sets.join(', ')} WHERE id=$${args.length - 1} AND tenant_id=$${args.length}`, args);
    const tarea = await getTarea(id, T);
    await audit(req, { accion: 'editar', entidad: 'tarea', entidad_id: id, antes, despues: tarea });
    res.json(tarea);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/tareas/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const id = parseInt(req.params.id);
    const antes = await getTarea(id, T);
    if (!antes) return res.status(404).json({ error: 'Tarea no encontrada.' });
    await query('DELETE FROM tareas WHERE id=$1 AND tenant_id=$2', [id, T]);
    await audit(req, { accion: 'eliminar', entidad: 'tarea', entidad_id: id, antes });
    res.json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- adjuntos de tareas ----------
app.get('/api/tareas/:id/adjuntos', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await query('SELECT 1 FROM tareas WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rowCount) return res.status(404).json({ error: 'Tarea no encontrada' });
    const rows = (await query('SELECT id,nombre,mime,bytes,autor,creado_en FROM tarea_adjuntos WHERE tarea_id=$1 AND tenant_id=$2 ORDER BY id', [req.params.id, T])).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/tareas/:id/adjuntos', upload.single('file'), async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await query('SELECT 1 FROM tareas WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rowCount) return res.status(404).json({ error: 'Tarea no encontrada' });
    if (!req.file) return res.status(400).json({ error: 'Falta el archivo' });
    const st = await putFile(T, req.params.id, req.file);
    const r = await query('INSERT INTO tarea_adjuntos(tenant_id,tarea_id,nombre,mime,bytes,storage,r2_key,blob,autor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,nombre,mime,bytes,autor,creado_en',
      [T, req.params.id, req.file.originalname, req.file.mimetype, req.file.size, st.storage, st.r2_key, st.blob, actor(req)]);
    await audit(req, { accion: 'adjuntar', entidad: 'tarea', entidad_id: req.params.id, despues: { adjunto: r.rows[0].nombre } });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/tarea-adjuntos/:id/archivo', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const row = (await query('SELECT * FROM tarea_adjuntos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!row) return res.status(404).json({ error: 'No encontrado' });
    await streamFile(res, row, !!req.query.dl);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/tarea-adjuntos/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const old = (await query('SELECT id,tarea_id,nombre FROM tarea_adjuntos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!old) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM tarea_adjuntos WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_adjunto', entidad: 'tarea', entidad_id: old.tarea_id, antes: old });
    res.json({ ok: true, id: old.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- bitacora por partida ----------
app.get('/api/partidas/:id/bitacora', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    if (!(await query('SELECT 1 FROM partidas WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rowCount) return res.status(404).json({ error: 'Partida no encontrada' });
    const rows = (await query('SELECT id,nota,nombre,mime,bytes,autor,creado_en FROM partida_bitacora WHERE partida_id=$1 AND tenant_id=$2 ORDER BY creado_en DESC, id DESC', [req.params.id, T])).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/partidas/:id/bitacora', upload.single('file'), async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const link = (await query('SELECT c.proyecto_id FROM partidas pa JOIN capitulos c ON c.id=pa.capitulo_id WHERE pa.id=$1 AND pa.tenant_id=$2', [req.params.id, T])).rows[0];
    if (!link) return res.status(404).json({ error: 'Partida no encontrada' });
    const nota = String((req.body && req.body.nota) || '').trim().slice(0, 4000) || null;
    if (!nota && !req.file) return res.status(400).json({ error: 'Escribi una nota o adjunta una imagen' });
    let st = { storage: null, r2_key: null, blob: null }, nombre = null, mime = null, bytes = null;
    if (req.file) { st = await putFile(T, link.proyecto_id, req.file); nombre = req.file.originalname; mime = req.file.mimetype; bytes = req.file.size; }
    const r = await query('INSERT INTO partida_bitacora(tenant_id,partida_id,proyecto_id,nota,nombre,mime,bytes,storage,r2_key,blob,autor) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,nota,nombre,mime,bytes,autor,creado_en',
      [T, req.params.id, link.proyecto_id, nota, nombre, mime, bytes, st.storage, st.r2_key, st.blob, actor(req)]);
    await audit(req, { accion: 'bitacora', entidad: 'partida', entidad_id: req.params.id, despues: { nota: nota ? nota.slice(0, 80) : '(imagen)' } });
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/bitacora/:id/archivo', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const row = (await query('SELECT * FROM partida_bitacora WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!row || !row.storage) return res.status(404).json({ error: 'Sin imagen' });
    await streamFile(res, row, !!req.query.dl);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.delete('/api/bitacora/:id', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const old = (await query('SELECT id,partida_id FROM partida_bitacora WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!old) return res.status(404).json({ error: 'No encontrado' });
    await query('DELETE FROM partida_bitacora WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    await audit(req, { accion: 'eliminar_bitacora', entidad: 'partida', entidad_id: old.partida_id, antes: old });
    res.json({ ok: true, id: old.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- historial de obra ----------
// Merge de 3 fuentes scoped a la obra: auditoria (cambios), partida_bitacora (notas/imagenes), tarea_adjuntos.
// auditoria no guarda proyecto_id: se resuelve via JOIN para entidades vivas y via JSONB antes/despues para borradas.
const HIST_CTE = `WITH ev AS (
  SELECT 'cambio'::text AS tipo, a.creado_en AS fecha, a.usuario, a.accion, a.entidad, a.entidad_id,
         a.antes, a.despues, a.detalle, NULL::text AS nota, NULL::text AS partida,
         NULL::int AS adjunto_id, NULL::text AS adjunto_nombre, NULL::text AS adjunto_mime, NULL::text AS adjunto_endpoint
  FROM auditoria a
  WHERE a.tenant_id=$2 AND a.accion NOT IN ('bitacora','adjuntar') AND (
    (a.entidad IN ('proyecto','obra') AND a.entidad_id=$1)
    OR (a.entidad='capitulo' AND (EXISTS(SELECT 1 FROM capitulos c WHERE c.id=a.entidad_id AND c.proyecto_id=$1)
        OR COALESCE(a.despues->>'proyecto_id', a.antes->>'proyecto_id')=$1::text))
    OR (a.entidad='partida' AND (EXISTS(SELECT 1 FROM partidas pa JOIN capitulos c2 ON c2.id=pa.capitulo_id WHERE pa.id=a.entidad_id AND c2.proyecto_id=$1)
        OR EXISTS(SELECT 1 FROM capitulos c3 WHERE c3.proyecto_id=$1 AND c3.id::text=COALESCE(a.despues->>'capitulo_id', a.antes->>'capitulo_id'))))
    OR (a.entidad='tarea' AND (EXISTS(SELECT 1 FROM tareas t WHERE t.id=a.entidad_id AND t.proyecto_id=$1)
        OR COALESCE(a.despues->>'proyecto_id', a.antes->>'proyecto_id')=$1::text))
    OR (a.entidad='documento' AND EXISTS(SELECT 1 FROM documentos d WHERE d.id=a.entidad_id AND d.proyecto_id=$1))
    OR (a.entidad='hito' AND (EXISTS(SELECT 1 FROM hitos_cobro h WHERE h.id=a.entidad_id AND h.obra_id=$1)
        OR COALESCE(a.despues->>'obra_id', a.antes->>'obra_id')=$1::text))
    OR (a.entidad='hito_pago' AND (EXISTS(SELECT 1 FROM hitos_pago hpg WHERE hpg.id=a.entidad_id AND hpg.obra_id=$1)
        OR COALESCE(a.despues->>'obra_id', a.antes->>'obra_id')=$1::text))
  )
  UNION ALL
  SELECT CASE WHEN COALESCE(b.nota,'')='' THEN 'adjunto' ELSE 'nota' END, b.creado_en, b.autor,
         NULL, NULL, NULL::int, NULL::jsonb, NULL::jsonb, NULL, b.nota, pa.descripcion,
         CASE WHEN b.storage IS NOT NULL THEN b.id END, b.nombre, b.mime,
         CASE WHEN b.storage IS NOT NULL THEN '/bitacora/'||b.id||'/archivo' END
  FROM partida_bitacora b LEFT JOIN partidas pa ON pa.id=b.partida_id
  WHERE b.tenant_id=$2 AND b.proyecto_id=$1
  UNION ALL
  SELECT 'adjunto', ta.creado_en, ta.autor,
         NULL, NULL, NULL::int, NULL::jsonb, NULL::jsonb, t.titulo, NULL, NULL,
         ta.id, ta.nombre, ta.mime, '/tarea-adjuntos/'||ta.id||'/archivo'
  FROM tarea_adjuntos ta JOIN tareas t ON t.id=ta.tarea_id
  WHERE ta.tenant_id=$2 AND t.proyecto_id=$1
)`;
const HIST_VERBOS = {
  crear: 'creó', editar: 'editó', eliminar: 'eliminó',
  crear_capitulo: 'creó el capítulo', editar_capitulo: 'editó el capítulo', eliminar_capitulo: 'eliminó el capítulo',
  crear_partida: 'creó la partida', editar_partida: 'editó la partida', eliminar_partida: 'eliminó la partida',
  crear_hito: 'creó el hito de cobro', editar_hito: 'editó el hito de cobro', eliminar_hito: 'eliminó el hito de cobro',
  crear_hito_pago: 'creó el hito de pago', editar_hito_pago: 'editó el hito de pago', eliminar_hito_pago: 'eliminó el hito de pago',
  correo_pago: 'envió confirmación de pago',
  doc_hito_pago: 'subió documento al hito de pago', eliminar_doc_hito_pago: 'eliminó documento del hito de pago',
  factura_verificada: 'factura verificada por IA — hito facturado', verificacion_rechazada: 'verificación IA rechazada',
  solicitar_transferencia: 'solicitó la transferencia', pago_confirmado: 'pago confirmado con comprobante — hito pagado',
  retroceso_estado: 'retrocedió el estado del hito de pago', retroceso_estado_cobro: 'retrocedió el estado del hito de cobro',
  doc_hito_cobro: 'subió documento al hito de cobro', eliminar_doc_hito_cobro: 'eliminó documento del hito de cobro',
  factura_cobro_verificada: 'factura al cliente verificada por IA — hito facturado', cobro_confirmado: 'cobro confirmado con comprobante — hito cobrado', verificacion_cobro_rechazada: 'verificación IA del cobro rechazada',
  subir_documento: 'subió un documento', reemplazar_documento: 'reemplazó un documento', eliminar_documento: 'eliminó un documento',
  guardar_version: 'guardó una versión', convertir_a_obra: 'convirtió el proyecto en obra',
  eliminar_adjunto: 'eliminó un adjunto de tarea', eliminar_bitacora: 'eliminó una nota de bitácora',
  crear_entregable: 'creó un entregable', editar_entregable: 'editó un entregable', eliminar_entregable: 'eliminó un entregable',
};
const HIST_CAMPOS = {
  descripcion: 'descripción', unidad: 'unidad', cantidad: 'cantidad', factor: 'factor', pu_costo: 'P.U. costo',
  nombre: 'nombre', titulo: 'título', detalle: 'detalle', estado: 'estado', prioridad: 'prioridad',
  porcentaje: '%', fecha: 'fecha', vence_el: 'vence', grupo: 'grupo', grupo_nombre: 'grupo', num: 'número',
  cliente: 'cliente', ubicacion: 'ubicación', responsable: 'responsable', avance: 'avance', superficie: 'superficie', completada: 'completada',
  gg: 'GG', utilidad: 'utilidad', it: 'IT', tc: 'TC', credito_diseno: 'crédito diseño',
  estado_cobro: 'estado de cobro', estado_costo: 'estado de costo', version: 'versión', asignado_a: 'asignado a',
};
function histVal(v) {
  if (v === true) return 'sí';
  if (v === false) return 'no';
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!isNaN(n) && String(v).trim() !== '') return String(+n.toFixed(4));
  const s = String(v);
  return s.length > 48 ? s.slice(0, 48) + '…' : s;
}
function histDiff(antes, despues) {
  if (!antes || !despues) return '';
  const out = [];
  for (const k of Object.keys(HIST_CAMPOS)) {
    if (!(k in antes) && !(k in despues)) continue;
    const a = antes[k], d = despues[k];
    const na = Number(a), nd = Number(d);
    const numeric = a != null && d != null && a !== '' && d !== '' && !isNaN(na) && !isNaN(nd);
    if (numeric ? na === nd : String(a == null ? '' : a) === String(d == null ? '' : d)) continue;
    out.push(`${HIST_CAMPOS[k]}: ${histVal(a)} → ${histVal(d)}`);
  }
  return out.join(' · ');
}
function histNombre(j) { return (j && (j.descripcion || j.nombre || j.titulo)) || ''; }
const HIST_ENT = { proyecto: 'el proyecto', obra: 'la obra', tarea: 'la tarea' };
function histItem(r) {
  const it = { tipo: r.tipo, fecha: r.fecha, usuario: r.usuario || '—', descripcion: '', partida: null, adjunto: null };
  if (r.adjunto_id) it.adjunto = { id: r.adjunto_id, nombre: r.adjunto_nombre, mime: r.adjunto_mime, endpoint: r.adjunto_endpoint };
  if (r.tipo === 'cambio') {
    const generica = ['crear', 'editar', 'eliminar'].includes(r.accion);
    const verbo = (HIST_VERBOS[r.accion] || `${r.accion} ${r.entidad || ''}`.trim()) + (generica ? ` ${HIST_ENT[r.entidad] || r.entidad || ''}`.trimEnd() : '');
    const nombre = histNombre(r.antes) || histNombre(r.despues) || (r.accion !== 'guardar_version' && r.detalle) || '';
    const diff = r.accion && /^editar/.test(r.accion) ? histDiff(r.antes, r.despues) : '';
    it.descripcion = verbo + (nombre ? ` «${String(nombre).slice(0, 80)}»` : '') + (diff ? ` — ${diff}` : '') + (r.accion === 'guardar_version' && r.detalle ? ` (${r.detalle})` : '');
    if (r.entidad === 'partida') it.partida = histNombre(r.antes) || histNombre(r.despues) || null;
  } else if (r.tipo === 'nota') {
    it.descripcion = r.nota || '';
    it.partida = r.partida || null;
  } else if (r.adjunto_endpoint && r.adjunto_endpoint.indexOf('/bitacora/') === 0) {
    it.descripcion = 'Imagen en bitácora';
    it.partida = r.partida || null;
  } else {
    it.descripcion = 'Adjunto en tarea' + (r.detalle ? ` «${String(r.detalle).slice(0, 80)}»` : '');
  }
  return it;
}
app.get('/api/proyectos/:id/historial', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const oid = parseInt(req.params.id, 10);
    if (!oid || !(await ownProy(T, oid))) return res.status(404).json({ error: 'Obra no encontrada' });
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const tipo = ['cambio', 'nota', 'adjunto'].includes(req.query.tipo) ? req.query.tipo : null;
    const usuario = String(req.query.usuario || '').trim() || null;
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde || '') ? req.query.desde : null;
    const hasta = /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta || '') ? req.query.hasta : null;
    const r = await query(`${HIST_CTE}
      SELECT *, count(*) OVER()::int AS total FROM ev
      WHERE ($3::text IS NULL OR CASE WHEN $3='adjunto' THEN (tipo='adjunto' OR adjunto_id IS NOT NULL) ELSE tipo=$3 END)
        AND ($4::text IS NULL OR usuario=$4)
        AND ($5::date IS NULL OR (fecha AT TIME ZONE 'America/La_Paz')::date >= $5::date)
        AND ($6::date IS NULL OR (fecha AT TIME ZONE 'America/La_Paz')::date <= $6::date)
      ORDER BY fecha DESC LIMIT $7 OFFSET $8`,
      [oid, T, tipo, usuario, desde, hasta, limit, offset]);
    const total = r.rows.length ? r.rows[0].total : 0;
    const out = { items: r.rows.map(histItem), total, limit, offset };
    if (!offset) {
      out.usuarios = (await query(`${HIST_CTE} SELECT DISTINCT usuario FROM ev WHERE usuario IS NOT NULL ORDER BY 1`, [oid, T])).rows.map((x) => x.usuario);
    }
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- cierre de obra (IA) ----------
const CIERRE_SYS = `Sos un asistente para un estudio de arquitectura en Bolivia. Te paso el detalle de una obra (nombre, capitulos/partidas y montos) y la BITACORA: notas cronologicas que el equipo cargo en cada partida durante la ejecucion. Redacta un "Cierre de obra" en espanol rioplatense, claro y profesional, de 2 a 4 parrafos: que se hizo, avances e hitos que surgen de las notas, problemas o imprevistos y como se resolvieron, y un cierre con el estado final. Basate SOLO en lo que aparece en las notas y el detalle; no inventes. Si la bitacora esta vacia, decilo en una frase. Sin markdown ni vinetas, en prosa.`;
async function geminiCierre(text) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) { const e = new Error('NO_KEY'); e.code = 'NO_KEY'; throw e; }
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const body = { systemInstruction: { parts: [{ text: CIERRE_SYS }] }, contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { temperature: 0.3, maxOutputTokens: 1200, thinkingConfig: { thinkingBudget: 0 } } };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const data = await r.json();
  const cand = (data.candidates && data.candidates[0]) || null;
  const um = data.usageMetadata || {};
  const usage = { tokens_in: um.promptTokenCount || 0, tokens_out: um.candidatesTokenCount || 0, tokens_think: um.thoughtsTokenCount || 0, tokens_total: um.totalTokenCount || 0 };
  if (!usage.tokens_total) usage.tokens_total = usage.tokens_in + usage.tokens_out + usage.tokens_think;
  let out = ''; if (cand && cand.content && Array.isArray(cand.content.parts)) out = cand.content.parts.map((p) => p.text || '').join('').trim();
  return { text: out, usage, model };
}
app.post('/api/proyectos/:id/cierre-ia', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const proy = (await query('SELECT * FROM proyectos WHERE id=$1 AND tenant_id=$2', [req.params.id, T])).rows[0];
    if (!proy) return res.status(404).json({ error: 'Obra no encontrada' });
    const caps = (await query('SELECT c.nombre AS capitulo, pa.descripcion, pa.unidad, pa.cantidad FROM partidas pa JOIN capitulos c ON c.id=pa.capitulo_id WHERE c.proyecto_id=$1 AND pa.tenant_id=$2 ORDER BY c.orden, pa.orden', [proy.id, T])).rows;
    const bit = (await query('SELECT b.creado_en, b.autor, b.nota, b.nombre, c.nombre AS capitulo, pa.descripcion AS partida FROM partida_bitacora b JOIN partidas pa ON pa.id=b.partida_id JOIN capitulos c ON c.id=pa.capitulo_id WHERE b.proyecto_id=$1 AND b.tenant_id=$2 ORDER BY b.creado_en', [proy.id, T])).rows;
    let txt = 'OBRA: ' + proy.nombre + '\nCliente: ' + (proy.cliente || '-') + ' | Estado: ' + proy.estado + ' | Avance: ' + (proy.avance || 0) + '%\n\nPARTIDAS:\n';
    caps.forEach((r) => { txt += '- [' + r.capitulo + '] ' + r.descripcion + ' (' + N(r.cantidad) + ' ' + (r.unidad || '') + ')\n'; });
    txt += '\nBITACORA (' + bit.length + ' entradas):\n';
    if (!bit.length) txt += '(sin entradas)\n';
    bit.forEach((r) => { const f = (r.creado_en ? new Date(r.creado_en).toISOString().slice(0, 10) : ''); txt += '- ' + f + ' | ' + (r.autor || '-') + ' | [' + r.capitulo + ' > ' + r.partida + '] ' + (r.nota || '') + (r.nombre ? ' [imagen: ' + r.nombre + ']' : '') + '\n'; });
    const g = await geminiCierre(txt.slice(0, 24000));
    await recordIaUso(T, actor(req), g.model, g.usage);
    res.json({ texto: g.text || '(sin resultado)', entradas: bit.length });
  } catch (e) {
    if (e.code === 'NO_KEY') return res.status(503).json({ error: 'La IA del servidor no esta configurada (falta GEMINI_API_KEY).' });
    res.status(500).json({ error: e.message });
  }
});

// importar una cotización (Excel editado) y crearla como proyecto de diseño — requiere WRITE
function _cellText(c) { if (!c) return ''; const v = c.value; if (v == null) return ''; if (typeof v === 'object') { if (v.richText) return v.richText.map((t) => t.text).join(''); if (v.text != null) return String(v.text); if (v.result != null) return String(v.result); return ''; } return String(v); }
function _cellNum(c) { if (!c) return 0; const v = c.value; if (v == null) return 0; if (typeof v === 'number') return v; if (typeof v === 'object' && v.result != null) { const n = parseFloat(String(v.result).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; } const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
async function parseCotizacionXlsx(b64) {
  if (!b64) return { error: 'Falta el archivo (xlsx_base64).' };
  let wb;
  try { wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(b64, 'base64')); } catch (e) { return { error: 'El archivo no es un Excel válido.' }; }
  const ws = wb.worksheets[0];
  if (!ws) return { error: 'El Excel no tiene hojas.' };
  let nombre = _cellText(ws.getCell('A2')).trim();
  let cliente = '', tc = 6.96, headerRow = -1;
  ws.eachRow((row, rn) => {
    const a = _cellText(row.getCell(1)).trim();
    if (/^cliente$/i.test(a)) cliente = _cellText(row.getCell(2)).trim();
    else if (/^tc\b/i.test(a)) { const t = _cellNum(row.getCell(2)); if (t) tc = t; }
    if (headerRow < 0 && /^entregable$/i.test(a)) headerRow = rn;
  });
  if (!nombre || /^cotizaci/i.test(nombre)) nombre = 'Proyecto cotizado';
  if (cliente === '—' || cliente === '-') cliente = '';
  const entregables = [];
  if (headerRow > 0) {
    for (let rn = headerRow + 1; rn <= ws.rowCount; rn++) {
      const row = ws.getRow(rn);
      const nm = _cellText(row.getCell(1)).trim();
      if (!nm || /^total/i.test(nm) || /^precio total/i.test(nm) || /^notas/i.test(nm)) break;
      entregables.push({ nombre: nm.slice(0, 200), costo: _cellNum(row.getCell(2)), precio: _cellNum(row.getCell(3)) });
    }
  }
  if (!entregables.length) return { error: 'No encontré entregables en el Excel. Asegurate de usar el archivo que generó el asistente (columna Entregable, Costo, Precio).' };
  return { error: null, nombre: nombre.slice(0, 200), cliente, tc, entregables };
}
// paso 1: previsualizar la cotización del Excel (NO crea nada) — requiere WRITE
app.post('/api/assistant/previsualizar-cotizacion', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const p = await parseCotizacionXlsx(req.body && req.body.xlsx_base64);
    if (p.error) return res.status(400).json({ error: p.error });
    res.json({ nombre: p.nombre, cliente: p.cliente, tc: p.tc, entregables: p.entregables });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// paso 2: crear el proyecto a partir de la cotización confirmada (JSON) — requiere WRITE
app.post('/api/assistant/importar-cotizacion', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const b = req.body || {};
    let nombre, cliente, tc, entregables;
    if (Array.isArray(b.entregables)) {
      nombre = String(b.nombre || 'Proyecto cotizado').slice(0, 200);
      cliente = (b.cliente && b.cliente !== '—' && b.cliente !== '-') ? String(b.cliente).slice(0, 200) : '';
      tc = Number(b.tc) || 6.96;
      entregables = b.entregables.map((e) => ({ nombre: String(e.nombre || 'Entregable').slice(0, 200), costo: Number(e.costo) || 0, precio: Number(e.precio) || 0 }));
    } else {
      const p = await parseCotizacionXlsx(b.xlsx_base64);
      if (p.error) return res.status(400).json({ error: p.error });
      ({ nombre, cliente, tc, entregables } = p);
    }
    if (!entregables.length) return res.status(400).json({ error: 'No hay entregables para crear el proyecto.' });
    const pr = (await query(
      `INSERT INTO proyectos(tenant_id,tipo,nombre,cliente,estado,tc) VALUES($1,'proyecto',$2,$3,'borrador',$4) RETURNING *`,
      [T, nombre, cliente || null, tc])).rows[0];
    await audit(req, { accion: 'crear', entidad: 'proyecto', entidad_id: pr.id, despues: pr, detalle: 'importado desde cotización' });
    let orden = 0;
    for (const e of entregables) {
      await query('INSERT INTO entregables(tenant_id,proyecto_id,nombre,costo,precio,orden) VALUES($1,$2,$3,$4,$5,$6)',
        [T, pr.id, e.nombre, e.costo, e.precio, orden++]);
    }
    res.status(201).json({ proyecto_id: pr.id, nombre: pr.nombre, cliente: pr.cliente, n_entregables: entregables.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// uso de IA por organización (solo super-admin de plataforma)
app.get('/api/admin/ia-uso', requireAdmin, async (req, res) => {
  try {
    const porTenant = (await query(
      `SELECT u.tenant_id, t.nombre AS organizacion, COUNT(*)::int AS llamadas,
        COALESCE(SUM(u.tokens_in),0)::int AS tokens_in, COALESCE(SUM(u.tokens_out),0)::int AS tokens_out,
        COALESCE(SUM(u.tokens_think),0)::int AS tokens_think, COALESCE(SUM(u.tokens_total),0)::int AS tokens_total,
        COALESCE(SUM(u.costo_usd),0)::float AS costo_usd
       FROM ia_uso u LEFT JOIN tenants t ON t.id=u.tenant_id
       GROUP BY u.tenant_id, t.nombre ORDER BY costo_usd DESC`)).rows;
    const tot = (await query(
      `SELECT COUNT(*)::int AS llamadas, COALESCE(SUM(tokens_in),0)::int AS tokens_in, COALESCE(SUM(tokens_out),0)::int AS tokens_out,
        COALESCE(SUM(tokens_think),0)::int AS tokens_think, COALESCE(SUM(tokens_total),0)::int AS tokens_total, COALESCE(SUM(costo_usd),0)::float AS costo_usd FROM ia_uso`)).rows[0];
    const recientes = (await query(
      `SELECT u.creado_en, t.nombre AS organizacion, u.usuario, u.modelo, u.tokens_total, u.costo_usd::float AS costo_usd
       FROM ia_uso u LEFT JOIN tenants t ON t.id=u.tenant_id ORDER BY u.creado_en DESC LIMIT 25`)).rows;
    const modelo = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    res.json({ por_tenant: porTenant, total: tot, recientes, precios: { modelo, ...iaPrice(modelo) } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- auditoria ----------
app.get('/api/auditoria', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const lim = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const r = await query('SELECT id,usuario,accion,entidad,entidad_id,antes,despues,detalle,creado_en FROM auditoria WHERE tenant_id=$1 ORDER BY creado_en DESC LIMIT $2', [T, lim]);
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- snapshots (export por organización) ----------
const TABLAS = TENANT_TABLES;
app.get('/api/snapshots', async (req, res) => {
  try { const T = tid(req, res); if (!T) return; res.json((await query('SELECT * FROM snapshots WHERE tenant_id=$1 ORDER BY creado_en DESC LIMIT 50', [T])).rows); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/snapshots/export', async (req, res) => {
  try {
    const T = tid(req, res); if (!T) return;
    const dump = {}; let filas = 0;
    for (const t of TABLAS) {
      const cols = t === 'documentos'
        ? 'id,proyecto_id,categoria,nombre,mime,bytes,storage,r2_key,version,vigente,eliminado,reemplaza_a,autor,creado_en,tenant_id'
        : '*';
      const r = (await query(`SELECT ${cols} FROM ${t} WHERE tenant_id=$1`, [T])).rows; dump[t] = r; filas += r.length;
    }
    const body = JSON.stringify({ generado: new Date().toISOString(), app: 'origina-v2', tenant_id: T, tablas: dump });
    const bytes = Buffer.byteLength(body);
    const archivo = 'origina-snapshot-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    await query('INSERT INTO snapshots(tenant_id,archivo,tablas,filas,bytes,origen,autor) VALUES($1,$2,$3,$4,$5,$6,$7)',
      [T, archivo, TABLAS.length, filas, bytes, 'manual', actor(req)]);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
    res.send(body);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- arranque ----------
const PORT = process.env.PORT || 3000;
migrate()
  .then(loadTenants)
  .then(() => app.listen(PORT, () => console.log(`[origina-v2] API en :${PORT} · admin token ADMIN_TOKEN`)))
  .catch((e) => { console.error('Error al migrar:', e); process.exit(1); });
module.exports = { buildAssistantContext, matchVerificacion };
