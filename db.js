const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  console.error('\n[origina-v2] Falta DATABASE_URL.\n' +
    '  Local:   DATABASE_URL="postgresql://USUARIO@localhost:5432/originav2" node server.js\n' +
    '  Railway: agregá un Postgres al proyecto (se inyecta solo).\n');
  process.exit(1);
}
try { new URL(process.env.DATABASE_URL); }
catch (e) {
  console.error('\n[origina-v2] DATABASE_URL no es una URL válida (parece un placeholder).\n' +
    '  Reemplazá USER:PASS@HOST:PORT/DB por tu cadena real, ej:\n' +
    '  postgresql://' + (process.env.USER || 'usuario') + '@localhost:5432/originav2\n');
  process.exit(1);
}

function sslConfig() {
  const m = (process.env.PGSSL || '').toLowerCase();
  if (m === 'true' || m === 'require') return { rejectUnauthorized: false };
  if (m === 'false' || m === 'disable') return false;
  if (/sslmode=require/i.test(process.env.DATABASE_URL || '')) return { rejectUnauthorized: false };
  return false; // por defecto sin SSL — Railway interno y Postgres local funcionan así
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig(),
});

const query = (text, params) => pool.query(text, params);

// organización por defecto (donde caen los datos existentes al migrar) y token admin global
const DEFAULT_TENANT_TOKEN = process.env.DEFAULT_TENANT_TOKEN || 'origina-2026-secreto';
const DEFAULT_TENANT_NOMBRE = process.env.DEFAULT_TENANT_NOMBRE || 'Origina Group';

// tablas con tenant_id que se scopean por organización
const TENANT_TABLES = ['proyectos', 'entregables', 'capitulos', 'partidas', 'hitos_cobro', 'hitos_pago', 'hito_pago_docs', 'hito_cobro_docs', 'proveedores', 'versiones', 'auditoria', 'snapshots', 'documentos', 'tareas', 'tarea_adjuntos', 'partida_bitacora'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tenants(
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE,
  token TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'basico',
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS usuarios(
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'administrativo' CHECK (rol IN ('admin','aprobador','administrativo','revisor')),
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_tenant ON usuarios(tenant_id);
CREATE TABLE IF NOT EXISTS ia_uso(
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  usuario TEXT,
  modelo TEXT,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  tokens_think INT DEFAULT 0,
  tokens_total INT DEFAULT 0,
  costo_usd NUMERIC(12,6) DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_iauso_tenant ON ia_uso(tenant_id);
CREATE INDEX IF NOT EXISTS idx_iauso_fecha ON ia_uso(creado_en);
CREATE TABLE IF NOT EXISTS proyectos(
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'proyecto' CHECK (tipo IN ('proyecto','obra')),
  nombre TEXT NOT NULL,
  cliente TEXT,
  ubicacion TEXT,
  responsable TEXT,
  estado TEXT NOT NULL DEFAULT 'borrador',
  version TEXT DEFAULT 'V.01',
  superficie NUMERIC(12,2),
  moneda TEXT DEFAULT 'Bs',
  tc NUMERIC(10,4) DEFAULT 6.96,
  gg NUMERIC(6,4) DEFAULT 0.10,
  utilidad NUMERIC(6,4) DEFAULT 0.15,
  it NUMERIC(6,4) DEFAULT 0.0309,
  credito_diseno NUMERIC(14,2) DEFAULT 0,
  proyecto_origen_id INT REFERENCES proyectos(id) ON DELETE SET NULL,
  ini DATE, fin DATE, avance INT DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS entregables(
  id SERIAL PRIMARY KEY,
  proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT, costo NUMERIC(14,2) DEFAULT 0, precio NUMERIC(14,2) DEFAULT 0, orden INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS capitulos(
  id SERIAL PRIMARY KEY,
  proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE,
  grupo TEXT DEFAULT 'A', grupo_nombre TEXT DEFAULT 'OBRA',
  num INT DEFAULT 1, nombre TEXT, orden INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS partidas(
  id SERIAL PRIMARY KEY,
  capitulo_id INT REFERENCES capitulos(id) ON DELETE CASCADE,
  descripcion TEXT, unidad TEXT DEFAULT 'glb',
  cantidad NUMERIC(14,4) DEFAULT 1, factor NUMERIC(8,4) DEFAULT 1,
  pu_costo NUMERIC(14,4) DEFAULT 0, orden INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS versiones(
  id SERIAL PRIMARY KEY,
  proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE,
  version TEXT, nota TEXT, autor TEXT, snapshot JSONB, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auditoria(
  id SERIAL PRIMARY KEY,
  usuario TEXT, accion TEXT, entidad TEXT, entidad_id INT,
  antes JSONB, despues JSONB, detalle TEXT, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS snapshots(
  id SERIAL PRIMARY KEY, archivo TEXT, tablas INT, filas INT, bytes BIGINT,
  origen TEXT, autor TEXT, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS documentos(
  id SERIAL PRIMARY KEY,
  proyecto_id INT REFERENCES proyectos(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'anexo',
  nombre TEXT, mime TEXT, bytes BIGINT,
  storage TEXT DEFAULT 'db', r2_key TEXT, blob BYTEA,
  version INT DEFAULT 1, vigente BOOLEAN DEFAULT true, eliminado BOOLEAN DEFAULT false,
  reemplaza_a INT, autor TEXT, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_proy ON documentos(proyecto_id);
CREATE TABLE IF NOT EXISTS hitos_cobro(
  id SERIAL PRIMARY KEY,
  obra_id INT REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT, porcentaje NUMERIC(7,3) DEFAULT 0,
  fecha DATE, estado TEXT DEFAULT 'pendiente', orden INT DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hito_obra ON hitos_cobro(obra_id);
CREATE TABLE IF NOT EXISTS hitos_pago(
  id SERIAL PRIMARY KEY,
  obra_id INT REFERENCES proyectos(id) ON DELETE CASCADE,
  tenant_id INT,
  nombre TEXT, porcentaje NUMERIC(7,3) DEFAULT 0,
  fecha DATE, estado TEXT DEFAULT 'pendiente', orden INT DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hitop_obra ON hitos_pago(obra_id);
CREATE TABLE IF NOT EXISTS proveedores(
  id SERIAL PRIMARY KEY,
  tenant_id INT,
  nombre TEXT NOT NULL,
  email TEXT, nit TEXT, razon_social TEXT,
  telefono TEXT, contacto TEXT,
  rubro TEXT, notas TEXT,
  activo BOOLEAN DEFAULT true,
  creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prov_tenant ON proveedores(tenant_id);
ALTER TABLE hitos_pago ADD COLUMN IF NOT EXISTS proveedor_id INT REFERENCES proveedores(id) ON DELETE SET NULL;
ALTER TABLE hitos_pago ADD COLUMN IF NOT EXISTS monto_solicitado NUMERIC(14,2);
ALTER TABLE partidas ADD COLUMN IF NOT EXISTS completada BOOLEAN DEFAULT false;
CREATE TABLE IF NOT EXISTS hito_pago_docs(
  id SERIAL PRIMARY KEY,
  tenant_id INT,
  hito_pago_id INT REFERENCES hitos_pago(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'otro' CHECK (tipo IN ('factura','comprobante','otro')),
  nota TEXT,
  nombre TEXT, mime TEXT, bytes INT, storage TEXT, r2_key TEXT, blob BYTEA,
  verificacion JSONB,
  autor TEXT, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hpd_hito ON hito_pago_docs(hito_pago_id);
CREATE TABLE IF NOT EXISTS hito_cobro_docs(
  id SERIAL PRIMARY KEY,
  tenant_id INT,
  hito_cobro_id INT REFERENCES hitos_cobro(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'otro' CHECK (tipo IN ('factura','comprobante','otro')),
  nota TEXT,
  nombre TEXT, mime TEXT, bytes INT, storage TEXT, r2_key TEXT, blob BYTEA,
  verificacion JSONB,
  autor TEXT, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hcd_hito ON hito_cobro_docs(hito_cobro_id);
CREATE INDEX IF NOT EXISTS idx_cap_proy ON capitulos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_part_cap ON partidas(capitulo_id);
CREATE INDEX IF NOT EXISTS idx_entr_proy ON entregables(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_ver_proy ON versiones(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_aud_creado ON auditoria(creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_proy_tipo ON proyectos(tipo);
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estado_cobro TEXT DEFAULT 'cotizado';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estado_costo TEXT DEFAULT 'presupuestado';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS archivado BOOLEAN DEFAULT false;
UPDATE proyectos SET estado='aceptado' WHERE estado='vendido';
ALTER TABLE proyectos     ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE entregables   ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE capitulos     ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE partidas      ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE hitos_cobro   ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE versiones     ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE auditoria     ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE snapshots     ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE documentos    ADD COLUMN IF NOT EXISTS tenant_id INT;
ALTER TABLE documentos    ADD COLUMN IF NOT EXISTS resumen TEXT;
ALTER TABLE documentos    ADD COLUMN IF NOT EXISTS resumen_estado TEXT DEFAULT 'pendiente';
ALTER TABLE documentos    ADD COLUMN IF NOT EXISTS resumen_en TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_proy_tenant ON proyectos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_part_tenant ON partidas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_aud_tenant ON auditoria(tenant_id);
CREATE TABLE IF NOT EXISTS tareas(
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES tenants(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  detalle TEXT,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_progreso','hecha')),
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja','media','alta')),
  asignado_a INT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_por INT REFERENCES usuarios(id) ON DELETE SET NULL,
  proyecto_id INT REFERENCES proyectos(id) ON DELETE SET NULL,
  vence_el DATE,
  completado_en TIMESTAMPTZ,
  orden INT DEFAULT 0,
  creado_en TIMESTAMPTZ DEFAULT now(),
  actualizado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tarea_tenant ON tareas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tarea_asig ON tareas(asignado_a);
CREATE INDEX IF NOT EXISTS idx_tarea_proy ON tareas(proyecto_id);
CREATE TABLE IF NOT EXISTS tarea_adjuntos(
  id SERIAL PRIMARY KEY,
  tenant_id INT,
  tarea_id INT REFERENCES tareas(id) ON DELETE CASCADE,
  nombre TEXT, mime TEXT, bytes INT,
  storage TEXT DEFAULT 'db', r2_key TEXT, blob BYTEA,
  autor TEXT, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tadj_tarea ON tarea_adjuntos(tarea_id);
CREATE TABLE IF NOT EXISTS partida_bitacora(
  id SERIAL PRIMARY KEY,
  tenant_id INT,
  partida_id INT REFERENCES partidas(id) ON DELETE CASCADE,
  proyecto_id INT,
  nota TEXT,
  nombre TEXT, mime TEXT, bytes INT, storage TEXT, r2_key TEXT, blob BYTEA,
  autor TEXT, creado_en TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pbit_partida ON partida_bitacora(partida_id);
CREATE INDEX IF NOT EXISTS idx_pbit_proy ON partida_bitacora(proyecto_id);
`;

async function seed() {
  const { rows } = await query('SELECT COUNT(*)::int n FROM proyectos');
  if (rows[0].n > 0) return;
  console.log('[seed] base vacía — cargando datos de ejemplo (Sony + otros)...');
  const sony = JSON.parse(fs.readFileSync(path.join(__dirname, 'sony_seed.json'), 'utf8'));

  const pDis = (await query(
    `INSERT INTO proyectos(tipo,nombre,cliente,ubicacion,responsable,estado,version,superficie,tc,gg,utilidad,it)
     VALUES('proyecto','Oficinas Sony — Diseño',$1,$2,'MFBC','aceptado','V.02',$3,$4,$5,$6,$7) RETURNING id`,
    [sony.cliente, sony.ubicacion, sony.superficie, sony.tc, sony.gg, sony.utilidad, sony.it]
  )).rows[0].id;
  const entr = [
    ['Anteproyecto y layout funcional', 2200, 4800],
    ['Planos ejecutivos + detalles constructivos', 3500, 7200],
    ['Renders 3D + memoria de especificaciones', 2500, 5400],
  ];
  let oe = 0;
  for (const [n, c, p] of entr)
    await query('INSERT INTO entregables(proyecto_id,nombre,costo,precio,orden) VALUES($1,$2,$3,$4,$5)', [pDis, n, c, p, oe++]);

  const pObra = (await query(
    `INSERT INTO proyectos(tipo,nombre,cliente,ubicacion,responsable,estado,version,superficie,tc,gg,utilidad,it,credito_diseno,proyecto_origen_id,ini,fin,avance)
     VALUES('obra','Sony — Ejecución Green Tower',$1,$2,'MFBC','en curso','V.02',$3,$4,$5,$6,$7,17400,$8,'2026-06-02','2026-08-29',38) RETURNING id`,
    [sony.cliente, sony.ubicacion, sony.superficie, sony.tc, sony.gg, sony.utilidad, sony.it, pDis]
  )).rows[0].id;
  let co = 0;
  for (const g of sony.grupos) {
    for (const cap of g.caps) {
      const cid = (await query(
        'INSERT INTO capitulos(proyecto_id,grupo,grupo_nombre,num,nombre,orden) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
        [pObra, g.letra, g.nombre, cap.num, cap.nombre, co++]
      )).rows[0].id;
      let po = 0;
      for (const p of cap.partidas)
        await query(
          'INSERT INTO partidas(capitulo_id,descripcion,unidad,cantidad,factor,pu_costo,orden) VALUES($1,$2,$3,$4,$5,$6,$7)',
          [cid, p.desc, p.unidad, p.cant, p.factor || 1, p.pu, po++]
        );
    }
  }

  const pCafe = (await query(
    `INSERT INTO proyectos(tipo,nombre,cliente,estado,version,tc) VALUES('proyecto','Café del Centro — Diseño','Inversiones CDC','propuesta','V.01',6.96) RETURNING id`
  )).rows[0].id;
  for (const [n, c, p] of [['Anteproyecto', 1600, 3500], ['Planos + render', 2500, 5400]])
    await query('INSERT INTO entregables(proyecto_id,nombre,costo,precio) VALUES($1,$2,$3,$4)', [pCafe, n, c, p]);

  await query(
    `INSERT INTO proyectos(tipo,nombre,cliente,estado,version,tc) VALUES('proyecto','Clínica Norte — Diseño','Clínica Norte SRL','aceptado','V.03',6.96)`
  );

  const oCafe = (await query(
    `INSERT INTO proyectos(tipo,nombre,cliente,estado,version,tc,credito_diseno,proyecto_origen_id,ini,fin,avance)
     VALUES('obra','Café del Centro — Obra','Inversiones CDC','en curso','V.01',6.96,0,$1,'2026-04-10','2026-06-20',82) RETURNING id`,
    [pCafe]
  )).rows[0].id;
  const cCafe = (await query(
    'INSERT INTO capitulos(proyecto_id,grupo,grupo_nombre,num,nombre,orden) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
    [oCafe, 'A', 'OBRA', 1, 'OBRAS PRELIMINARES', 0]
  )).rows[0].id;
  for (const p of [['Demolición de tabiques', 'm2', 24, 1, 45], ['Limpieza y retiro', 'glb', 1, 1, 1800]])
    await query('INSERT INTO partidas(capitulo_id,descripcion,unidad,cantidad,factor,pu_costo) VALUES($1,$2,$3,$4,$5,$6)', [cCafe, p[0], p[1], p[2], p[3], p[4]]);

  await query("UPDATE proyectos SET estado_cobro='cobrado', estado_costo='pagado' WHERE nombre LIKE 'Oficinas Sony%'");
  await query("UPDATE proyectos SET estado_cobro='facturado', estado_costo='comprometido' WHERE nombre LIKE 'Clínica%'");
  await query("INSERT INTO hitos_cobro(obra_id,nombre,porcentaje,fecha,estado,orden) VALUES ($1,'Anticipo al iniciar',50,'2026-06-05','cobrado',0),($1,'Avance de obra',40,'2026-07-15','facturado',1),($1,'Entrega final',10,'2026-08-29','pendiente',2)", [pObra]);
  await query(`INSERT INTO auditoria(usuario,accion,entidad,detalle) VALUES('sistema','seed','sistema','Carga inicial de datos de ejemplo')`);
  console.log('[seed] listo.');
}

// crea (si no existe) la organización por defecto y devuelve su id
async function ensureDefaultTenant() {
  await query(
    `INSERT INTO tenants(nombre,slug,token,plan) VALUES($1,'origina',$2,'pro') ON CONFLICT (slug) DO NOTHING`,
    [DEFAULT_TENANT_NOMBRE, DEFAULT_TENANT_TOKEN]
  );
  return N((await query(`SELECT id FROM tenants WHERE slug='origina'`)).rows[0].id);
}
const N = (v) => Number(v) || 0;

// asigna a la organización por defecto cualquier fila sin tenant (datos previos a multitenant)
async function backfillTenant(defId) {
  let total = 0;
  for (const t of TENANT_TABLES) {
    const r = await query(`UPDATE ${t} SET tenant_id=$1 WHERE tenant_id IS NULL`, [defId]);
    total += r.rowCount || 0;
  }
  if (total) console.log(`[db] backfill multitenant: ${total} filas asignadas a "${DEFAULT_TENANT_NOMBRE}" (id ${defId}).`);
}

// crea (idempotente) los usuarios iniciales de la organización Origina con su rol
async function ensureDefaultUsers(defId) {
  const pass = process.env.SEED_USER_PASSWORD || 'origina2026';
  const hash = bcrypt.hashSync(pass, 10);
  const users = [
    ['José', 'jose@origina.com', 'admin'],
    ['Juan', 'juan@origina.com', 'aprobador'],
    ['Paula', 'paula@origina.com', 'administrativo'],
    ['Fernanda', 'fernanda@origina.com', 'administrativo'],
    ['Yanine', 'yanine@origina.com', 'revisor'],
  ];
  let nuevos = 0;
  for (const [nombre, email, rol] of users) {
    const r = await query(
      `INSERT INTO usuarios(tenant_id,nombre,email,password_hash,rol) VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING`,
      [defId, nombre, email, hash, rol]);
    nuevos += r.rowCount || 0;
  }
  if (nuevos) console.log(`[db] usuarios iniciales creados: ${nuevos} (clave por defecto en SEED_USER_PASSWORD → cambiar desde el panel).`);
}

async function migrate() {
  if (process.env.RESET_DB === 'true') {
    console.warn('[db] RESET_DB=true → reiniciando esquema (DROP SCHEMA public CASCADE)…');
    await query('DROP SCHEMA IF EXISTS public CASCADE');
    await query('CREATE SCHEMA public');
  }
  await query(SCHEMA);
  const defId = await ensureDefaultTenant();
  await seed();
  await backfillTenant(defId);
  await ensureDefaultUsers(defId);
  console.log('[db] esquema verificado. Organización por defecto: "' + DEFAULT_TENANT_NOMBRE + '".');
}

module.exports = { pool, query, migrate, TENANT_TABLES };
