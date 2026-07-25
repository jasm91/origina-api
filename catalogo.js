/**
 * catalogo.js — Catálogos estandarizados (Fase 1):
 *   insumos (recursos) · capitulos estándar · partidas con APU (receta de insumos).
 * El precio unitario de una partida (pu_costo) SE CALCULA: Σ (insumo.precio × rendimiento).
 */
const express = require('express');
const router = express.Router();
const db = require('./db');
const { requireAuth } = require('./auth');
const { requirePerm } = require('./perms');

router.use(requireAuth);
const T = (req) => req.auth.tenant_id;

/* ============================ INSUMOS ============================ */

router.get('/insumos', async (req, res) => {
  try {
    const tipo = req.query.tipo || null;
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const where = ['tenant_id=$1'], params = [T(req)];
    if (tipo) { params.push(tipo); where.push(`tipo=$${params.length}`); }
    if (q) { params.push('%' + q + '%'); where.push(`(codigo ILIKE $${params.length} OR descripcion ILIKE $${params.length})`); }
    const W = where.join(' AND ');
    const total = (await db.query(`SELECT COUNT(*)::int n FROM insumos WHERE ${W}`, params)).rows[0].n;
    params.push(limit, (page - 1) * limit);
    const rows = (await db.query(
      `SELECT * FROM insumos WHERE ${W} ORDER BY codigo LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
    res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { console.error('GET /insumos', e); res.status(500).json({ error: 'Error interno' }); }
});

// Todos los insumos activos (para selects del editor de APU).
router.get('/insumos/all', async (req, res) => {
  try {
    const rows = (await db.query(
      'SELECT id, codigo, descripcion, tipo, unidad, precio FROM insumos WHERE tenant_id=$1 AND activo ORDER BY codigo',
      [T(req)])).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

const INS_FIELDS = ['codigo', 'descripcion', 'tipo', 'unidad', 'precio', 'activo'];

router.post('/insumos', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.codigo || !b.descripcion) return res.status(400).json({ error: 'Código y descripción son obligatorios' });
    const { rows } = await db.query(
      `INSERT INTO insumos(tenant_id,codigo,descripcion,tipo,unidad,precio)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [T(req), b.codigo, b.descripcion, b.tipo || 'material', b.unidad || 'u', b.precio || 0]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un insumo con ese código' });
    console.error('POST /insumos', e); res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/insumos/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [], params = [];
    for (const f of INS_FIELDS) if (f in b) { params.push(b[f]); sets.push(`${f}=$${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    params.push(req.params.id, T(req));
    const { rows } = await db.query(
      `UPDATE insumos SET ${sets.join(', ')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length} RETURNING *`, params);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Código duplicado' });
    console.error('PUT /insumos/:id', e); res.status(500).json({ error: 'Error interno' });
  }
});

router.delete('/insumos/:id', requirePerm('APPROVE'), async (req, res) => {
  try {
    await db.query('DELETE FROM insumos WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)]);
    res.json({ ok: true });
  } catch (e) {
    if (e.code === '23503') return res.status(409).json({ error: 'El insumo está usado en una partida; quitalo del APU primero' });
    res.status(500).json({ error: 'Error interno' });
  }
});

/* ============================ CAPÍTULOS ESTÁNDAR ============================ */

router.get('/capitulos', async (req, res) => {
  try {
    const rows = (await db.query('SELECT * FROM capitulos_estandar WHERE tenant_id=$1 ORDER BY orden, nombre', [T(req)])).rows;
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

router.post('/capitulos', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const { rows } = await db.query(
      'INSERT INTO capitulos_estandar(tenant_id,orden,nombre) VALUES($1,$2,$3) RETURNING *',
      [T(req), b.orden || 99, b.nombre]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe ese capítulo' });
    res.status(500).json({ error: 'Error interno' });
  }
});

/* ============================ PARTIDAS + APU ============================ */

// pu_costo calculado desde el APU (Σ insumo.precio × rendimiento).
const PU_SQL = `COALESCE((SELECT SUM(i.precio * a.rendimiento)
  FROM apu_lineas a JOIN insumos i ON i.id=a.insumo_id WHERE a.partida_id=p.id),0)`;

router.get('/partidas', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const cap = req.query.capitulo_id || null;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 20));
    const where = ['p.tenant_id=$1'], params = [T(req)];
    if (cap) { params.push(cap); where.push(`p.capitulo_id=$${params.length}`); }
    if (q) { params.push('%' + q + '%'); where.push(`(p.codigo ILIKE $${params.length} OR p.descripcion ILIKE $${params.length})`); }
    const W = where.join(' AND ');
    const total = (await db.query(`SELECT COUNT(*)::int n FROM partidas_catalogo p WHERE ${W}`, params)).rows[0].n;
    params.push(limit, (page - 1) * limit);
    const rows = (await db.query(
      `SELECT p.*, c.nombre AS capitulo, ${PU_SQL} AS pu_costo
       FROM partidas_catalogo p LEFT JOIN capitulos_estandar c ON c.id=p.capitulo_id
       WHERE ${W} ORDER BY p.codigo LIMIT $${params.length - 1} OFFSET $${params.length}`, params)).rows;
    res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { console.error('GET /partidas', e); res.status(500).json({ error: 'Error interno' }); }
});

// Partida + su APU (líneas con insumo y subtotal) + pu_costo.
router.get('/partidas/:id', async (req, res) => {
  try {
    const p = (await db.query(
      `SELECT p.*, c.nombre AS capitulo, ${PU_SQL} AS pu_costo
       FROM partidas_catalogo p LEFT JOIN capitulos_estandar c ON c.id=p.capitulo_id
       WHERE p.id=$1 AND p.tenant_id=$2`, [req.params.id, T(req)])).rows[0];
    if (!p) return res.status(404).json({ error: 'No encontrada' });
    const lineas = (await db.query(
      `SELECT a.id, a.insumo_id, a.rendimiento, i.codigo, i.descripcion, i.tipo, i.unidad, i.precio,
              (i.precio * a.rendimiento) AS subtotal
       FROM apu_lineas a JOIN insumos i ON i.id=a.insumo_id
       WHERE a.partida_id=$1 ORDER BY i.tipo, i.codigo`, [req.params.id])).rows;
    res.json({ ...p, lineas });
  } catch (e) { console.error('GET /partidas/:id', e); res.status(500).json({ error: 'Error interno' }); }
});

const PART_FIELDS = ['codigo', 'descripcion', 'unidad', 'capitulo_id', 'activo'];

router.post('/partidas', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.codigo || !b.descripcion) return res.status(400).json({ error: 'Código y descripción son obligatorios' });
    const { rows } = await db.query(
      `INSERT INTO partidas_catalogo(tenant_id,codigo,descripcion,unidad,capitulo_id)
       VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [T(req), b.codigo, b.descripcion, b.unidad || 'u', b.capitulo_id || null]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe una partida con ese código' });
    console.error('POST /partidas', e); res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/partidas/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [], params = [];
    for (const f of PART_FIELDS) if (f in b) { params.push(b[f]); sets.push(`${f}=$${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    params.push(req.params.id, T(req));
    const { rows } = await db.query(
      `UPDATE partidas_catalogo SET ${sets.join(', ')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length} RETURNING *`, params);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Código duplicado' });
    res.status(500).json({ error: 'Error interno' });
  }
});

router.delete('/partidas/:id', requirePerm('APPROVE'), async (req, res) => {
  try {
    await db.query('DELETE FROM partidas_catalogo WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

/* ---------- líneas del APU ---------- */

router.post('/partidas/:id/lineas', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.insumo_id) return res.status(400).json({ error: 'insumo_id requerido' });
    // Verificar que la partida es del tenant.
    const own = await db.query('SELECT 1 FROM partidas_catalogo WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)]);
    if (!own.rowCount) return res.status(404).json({ error: 'Partida no encontrada' });
    const { rows } = await db.query(
      'INSERT INTO apu_lineas(tenant_id,partida_id,insumo_id,rendimiento) VALUES($1,$2,$3,$4) RETURNING *',
      [T(req), req.params.id, b.insumo_id, b.rendimiento || 0]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ese insumo ya está en el APU' });
    console.error('POST /lineas', e); res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/lineas/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE apu_lineas SET rendimiento=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [req.body.rendimiento || 0, req.params.id, T(req)]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrada' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/lineas/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    await db.query('DELETE FROM apu_lineas WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
