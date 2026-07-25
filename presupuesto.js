/**
 * presupuesto.js — Fase 2. Presupuesto de una obra por SELECCIÓN de partidas del
 * catálogo + metrado (cantidad). El costo sale del APU (pu_costo calculado) y la
 * venta aplica los factores de la obra (AIU + IT). Incluye la EXPLOSIÓN DE INSUMOS
 * (material takeoff): suma todos los recursos de todas las partidas del presupuesto.
 */
const express = require('express');
const router = express.Router();
const db = require('./db');
const { requireAuth } = require('./auth');
const { requirePerm } = require('./perms');

router.use(requireAuth);
const T = (req) => req.auth.tenant_id;
const n = (v) => (Number(v) || 0);
const chainOf = (o) => (1 + n(o.gg)) * (1 + n(o.utilidad)) * (1 + n(o.it));

// pu_costo de una partida = Σ (insumo.precio × rendimiento).
const PU_SQL = `COALESCE((SELECT SUM(i.precio * a.rendimiento)
  FROM apu_lineas a JOIN insumos i ON i.id=a.insumo_id WHERE a.partida_id=p.id),0)`;

// GET /api/obras/:id/presupuesto → { obra, items, totales }
router.get('/obras/:id/presupuesto', async (req, res) => {
  try {
    const obra = (await db.query('SELECT * FROM obras WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)])).rows[0];
    if (!obra) return res.status(404).json({ error: 'Obra no encontrada' });

    const items = (await db.query(
      `SELECT pi.id, pi.cantidad, pi.orden, pi.partida_id,
              p.codigo, p.descripcion, p.unidad, c.nombre AS capitulo, c.orden AS cap_orden,
              ${PU_SQL} AS pu_costo
       FROM presupuesto_items pi
       JOIN partidas_catalogo p ON p.id=pi.partida_id
       LEFT JOIN capitulos_estandar c ON c.id=p.capitulo_id
       WHERE pi.obra_id=$1 AND pi.tenant_id=$2
       ORDER BY c.orden NULLS LAST, p.codigo`, [req.params.id, T(req)])).rows;

    const chain = chainOf(obra);
    let costo = 0;
    for (const it of items) {
      it.pu_costo = n(it.pu_costo);
      it.subtotal_costo = n(it.cantidad) * it.pu_costo;
      it.pu_venta = it.pu_costo * chain;
      it.subtotal_venta = it.subtotal_costo * chain;
      costo += it.subtotal_costo;
    }
    const venta = costo * chain;

    res.json({
      obra: { id: obra.id, nombre: obra.nombre, tipo: obra.tipo, cliente: obra.cliente,
        gg: n(obra.gg), utilidad: n(obra.utilidad), it: n(obra.it), tc: n(obra.tc) },
      items,
      totales: { costo, venta, margen: venta - costo, chain },
    });
  } catch (e) { console.error('GET /presupuesto', e); res.status(500).json({ error: 'Error interno' }); }
});

// POST /api/obras/:id/presupuesto  { partida_id, cantidad }
router.post('/obras/:id/presupuesto', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.partida_id) return res.status(400).json({ error: 'partida_id requerido' });
    if (!(await db.query('SELECT 1 FROM obras WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)])).rowCount) {
      return res.status(404).json({ error: 'Obra no encontrada' });
    }
    const { rows } = await db.query(
      'INSERT INTO presupuesto_items(tenant_id,obra_id,partida_id,cantidad) VALUES($1,$2,$3,$4) RETURNING *',
      [T(req), req.params.id, b.partida_id, n(b.cantidad)]);
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Esa partida ya está en el presupuesto' });
    console.error('POST /presupuesto', e); res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/presupuesto-items/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    const { rows } = await db.query(
      'UPDATE presupuesto_items SET cantidad=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *',
      [n(req.body.cantidad), req.params.id, T(req)]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/presupuesto-items/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    await db.query('DELETE FROM presupuesto_items WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

// GET /api/obras/:id/explosion → insumos agregados de todo el presupuesto (lista de compras).
router.get('/obras/:id/explosion', async (req, res) => {
  try {
    if (!(await db.query('SELECT 1 FROM obras WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)])).rowCount) {
      return res.status(404).json({ error: 'Obra no encontrada' });
    }
    const rows = (await db.query(
      `SELECT i.id, i.codigo, i.descripcion, i.tipo, i.unidad, i.precio,
              SUM(a.rendimiento * pi.cantidad) AS cantidad,
              SUM(a.rendimiento * pi.cantidad * i.precio) AS subtotal
       FROM presupuesto_items pi
       JOIN apu_lineas a ON a.partida_id = pi.partida_id
       JOIN insumos i ON i.id = a.insumo_id
       WHERE pi.obra_id=$1 AND pi.tenant_id=$2
       GROUP BY i.id, i.codigo, i.descripcion, i.tipo, i.unidad, i.precio
       ORDER BY i.tipo, i.codigo`, [req.params.id, T(req)])).rows;
    const total = rows.reduce((s, r) => s + n(r.subtotal), 0);
    res.json({ rows, total });
  } catch (e) { console.error('GET /explosion', e); res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
