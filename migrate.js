/**
 * migrate.js — Migración idempotente de Origina v3 (CREATE TABLE IF NOT EXISTS).
 * Corre en cada arranque (Procfile). Siembra tenant + admin si la DB está vacía,
 * y garantiza la baseline de catálogo (capítulos estándar + insumos/partida demo)
 * por cada tenant de forma idempotente.
 *
 * Fase 0: tenants, users, obras.
 * Fase 1: capitulos_estandar, insumos, partidas_catalogo, apu_lineas.
 * Fase 2: presupuesto_items (presupuesto por selección + explosión de insumos).
 * Fase 3: movimientos (libro append-only: pipeline de costo y de caja).
 * Fase 4: ordenes_compra + orden_compra_lineas (compromisos formales) y control por partida.
 * Cotizador OG: og_kv (almacén clave→valor JSON del cotizador de producción del cliente).
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');
const bcrypt = require('bcryptjs');

const CAPS_STD = ['Obras preliminares', 'Movimiento de tierras', 'Obra gruesa / estructura',
  'Instalación sanitaria', 'Instalación eléctrica', 'Acabados', 'Obras exteriores'];

const INSUMOS_DEMO = [
  ['MAT-CEM-01', 'Cemento Portland IP-30', 'material', 'bolsa', 62],
  ['MAT-ARE-01', 'Arena fina', 'material', 'm³', 120],
  ['MAT-GRA-01', 'Grava común', 'material', 'm³', 150],
  ['MAT-FE-01', 'Fierro corrugado', 'material', 'kg', 9.5],
  ['MO-ALB-01', 'Albañil', 'mano_obra', 'hora', 18],
  ['MO-AYU-01', 'Ayudante', 'mano_obra', 'hora', 12],
  ['EQ-MEZ-01', 'Mezcladora', 'equipo', 'hora', 25],
];
const PARTIDA_DEMO_APU = [['MAT-CEM-01', 7], ['MAT-ARE-01', 0.5], ['MAT-GRA-01', 0.8],
  ['MAT-FE-01', 90], ['MO-ALB-01', 8], ['MO-AYU-01', 8], ['EQ-MEZ-01', 3]];

async function run() {
  console.log('▶ Migrando Origina v3...');

  await db.query(`CREATE TABLE IF NOT EXISTS tenants (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);

  await db.query(`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'administrativo'
      CHECK (role IN ('admin','aprobador','administrativo','revisor')),
    active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, email));`);

  await db.query(`CREATE TABLE IF NOT EXISTS obras (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL DEFAULT 'obra' CHECK (tipo IN ('proyecto','obra')),
    nombre TEXT NOT NULL, cliente TEXT, ubicacion TEXT, estado TEXT NOT NULL DEFAULT 'en curso',
    gg NUMERIC(6,4) NOT NULL DEFAULT 0.10, utilidad NUMERIC(6,4) NOT NULL DEFAULT 0.15,
    it NUMERIC(6,4) NOT NULL DEFAULT 0.0309, tc NUMERIC(10,4) NOT NULL DEFAULT 6.96,
    archivado BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_obras_tenant ON obras(tenant_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_obras_tipo ON obras(tenant_id, tipo);`);

  await db.query(`CREATE TABLE IF NOT EXISTS capitulos_estandar (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    orden INTEGER NOT NULL DEFAULT 0, nombre TEXT NOT NULL, UNIQUE (tenant_id, nombre));`);

  await db.query(`CREATE TABLE IF NOT EXISTS insumos (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL, descripcion TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'material' CHECK (tipo IN ('material','mano_obra','equipo','subcontrato')),
    unidad TEXT NOT NULL DEFAULT 'u', precio NUMERIC(14,4) NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, codigo));`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_insumos_tenant ON insumos(tenant_id);`);

  await db.query(`CREATE TABLE IF NOT EXISTS partidas_catalogo (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    codigo TEXT NOT NULL, descripcion TEXT NOT NULL, unidad TEXT NOT NULL DEFAULT 'u',
    capitulo_id INTEGER REFERENCES capitulos_estandar(id) ON DELETE SET NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, codigo));`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_partcat_tenant ON partidas_catalogo(tenant_id);`);

  await db.query(`CREATE TABLE IF NOT EXISTS apu_lineas (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    partida_id INTEGER NOT NULL REFERENCES partidas_catalogo(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
    rendimiento NUMERIC(14,6) NOT NULL DEFAULT 0, UNIQUE (partida_id, insumo_id));`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_apu_partida ON apu_lineas(partida_id);`);

  // Fase 2: presupuesto de obra por selección de partidas + metrado.
  await db.query(`CREATE TABLE IF NOT EXISTS presupuesto_items (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    partida_id INTEGER NOT NULL REFERENCES partidas_catalogo(id) ON DELETE RESTRICT,
    cantidad NUMERIC(14,4) NOT NULL DEFAULT 0, orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (obra_id, partida_id));`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_presup_obra ON presupuesto_items(obra_id);`);

  // Fase 3: libro de movimientos (append-only). Pipeline de costo (egreso) y de caja (ingreso).
  await db.query(`CREATE TABLE IF NOT EXISTS movimientos (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    flujo TEXT NOT NULL CHECK (flujo IN ('egreso','ingreso')),
    etapa TEXT NOT NULL CHECK (etapa IN ('comprometido','real','contratado','facturado','cobrado')),
    monto NUMERIC(14,2) NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    concepto TEXT NOT NULL,
    contraparte TEXT,
    doc_ref TEXT,
    partida_id INTEGER REFERENCES partidas_catalogo(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ( (flujo='egreso' AND etapa IN ('comprometido','real'))
         OR (flujo='ingreso' AND etapa IN ('contratado','facturado','cobrado')) ));`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mov_obra ON movimientos(obra_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_mov_obra_flujo ON movimientos(obra_id, flujo, etapa);`);

  // Fase 4: órdenes de compra (compromisos formales) y sus líneas.
  await db.query(`CREATE TABLE IF NOT EXISTS ordenes_compra (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    obra_id INTEGER NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    proveedor TEXT NOT NULL,
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','emitida','anulada')),
    notas TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, numero));`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_oc_obra ON ordenes_compra(obra_id);`);

  await db.query(`CREATE TABLE IF NOT EXISTS orden_compra_lineas (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    orden_id INTEGER NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    partida_id INTEGER REFERENCES partidas_catalogo(id) ON DELETE SET NULL,
    insumo_id INTEGER REFERENCES insumos(id) ON DELETE SET NULL,
    descripcion TEXT NOT NULL,
    cantidad NUMERIC(14,4) NOT NULL DEFAULT 0,
    precio_unit NUMERIC(14,4) NOT NULL DEFAULT 0,
    orden INTEGER NOT NULL DEFAULT 0);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ocl_orden ON orden_compra_lineas(orden_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_ocl_partida ON orden_compra_lineas(partida_id);`);

  // Enlace opcional del libro con la OC que lo originó (compromiso o pago).
  await db.query(`ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS orden_id INTEGER
    REFERENCES ordenes_compra(id) ON DELETE SET NULL;`);

  // Cotizador OG: almacén clave→valor JSON, aislado por tenant (multiusuario).
  await db.query(`CREATE TABLE IF NOT EXISTS og_kv (
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tenant_id, key));`);

  await seedIfEmpty();
  await ensureCatalogoBaseline();
  await ensureCotizadorSeed();
  console.log('✓ Migración completa.');
}

/**
 * Carga datos del COTIZADOR desde archivos en `cotizador/seed/` hacia og_kv.
 * Soporta dos formatos por archivo:
 *   · Export completo (`__originaBase:true`): mapea a las claves de almacenamiento.
 *   · Cotización suelta (`__og:"quote"`): la agrega a quotes_index + quote_<id>.
 * Es idempotente e INCREMENTAL: por cada tenant guarda en og_kv la lista de archivos
 * ya aplicados (`__seed_files`), así podés dejar caer un nuevo export y se aplica solo
 * ese en el próximo arranque, sin re-importar lo anterior ni duplicar.
 */
async function ensureCotizadorSeed() {
  const dir = path.join(__dirname, 'cotizador', 'seed');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.json')).sort(); }
  catch { return; } // sin carpeta/archivos → nada que sembrar
  if (!files.length) return;

  const tenants = (await db.query('SELECT id FROM tenants')).rows;
  for (const { id: T } of tenants) {
    const applied = new Set((await kvGet(T, '__seed_files')) || []);
    for (const file of files) {
      if (applied.has(file)) continue;
      let data;
      try { data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); }
      catch (e) { console.warn(`[cotizador-seed] ${file} inválido, salteado:`, e.message); continue; }

      if (data && data.__originaBase) {
        await applyBaseExport(T, data);
        console.log(`[cotizador-seed] tenant ${T}: base «${file}» aplicada (${(data.quotesIndex || []).length} cotizaciones)`);
      } else if (data && data.__og === 'quote' && data.meta) {
        await applySingleQuote(T, data, file);
        console.log(`[cotizador-seed] tenant ${T}: cotización «${data.meta.codigo || file}» cargada`);
      } else {
        console.warn(`[cotizador-seed] ${file}: formato no reconocido, salteado`);
        continue;
      }
      applied.add(file);
      await kvSet(T, '__seed_files', [...applied]);
    }
  }
}

// Mapea un export completo del cotizador a las claves de og_kv.
async function applyBaseExport(T, b) {
  const setIf = async (key, val) => { if (val !== undefined) await kvSet(T, key, val); };
  await setIf('quotes_index', b.quotesIndex || []);
  for (const [id, doc] of Object.entries(b.quotes || {})) await kvSet(T, 'quote_' + id, doc);
  await setIf('lib_costs', b.libCosts);
  await setIf('lib_contractors', b.libCts);
  await setIf('lib_ordenes', b.libOrdenes);
  await setIf('og_correlativo', b.correlativo);
  await setIf('og_users', b.users);
}

// Agrega una cotización suelta (.ogq.json) al índice + su documento.
async function applySingleQuote(T, q, file) {
  const id = (q.meta && q.meta.codigo ? String(q.meta.codigo) : file).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || ('q_' + Date.now());
  await kvSet(T, 'quote_' + id, q);
  const idx = (await kvGet(T, 'quotes_index')) || [];
  if (!idx.some((r) => r.id === id)) {
    idx.push({ id, codigo: q.meta.codigo || id, proyecto: q.meta.proyecto || '', cliente: q.meta.cliente || '',
      estado: q.meta.estado || 'Cotizada', servicio: q.meta.servicio || 'obra', fecha: q.meta.fecha || '', savedAt: Date.now() });
    await kvSet(T, 'quotes_index', idx);
  }
}

async function kvGet(T, key) {
  const { rows } = await db.query('SELECT value FROM og_kv WHERE tenant_id=$1 AND key=$2', [T, key]);
  return rows.length ? rows[0].value : null;
}
async function kvSet(T, key, value) {
  await db.query(
    `INSERT INTO og_kv(tenant_id,key,value,updated_at) VALUES($1,$2,$3::jsonb,NOW())
     ON CONFLICT (tenant_id,key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [T, key, JSON.stringify(value)]);
}

async function seedIfEmpty() {
  const { rows } = await db.query('SELECT COUNT(*)::int n FROM tenants');
  if (rows[0].n > 0) return;

  const tname = process.env.SEED_TENANT_NAME || 'Origina Group';
  const email = process.env.SEED_ADMIN_EMAIL || 'jose@origina.bo';
  const pass = process.env.SEED_ADMIN_PASSWORD || 'origina2026';
  console.log(`[seed] DB vacía — creando tenant «${tname}» + admin ${email}`);

  const T = (await db.query('INSERT INTO tenants(name) VALUES($1) RETURNING id', [tname])).rows[0].id;
  const hash = await bcrypt.hash(pass, 10);
  await db.query('INSERT INTO users(tenant_id,email,password_hash,name,role) VALUES($1,$2,$3,$4,$5)',
    [T, email, hash, 'José', 'admin']);
  for (const [tipo, nombre, cliente, ubic, estado] of [
    ['obra', 'Edificio Aurora — Ejecución', 'Inmobiliaria Aurora', 'Santa Cruz', 'en curso'],
    ['proyecto', 'Oficinas Sony — Diseño', 'Sony', 'Santa Cruz', 'aceptado'],
    ['obra', 'Galpón Industrial Norte', 'Logística Norte SRL', 'Warnes', 'en curso'],
  ]) {
    await db.query('INSERT INTO obras(tenant_id,tipo,nombre,cliente,ubicacion,estado) VALUES($1,$2,$3,$4,$5,$6)',
      [T, tipo, nombre, cliente, ubic, estado]);
  }
}

/** Garantiza, por cada tenant, la baseline de catálogo (idempotente). */
async function ensureCatalogoBaseline() {
  const tenants = (await db.query('SELECT id FROM tenants')).rows;
  for (const { id: T } of tenants) {
    // Capítulos estándar (plantilla WBS).
    const caps = (await db.query('SELECT COUNT(*)::int n FROM capitulos_estandar WHERE tenant_id=$1', [T])).rows[0].n;
    if (caps === 0) {
      console.log(`[seed] tenant ${T}: cargando ${CAPS_STD.length} capítulos estándar`);
      for (let i = 0; i < CAPS_STD.length; i++) {
        await db.query('INSERT INTO capitulos_estandar(tenant_id,orden,nombre) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [T, i + 1, CAPS_STD[i]]);
      }
    }

    // Insumos + partida de ejemplo (solo si el catálogo está vacío).
    const ins = (await db.query('SELECT COUNT(*)::int n FROM insumos WHERE tenant_id=$1', [T])).rows[0].n;
    const parts = (await db.query('SELECT COUNT(*)::int n FROM partidas_catalogo WHERE tenant_id=$1', [T])).rows[0].n;
    if (ins === 0 && parts === 0) {
      console.log(`[seed] tenant ${T}: cargando insumos y partida de ejemplo`);
      const insIds = {};
      for (const [codigo, desc, tipo, unidad, precio] of INSUMOS_DEMO) {
        const r = await db.query(
          'INSERT INTO insumos(tenant_id,codigo,descripcion,tipo,unidad,precio) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
          [T, codigo, desc, tipo, unidad, precio]);
        insIds[codigo] = r.rows[0].id;
      }
      const cap = (await db.query(
        "SELECT id FROM capitulos_estandar WHERE tenant_id=$1 AND nombre='Obra gruesa / estructura'", [T])).rows[0];
      const p = (await db.query(
        'INSERT INTO partidas_catalogo(tenant_id,codigo,descripcion,unidad,capitulo_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [T, 'HA-COL-01', 'Hormigón armado en columnas', 'm³', cap ? cap.id : null])).rows[0];
      for (const [codigo, rend] of PARTIDA_DEMO_APU) {
        await db.query('INSERT INTO apu_lineas(tenant_id,partida_id,insumo_id,rendimiento) VALUES($1,$2,$3,$4)',
          [T, p.id, insIds[codigo], rend]);
      }
    }
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error('✗ Migración falló:', e); process.exit(1); });
