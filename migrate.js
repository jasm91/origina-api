/**
 * migrate.js — Migración idempotente de Origina v3 (CREATE TABLE IF NOT EXISTS).
 * Corre en cada arranque (Procfile). Siembra tenant + admin si la DB está vacía.
 * Envs: SEED_TENANT_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
 *
 * Fase 0: tenants, users, obras.
 * Fase 1 (catálogos/APU): capitulos_estandar, insumos, partidas_catalogo, apu_lineas.
 */
require('dotenv').config();
const db = require('./db');
const bcrypt = require('bcryptjs');

async function run() {
  console.log('▶ Migrando Origina v3...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'administrativo'
        CHECK (role IN ('admin','aprobador','administrativo','revisor')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, email)
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS obras (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL DEFAULT 'obra' CHECK (tipo IN ('proyecto','obra')),
      nombre TEXT NOT NULL,
      cliente TEXT,
      ubicacion TEXT,
      estado TEXT NOT NULL DEFAULT 'en curso',
      gg NUMERIC(6,4) NOT NULL DEFAULT 0.10,
      utilidad NUMERIC(6,4) NOT NULL DEFAULT 0.15,
      it NUMERIC(6,4) NOT NULL DEFAULT 0.0309,
      tc NUMERIC(10,4) NOT NULL DEFAULT 6.96,
      archivado BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_obras_tenant ON obras(tenant_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_obras_tipo ON obras(tenant_id, tipo);`);

  // ---------- Fase 1: catálogos ----------

  // Capítulos estándar (plantilla WBS reutilizable).
  await db.query(`
    CREATE TABLE IF NOT EXISTS capitulos_estandar (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      orden INTEGER NOT NULL DEFAULT 0,
      nombre TEXT NOT NULL,
      UNIQUE (tenant_id, nombre)
    );
  `);

  // Insumos / recursos (materiales, mano de obra, equipo, subcontrato).
  await db.query(`
    CREATE TABLE IF NOT EXISTS insumos (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      codigo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'material'
        CHECK (tipo IN ('material','mano_obra','equipo','subcontrato')),
      unidad TEXT NOT NULL DEFAULT 'u',
      precio NUMERIC(14,4) NOT NULL DEFAULT 0,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, codigo)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_insumos_tenant ON insumos(tenant_id);`);

  // Partidas del catálogo (biblioteca reutilizable). pu_costo se CALCULA del APU.
  await db.query(`
    CREATE TABLE IF NOT EXISTS partidas_catalogo (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      codigo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      unidad TEXT NOT NULL DEFAULT 'u',
      capitulo_id INTEGER REFERENCES capitulos_estandar(id) ON DELETE SET NULL,
      activo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, codigo)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_partcat_tenant ON partidas_catalogo(tenant_id);`);

  // Líneas del APU: composición de una partida (insumo × rendimiento).
  await db.query(`
    CREATE TABLE IF NOT EXISTS apu_lineas (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      partida_id INTEGER NOT NULL REFERENCES partidas_catalogo(id) ON DELETE CASCADE,
      insumo_id INTEGER NOT NULL REFERENCES insumos(id) ON DELETE RESTRICT,
      rendimiento NUMERIC(14,6) NOT NULL DEFAULT 0,
      UNIQUE (partida_id, insumo_id)
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_apu_partida ON apu_lineas(partida_id);`);

  await seedIfEmpty();
  console.log('✓ Migración completa.');
}

async function seedIfEmpty() {
  const { rows } = await db.query('SELECT COUNT(*)::int n FROM tenants');
  if (rows[0].n > 0) return;

  const tname = process.env.SEED_TENANT_NAME || 'Origina Group';
  const email = process.env.SEED_ADMIN_EMAIL || 'jose@origina.bo';
  const pass = process.env.SEED_ADMIN_PASSWORD || 'origina2026';
  console.log(`[seed] DB vacía — creando tenant «${tname}» + admin ${email}`);

  const t = (await db.query('INSERT INTO tenants(name) VALUES($1) RETURNING id', [tname])).rows[0];
  const T = t.id;
  const hash = await bcrypt.hash(pass, 10);
  await db.query(
    'INSERT INTO users(tenant_id,email,password_hash,name,role) VALUES($1,$2,$3,$4,$5)',
    [T, email, hash, 'José', 'admin']
  );

  for (const [tipo, nombre, cliente, ubic, estado] of [
    ['obra', 'Edificio Aurora — Ejecución', 'Inmobiliaria Aurora', 'Santa Cruz', 'en curso'],
    ['proyecto', 'Oficinas Sony — Diseño', 'Sony', 'Santa Cruz', 'aceptado'],
    ['obra', 'Galpón Industrial Norte', 'Logística Norte SRL', 'Warnes', 'en curso'],
  ]) {
    await db.query('INSERT INTO obras(tenant_id,tipo,nombre,cliente,ubicacion,estado) VALUES($1,$2,$3,$4,$5,$6)',
      [T, tipo, nombre, cliente, ubic, estado]);
  }

  // Capítulos estándar (plantilla WBS).
  const capsStd = ['Obras preliminares', 'Movimiento de tierras', 'Obra gruesa / estructura',
    'Instalación sanitaria', 'Instalación eléctrica', 'Acabados', 'Obras exteriores'];
  const capIds = {};
  for (let i = 0; i < capsStd.length; i++) {
    const r = await db.query('INSERT INTO capitulos_estandar(tenant_id,orden,nombre) VALUES($1,$2,$3) RETURNING id',
      [T, i + 1, capsStd[i]]);
    capIds[capsStd[i]] = r.rows[0].id;
  }

  // Insumos de ejemplo.
  const insumos = [
    ['MAT-CEM-01', 'Cemento Portland IP-30', 'material', 'bolsa', 62],
    ['MAT-ARE-01', 'Arena fina', 'material', 'm³', 120],
    ['MAT-GRA-01', 'Grava común', 'material', 'm³', 150],
    ['MAT-FE-01', 'Fierro corrugado', 'material', 'kg', 9.5],
    ['MO-ALB-01', 'Albañil', 'mano_obra', 'hora', 18],
    ['MO-AYU-01', 'Ayudante', 'mano_obra', 'hora', 12],
    ['EQ-MEZ-01', 'Mezcladora', 'equipo', 'hora', 25],
  ];
  const insIds = {};
  for (const [codigo, desc, tipo, unidad, precio] of insumos) {
    const r = await db.query(
      'INSERT INTO insumos(tenant_id,codigo,descripcion,tipo,unidad,precio) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [T, codigo, desc, tipo, unidad, precio]);
    insIds[codigo] = r.rows[0].id;
  }

  // Partida de ejemplo con APU (Hº Aº columnas · m³).
  const p = (await db.query(
    'INSERT INTO partidas_catalogo(tenant_id,codigo,descripcion,unidad,capitulo_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [T, 'HA-COL-01', 'Hormigón armado en columnas', 'm³', capIds['Obra gruesa / estructura']])).rows[0];
  const apu = [
    ['MAT-CEM-01', 7], ['MAT-ARE-01', 0.5], ['MAT-GRA-01', 0.8], ['MAT-FE-01', 90],
    ['MO-ALB-01', 8], ['MO-AYU-01', 8], ['EQ-MEZ-01', 3],
  ];
  for (const [codigo, rend] of apu) {
    await db.query('INSERT INTO apu_lineas(tenant_id,partida_id,insumo_id,rendimiento) VALUES($1,$2,$3,$4)',
      [T, p.id, insIds[codigo], rend]);
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error('✗ Migración falló:', e); process.exit(1); });
