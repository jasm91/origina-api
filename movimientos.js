/**
 * movimientos.js — Fase 3. Dinero claro.
 * Libro de movimientos APPEND-ONLY (no se editan importes históricos; se corrigen con
 * un movimiento inverso). Dos pipelines sobre la misma obra:
 *   · COSTO (egreso):  Presupuesto → Comprometido → Real
 *   · CAJA  (ingreso): Contratado  → Facturado   → Cobrado
 * El "tablero" cruza el presupuesto (Fase 2) contra lo realmente comprometido/gastado
 * y contra la caja del cliente, y expone las brechas (por comprometer, por cobrar, etc.).
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

const ETAPAS = {
  egreso: ['comprometido', 'real'],
  ingreso: ['contratado', 'facturado', 'cobrado'],
};

// Σ del presupuesto (costo directo) desde los items × APU. Reusa la fórmula de Fase 2.
const PRESUP_COSTO_SQL = `COALESCE((
  SELECT SUM(pi.cantidad * COALESCE((
     SELECT SUM(i.precio * a.rendimiento) FROM apu_lineas a
     JOIN insumos i ON i.id=a.insumo_id WHERE a.partida_id=pi.partida_id),0))
  FROM presupuesto_items pi WHERE pi.obra_id=o.id),0)`;

async function getObra(req) {
  return (await db.query('SELECT * FROM obras WHERE id=$1 AND tenant_id=$2',
    [req.params.id, T(req)])).rows[0];
}

// GET /api/obras/:id/movimientos → lista (más recientes primero)
router.get('/obras/:id/movimientos', async (req, res) => {
  try {
    if (!(await getObra(req))) return res.status(404).json({ error: 'Obra no encontrada' });
    const rows = (await db.query(
      `SELECT m.id, m.flujo, m.etapa, m.monto, m.fecha, m.concepto, m.contraparte,
              m.doc_ref, m.partida_id, p.codigo AS partida_codigo, u.name AS creado_por
       FROM movimientos m
       LEFT JOIN partidas_catalogo p ON p.id=m.partida_id
       LEFT JOIN users u ON u.id=m.created_by
       WHERE m.obra_id=$1 AND m.tenant_id=$2
       ORDER BY m.fecha DESC, m.id DESC`, [req.params.id, T(req)])).rows;
    res.json({ rows });
  } catch (e) { console.error('GET /movimientos', e); res.status(500).json({ error: 'Error interno' }); }
});

// POST /api/obras/:id/movimientos  { flujo, etapa, monto, fecha?, concepto, contraparte?, doc_ref?, partida_id? }
router.post('/obras/:id/movimientos', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!ETAPAS[b.flujo]) return res.status(400).json({ error: 'flujo inválido (egreso|ingreso)' });
    if (!ETAPAS[b.flujo].includes(b.etapa)) {
      return res.status(400).json({ error: `etapa inválida para ${b.flujo}: ${ETAPAS[b.flujo].join('|')}` });
    }
    if (!b.concepto || !String(b.concepto).trim()) return res.status(400).json({ error: 'concepto requerido' });
    if (!Number.isFinite(Number(b.monto)) || Number(b.monto) === 0) {
      return res.status(400).json({ error: 'monto debe ser distinto de 0' });
    }
    if (!(await getObra(req))) return res.status(404).json({ error: 'Obra no encontrada' });

    const { rows } = await db.query(
      `INSERT INTO movimientos(tenant_id,obra_id,flujo,etapa,monto,fecha,concepto,contraparte,doc_ref,partida_id,created_by)
       VALUES($1,$2,$3,$4,$5,COALESCE($6,CURRENT_DATE),$7,$8,$9,$10,$11) RETURNING *`,
      [T(req), req.params.id, b.flujo, b.etapa, n(b.monto), b.fecha || null,
       String(b.concepto).trim(), b.contraparte || null, b.doc_ref || null,
       b.partida_id || null, req.auth.user_id]);
    res.status(201).json(rows[0]);
  } catch (e) { console.error('POST /movimientos', e); res.status(500).json({ error: 'Error interno' }); }
});

// DELETE /api/movimientos/:id  (solo APPROVE — quitar un asiento cargado por error)
router.delete('/movimientos/:id', requirePerm('APPROVE'), async (req, res) => {
  try {
    await db.query('DELETE FROM movimientos WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

// GET /api/obras/:id/tablero → resumen de costo y caja + brechas.
router.get('/obras/:id/tablero', async (req, res) => {
  try {
    const obra = await getObra(req);
    if (!obra) return res.status(404).json({ error: 'Obra no encontrada' });
    const chain = chainOf(obra);

    // Presupuesto (Fase 2): costo directo y venta.
    const presupuestoCosto = n((await db.query(
      `SELECT ${PRESUP_COSTO_SQL} AS c FROM obras o WHERE o.id=$1 AND o.tenant_id=$2`,
      [req.params.id, T(req)])).rows[0].c);
    const presupuestoVenta = presupuestoCosto * chain;

    // Sumas del libro por etapa.
    const sums = (await db.query(
      `SELECT flujo, etapa, COALESCE(SUM(monto),0) AS total
       FROM movimientos WHERE obra_id=$1 AND tenant_id=$2
       GROUP BY flujo, etapa`, [req.params.id, T(req)])).rows;
    const S = (flujo, etapa) => n((sums.find((r) => r.flujo === flujo && r.etapa === etapa) || {}).total);

    const comprometido = S('egreso', 'comprometido');
    const real = S('egreso', 'real');
    const contratado = S('ingreso', 'contratado');
    const facturado = S('ingreso', 'facturado');
    const cobrado = S('ingreso', 'cobrado');

    res.json({
      obra: { id: obra.id, nombre: obra.nombre, chain },
      // Pipeline de COSTO
      costo: {
        presupuesto: presupuestoCosto,
        comprometido,
        real,
        por_comprometer: presupuestoCosto - comprometido,   // saldo de compras aún sin OC/contrato
        desviacion: real - presupuestoCosto,                // >0 = sobrecosto
      },
      // Pipeline de CAJA (cliente)
      caja: {
        objetivo_venta: presupuestoVenta,   // meta según presupuesto
        contratado,
        facturado,
        cobrado,
        por_facturar: contratado - facturado,
        por_cobrar: facturado - cobrado,
      },
      // Resultado
      resultado: {
        margen_presupuestado: presupuestoVenta - presupuestoCosto,
        caja_neta: cobrado - real,                  // efectivo: cobrado del cliente − pagado a proveedores
        margen_real_parcial: facturado - real,      // reconocido (facturado) − gastado real
      },
    });
  } catch (e) { console.error('GET /tablero', e); res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
