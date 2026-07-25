/**
 * compras.js — Fase 4. Compras y control.
 * Órdenes de compra (OC) = compromisos FORMALES con proveedores. Ciclo:
 *   borrador → (emitir) → emitida → (anular) → anulada
 * Al EMITIR, la OC inyecta un movimiento «comprometido» en el libro (Fase 3) por su
 * total; al ANULAR una emitida, inyecta la reversa. Los pagos contra la OC se registran
 * como movimientos «real» ligados a la OC. Todo el dinero sigue viviendo en el libro
 * append-only; las OC solo lo alimentan de forma trazable (doc_ref = OC-<n>, orden_id).
 *
 * CONTROL POR PARTIDA: presupuestado (Fase 2) vs comprometido (líneas de OC emitidas)
 * por cada partida, con su % de avance de compromiso.
 */
const express = require('express');
const router = express.Router();
const db = require('./db');
const { requireAuth } = require('./auth');
const { requirePerm } = require('./perms');

router.use(requireAuth);
const T = (req) => req.auth.tenant_id;
const n = (v) => (Number(v) || 0);

async function getObra(req, obraId) {
  return (await db.query('SELECT * FROM obras WHERE id=$1 AND tenant_id=$2', [obraId, T(req)])).rows[0];
}
async function ocTotal(orden_id, tenant_id) {
  return n((await db.query(
    'SELECT COALESCE(SUM(cantidad*precio_unit),0) AS t FROM orden_compra_lineas WHERE orden_id=$1 AND tenant_id=$2',
    [orden_id, tenant_id])).rows[0].t);
}
async function getOC(req) {
  return (await db.query('SELECT * FROM ordenes_compra WHERE id=$1 AND tenant_id=$2',
    [req.params.id, T(req)])).rows[0];
}

// ── Listado de OC de una obra (con total y pagado) ─────────────────────────────
router.get('/obras/:id/ordenes', async (req, res) => {
  try {
    if (!(await getObra(req, req.params.id))) return res.status(404).json({ error: 'Obra no encontrada' });
    const rows = (await db.query(
      `SELECT o.id, o.numero, o.proveedor, o.fecha, o.estado, o.notas,
              COALESCE((SELECT SUM(l.cantidad*l.precio_unit) FROM orden_compra_lineas l WHERE l.orden_id=o.id),0) AS total,
              COALESCE((SELECT SUM(m.monto) FROM movimientos m WHERE m.orden_id=o.id AND m.etapa='real'),0) AS pagado
       FROM ordenes_compra o
       WHERE o.obra_id=$1 AND o.tenant_id=$2
       ORDER BY o.numero DESC`, [req.params.id, T(req)])).rows;
    res.json({ rows });
  } catch (e) { console.error('GET /ordenes', e); res.status(500).json({ error: 'Error interno' }); }
});

// ── Detalle de una OC (cabecera + líneas) ──────────────────────────────────────
router.get('/ordenes/:id', async (req, res) => {
  try {
    const oc = await getOC(req);
    if (!oc) return res.status(404).json({ error: 'OC no encontrada' });
    const lineas = (await db.query(
      `SELECT l.*, p.codigo AS partida_codigo, i.codigo AS insumo_codigo
       FROM orden_compra_lineas l
       LEFT JOIN partidas_catalogo p ON p.id=l.partida_id
       LEFT JOIN insumos i ON i.id=l.insumo_id
       WHERE l.orden_id=$1 AND l.tenant_id=$2 ORDER BY l.orden, l.id`, [oc.id, T(req)])).rows;
    for (const l of lineas) l.subtotal = n(l.cantidad) * n(l.precio_unit);
    res.json({ orden: oc, lineas, total: lineas.reduce((s, l) => s + l.subtotal, 0) });
  } catch (e) { console.error('GET /ordenes/:id', e); res.status(500).json({ error: 'Error interno' }); }
});

// ── Crear OC (borrador) con líneas opcionales ──────────────────────────────────
router.post('/obras/:id/ordenes', requirePerm('WRITE'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.proveedor || !String(b.proveedor).trim()) return res.status(400).json({ error: 'proveedor requerido' });
    if (!(await getObra(req, req.params.id))) return res.status(404).json({ error: 'Obra no encontrada' });

    const numero = n((await db.query(
      'SELECT COALESCE(MAX(numero),0)+1 AS x FROM ordenes_compra WHERE tenant_id=$1', [T(req)])).rows[0].x);
    const oc = (await db.query(
      `INSERT INTO ordenes_compra(tenant_id,obra_id,numero,proveedor,fecha,notas,created_by)
       VALUES($1,$2,$3,$4,COALESCE($5,CURRENT_DATE),$6,$7) RETURNING *`,
      [T(req), req.params.id, numero, String(b.proveedor).trim(), b.fecha || null, b.notas || null, req.auth.user_id])).rows[0];

    if (Array.isArray(b.lineas)) {
      let i = 0;
      for (const l of b.lineas) {
        if (!l || !String(l.descripcion || '').trim()) continue;
        await db.query(
          `INSERT INTO orden_compra_lineas(tenant_id,orden_id,partida_id,insumo_id,descripcion,cantidad,precio_unit,orden)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [T(req), oc.id, l.partida_id || null, l.insumo_id || null, String(l.descripcion).trim(),
           n(l.cantidad), n(l.precio_unit), i++]);
      }
    }
    res.status(201).json(oc);
  } catch (e) { console.error('POST /ordenes', e); res.status(500).json({ error: 'Error interno' }); }
});

// ── Editar cabecera (solo borrador) ───────────────────────────────────────────
router.put('/ordenes/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    const oc = await getOC(req);
    if (!oc) return res.status(404).json({ error: 'OC no encontrada' });
    if (oc.estado !== 'borrador') return res.status(409).json({ error: 'Solo se edita en borrador' });
    const b = req.body || {};
    const { rows } = await db.query(
      `UPDATE ordenes_compra SET proveedor=COALESCE($1,proveedor), fecha=COALESCE($2,fecha), notas=$3
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [b.proveedor ? String(b.proveedor).trim() : null, b.fecha || null, b.notas ?? oc.notas, oc.id, T(req)]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Líneas (solo borrador) ────────────────────────────────────────────────────
router.post('/ordenes/:id/lineas', requirePerm('WRITE'), async (req, res) => {
  try {
    const oc = await getOC(req);
    if (!oc) return res.status(404).json({ error: 'OC no encontrada' });
    if (oc.estado !== 'borrador') return res.status(409).json({ error: 'Solo se edita en borrador' });
    const l = req.body || {};
    if (!String(l.descripcion || '').trim()) return res.status(400).json({ error: 'descripcion requerida' });
    const { rows } = await db.query(
      `INSERT INTO orden_compra_lineas(tenant_id,orden_id,partida_id,insumo_id,descripcion,cantidad,precio_unit,orden)
       VALUES($1,$2,$3,$4,$5,$6,$7,COALESCE((SELECT MAX(orden)+1 FROM orden_compra_lineas WHERE orden_id=$2),0)) RETURNING *`,
      [T(req), oc.id, l.partida_id || null, l.insumo_id || null, String(l.descripcion).trim(), n(l.cantidad), n(l.precio_unit)]);
    res.status(201).json(rows[0]);
  } catch (e) { console.error('POST /lineas', e); res.status(500).json({ error: 'Error interno' }); }
});

router.put('/oc-lineas/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    const l = (await db.query(
      `SELECT ocl.*, oc.estado FROM orden_compra_lineas ocl JOIN ordenes_compra oc ON oc.id=ocl.orden_id
       WHERE ocl.id=$1 AND ocl.tenant_id=$2`, [req.params.id, T(req)])).rows[0];
    if (!l) return res.status(404).json({ error: 'Línea no encontrada' });
    if (l.estado !== 'borrador') return res.status(409).json({ error: 'Solo se edita en borrador' });
    const b = req.body || {};
    const { rows } = await db.query(
      `UPDATE orden_compra_lineas SET descripcion=COALESCE($1,descripcion), cantidad=$2, precio_unit=$3, partida_id=$4
       WHERE id=$5 AND tenant_id=$6 RETURNING *`,
      [b.descripcion ? String(b.descripcion).trim() : null, n(b.cantidad), n(b.precio_unit), b.partida_id || null, req.params.id, T(req)]);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

router.delete('/oc-lineas/:id', requirePerm('WRITE'), async (req, res) => {
  try {
    const l = (await db.query(
      `SELECT ocl.id, oc.estado FROM orden_compra_lineas ocl JOIN ordenes_compra oc ON oc.id=ocl.orden_id
       WHERE ocl.id=$1 AND ocl.tenant_id=$2`, [req.params.id, T(req)])).rows[0];
    if (!l) return res.status(404).json({ error: 'Línea no encontrada' });
    if (l.estado !== 'borrador') return res.status(409).json({ error: 'Solo se edita en borrador' });
    await db.query('DELETE FROM orden_compra_lineas WHERE id=$1 AND tenant_id=$2', [req.params.id, T(req)]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error interno' }); }
});

// ── Emitir OC → compromiso en el libro (APPROVE) ──────────────────────────────
router.post('/ordenes/:id/emitir', requirePerm('APPROVE'), async (req, res) => {
  try {
    const oc = await getOC(req);
    if (!oc) return res.status(404).json({ error: 'OC no encontrada' });
    if (oc.estado !== 'borrador') return res.status(409).json({ error: `No se puede emitir una OC ${oc.estado}` });
    const total = await ocTotal(oc.id, T(req));
    if (total <= 0) return res.status(400).json({ error: 'La OC no tiene monto (agregá líneas)' });

    await db.query('UPDATE ordenes_compra SET estado=$1 WHERE id=$2 AND tenant_id=$3', ['emitida', oc.id, T(req)]);
    await db.query(
      `INSERT INTO movimientos(tenant_id,obra_id,flujo,etapa,monto,concepto,contraparte,doc_ref,orden_id,created_by)
       VALUES($1,$2,'egreso','comprometido',$3,$4,$5,$6,$7,$8)`,
      [T(req), oc.obra_id, total, `Emisión OC-${oc.numero}`, oc.proveedor, `OC-${oc.numero}`, oc.id, req.auth.user_id]);
    res.json({ ok: true, estado: 'emitida', comprometido: total });
  } catch (e) { console.error('POST /emitir', e); res.status(500).json({ error: 'Error interno' }); }
});

// ── Anular OC → reversa del compromiso si estaba emitida (APPROVE) ─────────────
router.post('/ordenes/:id/anular', requirePerm('APPROVE'), async (req, res) => {
  try {
    const oc = await getOC(req);
    if (!oc) return res.status(404).json({ error: 'OC no encontrada' });
    if (oc.estado === 'anulada') return res.status(409).json({ error: 'La OC ya está anulada' });
    if (oc.estado === 'emitida') {
      const total = await ocTotal(oc.id, T(req));
      await db.query(
        `INSERT INTO movimientos(tenant_id,obra_id,flujo,etapa,monto,concepto,contraparte,doc_ref,orden_id,created_by)
         VALUES($1,$2,'egreso','comprometido',$3,$4,$5,$6,$7,$8)`,
        [T(req), oc.obra_id, -total, `Anulación OC-${oc.numero}`, oc.proveedor, `OC-${oc.numero}`, oc.id, req.auth.user_id]);
    }
    await db.query('UPDATE ordenes_compra SET estado=$1 WHERE id=$2 AND tenant_id=$3', ['anulada', oc.id, T(req)]);
    res.json({ ok: true, estado: 'anulada' });
  } catch (e) { console.error('POST /anular', e); res.status(500).json({ error: 'Error interno' }); }
});

// ── Registrar pago contra una OC emitida → movimiento «real» (APPROVE) ─────────
router.post('/ordenes/:id/pago', requirePerm('APPROVE'), async (req, res) => {
  try {
    const oc = await getOC(req);
    if (!oc) return res.status(404).json({ error: 'OC no encontrada' });
    if (oc.estado !== 'emitida') return res.status(409).json({ error: 'Solo se paga una OC emitida' });
    const monto = n((req.body || {}).monto);
    if (monto <= 0) return res.status(400).json({ error: 'monto debe ser > 0' });
    await db.query(
      `INSERT INTO movimientos(tenant_id,obra_id,flujo,etapa,monto,fecha,concepto,contraparte,doc_ref,orden_id,created_by)
       VALUES($1,$2,'egreso','real',$3,COALESCE($4,CURRENT_DATE),$5,$6,$7,$8,$9)`,
      [T(req), oc.obra_id, monto, req.body.fecha || null, `Pago OC-${oc.numero}`, oc.proveedor, `OC-${oc.numero}`, oc.id, req.auth.user_id]);
    res.status(201).json({ ok: true, pagado: monto });
  } catch (e) { console.error('POST /pago', e); res.status(500).json({ error: 'Error interno' }); }
});

// ── Control por partida: presupuestado vs comprometido (OC emitidas) ───────────
router.get('/obras/:id/control', async (req, res) => {
  try {
    if (!(await getObra(req, req.params.id))) return res.status(404).json({ error: 'Obra no encontrada' });

    // Presupuestado por partida (Fase 2 × APU).
    const presup = (await db.query(
      `SELECT pi.partida_id, p.codigo, p.descripcion, c.nombre AS capitulo, c.orden AS cap_orden,
              pi.cantidad * COALESCE((SELECT SUM(i.precio*a.rendimiento) FROM apu_lineas a
                JOIN insumos i ON i.id=a.insumo_id WHERE a.partida_id=pi.partida_id),0) AS presupuestado
       FROM presupuesto_items pi
       JOIN partidas_catalogo p ON p.id=pi.partida_id
       LEFT JOIN capitulos_estandar c ON c.id=p.capitulo_id
       WHERE pi.obra_id=$1 AND pi.tenant_id=$2`, [req.params.id, T(req)])).rows;

    // Comprometido por partida (líneas de OC emitidas).
    const comp = (await db.query(
      `SELECT l.partida_id, COALESCE(SUM(l.cantidad*l.precio_unit),0) AS comprometido
       FROM orden_compra_lineas l
       JOIN ordenes_compra o ON o.id=l.orden_id
       WHERE o.obra_id=$1 AND o.tenant_id=$2 AND o.estado='emitida' AND l.partida_id IS NOT NULL
       GROUP BY l.partida_id`, [req.params.id, T(req)])).rows;
    const compMap = Object.fromEntries(comp.map((r) => [r.partida_id, n(r.comprometido)]));

    const rows = presup.map((r) => {
      const presupuestado = n(r.presupuestado);
      const comprometido = compMap[r.partida_id] || 0;
      return {
        partida_id: r.partida_id, codigo: r.codigo, descripcion: r.descripcion, capitulo: r.capitulo,
        presupuestado, comprometido, saldo: presupuestado - comprometido,
        avance: presupuestado > 0 ? comprometido / presupuestado : 0,
      };
    }).sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

    // Comprometido sin partida asignada (líneas de OC emitidas sin partida).
    const sinPartida = n((await db.query(
      `SELECT COALESCE(SUM(l.cantidad*l.precio_unit),0) AS x
       FROM orden_compra_lineas l JOIN ordenes_compra o ON o.id=l.orden_id
       WHERE o.obra_id=$1 AND o.tenant_id=$2 AND o.estado='emitida' AND l.partida_id IS NULL`,
      [req.params.id, T(req)])).rows[0].x);

    const tot = rows.reduce((a, r) => ({
      presupuestado: a.presupuestado + r.presupuestado,
      comprometido: a.comprometido + r.comprometido,
    }), { presupuestado: 0, comprometido: 0 });

    res.json({ rows, sin_partida: sinPartida, totales: { ...tot, comprometido_total: tot.comprometido + sinPartida } });
  } catch (e) { console.error('GET /control', e); res.status(500).json({ error: 'Error interno' }); }
});

module.exports = router;
