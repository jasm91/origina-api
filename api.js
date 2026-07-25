/**
 * api.js — Negocio de Origina v3 (Fase 0: contexto + obras paginadas).
 * Todo requiere JWT y filtra por tenant_id. Payloads chicos (paginación) para
 * que las listas vuelen — a diferencia del v2 que traía la obra entera.
 */
const express = require('express');
const router = express.Router();
const db = require('./db');
const { requireAuth } = require('./auth');
const { ROLE_PERMS, requirePerm } = require('./perms');

router.use(requireAuth);

// Contexto liviano para el arranque del front (usuario + permisos + contadores).
router.get('/context', async (req, res) => {
  try {
    const T = req.auth.tenant_id;
    const c = (await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE tipo='proyecto' AND NOT archivado)::int AS proyectos,
         COUNT(*) FILTER (WHERE tipo='obra' AND NOT archivado)::int AS obras
       FROM obras WHERE tenant_id=$1`, [T]
    )).rows[0];
    const cat = (await db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM insumos WHERE tenant_id=$1) AS insumos,
         (SELECT COUNT(*)::int FROM partidas_catalogo WHERE tenant_id=$1) AS partidas`, [T]
    )).rows[0];
    c.insumos = cat.insumos; c.partidas = cat.partidas;
    res.json({
      user: { id: req.auth.user_id, name: req.auth.name, role: req.auth.role },
      perms: ROLE_PERMS[req.auth.role] || [],
      counts: c,
    });
  } catch (e) { console.error('GET /context', e); res.status(500).json({ error: 'Error interno' }); }
});

// GET /api/obras?tipo=&q=&page=&limit=  → { rows, total, page, pages }
router.get('/obras', async (req, res) => {
  try {
    const T = req.auth.tenant_id;
    const tipo = req.query.tipo || null;
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    const where = ['tenant_id=$1', 'NOT archivado'];
    const params = [T];
    if (tipo) { params.push(tipo); where.push(`tipo=$${params.length}`); }
    if (q) { params.push('%' + q + '%'); where.push(`(nombre ILIKE $${params.length} OR cliente ILIKE $${params.length})`); }
    const W = where.join(' AND ');

    const total = (await db.query(`SELECT COUNT(*)::int n FROM obras WHERE ${W}`, params)).rows[0].n;
    params.push(limit, offset);
    const rows = (await db.query(
      `SELECT id, tipo, nombre, cliente, ubicacion, estado, created_at
       FROM obras WHERE ${W} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )).rows;

    res.json({ rows, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { console.error('GET /obras', e); res.status(500).json({ error: 'Error interno' }); }
});

router.get('/obras/:id', async (req, res) => {
  try {
    const T = req.auth.tenant_id;
    const { rows } = await db.query('SELECT * FROM obras WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) { console.error('GET /obras/:id', e); res.status(500).json({ error: 'Error interno' }); }
});

const WFIELDS = ['tipo', 'nombre', 'cliente', 'ubicacion', 'estado', 'gg', 'utilidad', 'it', 'tc', 'archivado'];

router.post('/obras', requirePerm('WRITE'), async (req, res) => {
  try {
    const T = req.auth.tenant_id;
    const b = req.body || {};
    const { rows } = await db.query(
      `INSERT INTO obras(tenant_id,tipo,nombre,cliente,ubicacion,estado)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [T, b.tipo === 'proyecto' ? 'proyecto' : 'obra', b.nombre || 'Nueva obra',
        b.cliente || null, b.ubicacion || null, b.estado || 'en curso']
    );
    res.status(201).json(rows[0]);
  } catch (e) { console.error('POST /obras', e); res.status(500).json({ error: 'Error interno' }); }
});

router.put('/obras/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    const T = req.auth.tenant_id;
    const b = req.body || {};
    const sets = [], params = [];
    for (const f of WFIELDS) if (f in b) { params.push(b[f]); sets.push(`${f}=$${params.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
    params.push(req.params.id, T);
    const { rows } = await db.query(
      `UPDATE obras SET ${sets.join(', ')} WHERE id=$${params.length - 1} AND tenant_id=$${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) { console.error('PUT /obras/:id', e); res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/obras/:id', requirePerm('APPROVE'), async (req, res) => {
  try {
    const T = req.auth.tenant_id;
    await db.query('DELETE FROM obras WHERE id=$1 AND tenant_id=$2', [req.params.id, T]);
    res.json({ ok: true });
  } catch (e) { console.error('DELETE /obras/:id', e); res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
