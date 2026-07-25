/**
 * migrate.js — Migración idempotente de Origina v3 (CREATE TABLE IF NOT EXISTS).
 * Corre en cada arranque (Procfile). Siembra tenant + admin si la DB está vacía.
 * Envs: SEED_TENANT_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.
 *
 * Fase 0 (fundación): tenants, users, obras. Las Fases siguientes agregan
 * catálogos (insumos, partidas/APU), presupuesto y libro de movimientos.
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

  // Obra unificada (diseño = 'proyecto', ejecución = 'obra').
  await db.query(`
    CREATE TABLE IF NOT EXISTS obras (
      id SERIAL PRIMARY KEY,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      tipo TEXT NOT NULL DEFAULT 'obra' CHECK (tipo IN ('proyecto','obra')),
      nombre TEXT NOT NULL,
      cliente TEXT,
      ubicacion TEXT,
      estado TEXT NOT NULL DEFAULT 'en curso',
      -- Factores de venta (AIU + IT), estándar del rubro.
      gg NUMERIC(6,4) NOT NULL DEFAULT 0.10,        -- Administración + Imprevistos
      utilidad NUMERIC(6,4) NOT NULL DEFAULT 0.15,  -- Utilidad
      it NUMERIC(6,4) NOT NULL DEFAULT 0.0309,      -- Impuesto a las Transacciones
      tc NUMERIC(10,4) NOT NULL DEFAULT 6.96,
      archivado BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_obras_tenant ON obras(tenant_id);`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_obras_tipo ON obras(tenant_id, tipo);`);

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
  const hash = await bcrypt.hash(pass, 10);
  await db.query(
    'INSERT INTO users(tenant_id,email,password_hash,name,role) VALUES($1,$2,$3,$4,$5)',
    [t.id, email, hash, 'José', 'admin']
  );
  // Algunas obras de ejemplo para ver la lista.
  const demo = [
    ['obra', 'Edificio Aurora — Ejecución', 'Inmobiliaria Aurora', 'Santa Cruz', 'en curso'],
    ['proyecto', 'Oficinas Sony — Diseño', 'Sony', 'Santa Cruz', 'aceptado'],
    ['obra', 'Galpón Industrial Norte', 'Logística Norte SRL', 'Warnes', 'en curso'],
  ];
  for (const [tipo, nombre, cliente, ubic, estado] of demo) {
    await db.query(
      'INSERT INTO obras(tenant_id,tipo,nombre,cliente,ubicacion,estado) VALUES($1,$2,$3,$4,$5,$6)',
      [t.id, tipo, nombre, cliente, ubic, estado]
    );
  }
}

run().then(() => process.exit(0)).catch((e) => { console.error('✗ Migración falló:', e); process.exit(1); });
