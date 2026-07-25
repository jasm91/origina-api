import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, fmt, fdate, getUser } from '../api';

const tipoLabel = { material: 'Material', mano_obra: 'Mano de obra', equipo: 'Equipo', subcontrato: 'Subcontrato' };
const etapaLabel = { comprometido: 'Comprometido', real: 'Pago real', contratado: 'Contratado', facturado: 'Facturado', cobrado: 'Cobrado' };
const ETAPAS_POR_FLUJO = { egreso: ['comprometido', 'real'], ingreso: ['contratado', 'facturado', 'cobrado'] };

export default function ObraDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const [tab, setTab] = useState('presupuesto');
  const [data, setData] = useState(null);      // { obra, items, totales }
  const [partidas, setPartidas] = useState([]);
  const [nl, setNl] = useState({ partida_id: '', cantidad: '' });
  const [expl, setExpl] = useState(null);       // { rows, total }
  const [tablero, setTablero] = useState(null);
  const [movs, setMovs] = useState([]);
  const [nm, setNm] = useState({ flujo: 'egreso', etapa: 'comprometido', monto: '', concepto: '', contraparte: '', doc_ref: '', fecha: '' });
  const [err, setErr] = useState('');
  const role = getUser()?.role;
  const canWrite = ['admin', 'aprobador', 'administrativo'].includes(role);
  const canApprove = ['admin', 'aprobador'].includes(role);

  const loadPres = () => api(`/obras/${id}/presupuesto`).then(setData).catch((e) => setErr(e.message));
  const loadExpl = () => api(`/obras/${id}/explosion`).then(setExpl).catch((e) => setErr(e.message));
  const loadDinero = () => {
    api(`/obras/${id}/tablero`).then(setTablero).catch((e) => setErr(e.message));
    api(`/obras/${id}/movimientos`).then((r) => setMovs(r.rows)).catch((e) => setErr(e.message));
  };
  useEffect(() => { loadPres(); api('/partidas?limit=200').then((r) => setPartidas(r.rows)).catch(() => {}); }, [id]);
  useEffect(() => { if (tab === 'insumos') loadExpl(); if (tab === 'dinero') loadDinero(); }, [tab, id]);

  const addMov = async () => {
    if (!nm.concepto.trim() || !Number(nm.monto)) { setErr('Concepto y monto son obligatorios.'); return; }
    setErr('');
    try {
      await api(`/obras/${id}/movimientos`, { method: 'POST', body: {
        flujo: nm.flujo, etapa: nm.etapa, monto: Number(nm.monto), concepto: nm.concepto.trim(),
        contraparte: nm.contraparte.trim() || null, doc_ref: nm.doc_ref.trim() || null, fecha: nm.fecha || null } });
      setNm({ ...nm, monto: '', concepto: '', contraparte: '', doc_ref: '', fecha: '' });
      loadDinero();
    } catch (e) { setErr(e.message); }
  };
  const delMov = async (m) => { try { await api(`/movimientos/${m.id}`, { method: 'DELETE' }); loadDinero(); } catch (e) { setErr(e.message); } };
  const setFlujo = (flujo) => setNm({ ...nm, flujo, etapa: ETAPAS_POR_FLUJO[flujo][0] });

  const add = async () => {
    if (!nl.partida_id) return;
    setErr('');
    try {
      await api(`/obras/${id}/presupuesto`, { method: 'POST', body: { partida_id: Number(nl.partida_id), cantidad: Number(nl.cantidad) || 0 } });
      setNl({ partida_id: '', cantidad: '' }); loadPres();
    } catch (e) { setErr(e.message); }
  };
  const setCant = async (it, v) => {
    try { await api(`/presupuesto-items/${it.id}`, { method: 'PUT', body: { cantidad: Number(v) || 0 } }); loadPres(); }
    catch (e) { setErr(e.message); }
  };
  const del = async (it) => { try { await api(`/presupuesto-items/${it.id}`, { method: 'DELETE' }); loadPres(); } catch (e) { setErr(e.message); } };

  if (!data) return <p className="mut">Cargando…</p>;
  const { obra, items, totales } = data;

  // Agrupar por capítulo (los items ya vienen ordenados por capítulo).
  const groups = [];
  for (const it of items) {
    const key = it.capitulo || 'Sin capítulo';
    let g = groups.find((x) => x.cap === key);
    if (!g) { g = { cap: key, items: [] }; groups.push(g); }
    g.items.push(it);
  }

  return (
    <>
      <div className="flx" style={{ gap: 10, marginBottom: 4 }}>
        <button className="btn secondary" style={{ padding: '6px 12px' }} onClick={() => nav(obra.tipo === 'obra' ? '/obras' : '/proyectos')}>‹</button>
        <h1 style={{ margin: 0 }}>{obra.nombre}</h1>
        <span className="pill mut">{obra.tipo}</span>
      </div>
      <p className="mut" style={{ marginTop: 0 }}>{obra.cliente || ''} · factores AIU {(obra.gg * 100).toFixed(1)}% + Ut. {(obra.utilidad * 100).toFixed(1)}% + IT {(obra.it * 100).toFixed(2)}% · ×{totales.chain.toFixed(4)}</p>

      <div className="tabs">
        <button className={tab === 'presupuesto' ? 'active' : ''} onClick={() => setTab('presupuesto')}>Presupuesto</button>
        <button className={tab === 'insumos' ? 'active' : ''} onClick={() => setTab('insumos')}>Explosión de insumos</button>
        <button className={tab === 'dinero' ? 'active' : ''} onClick={() => setTab('dinero')}>Dinero</button>
      </div>
      {err && <div className="error">{err}</div>}

      {tab === 'presupuesto' && (
        <>
          <div className="cards" style={{ margin: '14px 0' }}>
            <div className="card"><div className="k">Costo directo</div><div className="v num">{fmt(totales.costo)}</div></div>
            <div className="card"><div className="k">Venta</div><div className="v num">{fmt(totales.venta)}</div></div>
            <div className="card"><div className="k">Margen</div><div className="v num">{fmt(totales.margen)}</div></div>
          </div>

          {canWrite && (
            <div className="toolbar">
              <select value={nl.partida_id} onChange={(e) => setNl({ ...nl, partida_id: e.target.value })} style={{ flex: 2, maxWidth: 460 }}>
                <option value="">+ Agregar partida del catálogo…</option>
                {partidas.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.descripcion} ({p.unidad}) — {fmt(p.pu_costo)}</option>)}
              </select>
              <input type="number" placeholder="Cantidad (metrado)" value={nl.cantidad} onChange={(e) => setNl({ ...nl, cantidad: e.target.value })} style={{ width: 160 }} />
              <button className="btn" onClick={add}>Agregar</button>
            </div>
          )}

          {groups.map((g) => (
            <div key={g.cap} style={{ marginBottom: 16 }}>
              <div className="navgroup-title" style={{ paddingLeft: 2 }}>{g.cap}</div>
              <table>
                <thead><tr><th>Partida</th><th>Unid.</th><th className="right">Cant.</th><th className="right">P.U. costo</th><th className="right">Costo</th><th className="right">Venta</th>{canWrite && <th></th>}</tr></thead>
                <tbody>
                  {g.items.map((it) => (
                    <tr key={it.id}>
                      <td><span className="num">{it.codigo}</span> · {it.descripcion}</td>
                      <td>{it.unidad}</td>
                      <td className="right">
                        {canWrite
                          ? <input type="number" defaultValue={it.cantidad} onBlur={(e) => setCant(it, e.target.value)} style={{ width: 90, textAlign: 'right' }} />
                          : <span className="num">{it.cantidad}</span>}
                      </td>
                      <td className="right num">{fmt(it.pu_costo)}</td>
                      <td className="right num">{fmt(it.subtotal_costo)}</td>
                      <td className="right num">{fmt(it.subtotal_venta)}</td>
                      {canWrite && <td className="right"><button className="btn secondary" style={{ padding: '4px 8px' }} onClick={() => del(it)}>✕</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {!items.length && <div className="card mut">El presupuesto está vacío. Agregá partidas del catálogo con el selector de arriba.</div>}
        </>
      )}

      {tab === 'insumos' && (
        <div style={{ marginTop: 14 }}>
          <p className="mut">Suma de todos los insumos requeridos por el presupuesto (lista de compras).</p>
          <table>
            <thead><tr><th>Insumo</th><th>Tipo</th><th className="right">Cantidad</th><th>Unid.</th><th className="right">Precio</th><th className="right">Subtotal</th></tr></thead>
            <tbody>
              {(expl?.rows || []).map((r) => (
                <tr key={r.id}>
                  <td><span className="num">{r.codigo}</span> · {r.descripcion}</td>
                  <td><span className="pill mut">{tipoLabel[r.tipo] || r.tipo}</span></td>
                  <td className="right num">{Number(r.cantidad).toLocaleString('es-BO', { maximumFractionDigits: 2 })}</td>
                  <td>{r.unidad}</td>
                  <td className="right num">{fmt(r.precio)}</td>
                  <td className="right num">{fmt(r.subtotal)}</td>
                </tr>
              ))}
              {expl && !expl.rows.length && <tr><td colSpan={6} className="mut" style={{ padding: 16 }}>Sin insumos (agregá partidas con APU al presupuesto).</td></tr>}
            </tbody>
          </table>
          {expl && <div className="right" style={{ marginTop: 12, fontSize: 16 }}>Total insumos (costo directo): <b className="num">{fmt(expl.total)}</b></div>}
        </div>
      )}

      {tab === 'dinero' && tablero && (
        <div style={{ marginTop: 14 }}>
          {/* Pipeline de COSTO */}
          <div className="navgroup-title" style={{ paddingLeft: 2 }}>Costo · Presupuesto → Comprometido → Real</div>
          <div className="cards" style={{ margin: '8px 0 4px' }}>
            <div className="card"><div className="k">Presupuestado (costo)</div><div className="v num">{fmt(tablero.costo.presupuesto)}</div></div>
            <div className="card"><div className="k">Comprometido</div><div className="v num">{fmt(tablero.costo.comprometido)}</div></div>
            <div className="card"><div className="k">Pagado (real)</div><div className="v num">{fmt(tablero.costo.real)}</div></div>
            <div className="card"><div className="k">Por comprometer</div><div className="v num" style={{ color: tablero.costo.por_comprometer < 0 ? 'var(--red)' : 'var(--ink)' }}>{fmt(tablero.costo.por_comprometer)}</div></div>
          </div>

          {/* Pipeline de CAJA */}
          <div className="navgroup-title" style={{ paddingLeft: 2, marginTop: 10 }}>Caja · Contratado → Facturado → Cobrado</div>
          <div className="cards" style={{ margin: '8px 0 4px' }}>
            <div className="card"><div className="k">Objetivo de venta</div><div className="v num">{fmt(tablero.caja.objetivo_venta)}</div></div>
            <div className="card"><div className="k">Contratado</div><div className="v num">{fmt(tablero.caja.contratado)}</div></div>
            <div className="card"><div className="k">Facturado</div><div className="v num">{fmt(tablero.caja.facturado)}</div></div>
            <div className="card"><div className="k">Cobrado</div><div className="v num">{fmt(tablero.caja.cobrado)}</div></div>
          </div>

          {/* Resultado */}
          <div className="navgroup-title" style={{ paddingLeft: 2, marginTop: 10 }}>Resultado</div>
          <div className="cards" style={{ margin: '8px 0 16px' }}>
            <div className="card"><div className="k">Margen presupuestado</div><div className="v num">{fmt(tablero.resultado.margen_presupuestado)}</div></div>
            <div className="card"><div className="k">Caja neta (cobrado − pagado)</div><div className="v num" style={{ color: tablero.resultado.caja_neta < 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(tablero.resultado.caja_neta)}</div></div>
            <div className="card"><div className="k">Por facturar</div><div className="v num">{fmt(tablero.caja.por_facturar)}</div></div>
            <div className="card"><div className="k">Por cobrar</div><div className="v num">{fmt(tablero.caja.por_cobrar)}</div></div>
          </div>

          {/* Alta de movimiento */}
          {canWrite && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={nm.flujo} onChange={(e) => setFlujo(e.target.value)}>
                  <option value="egreso">Egreso (costo)</option>
                  <option value="ingreso">Ingreso (caja)</option>
                </select>
                <select value={nm.etapa} onChange={(e) => setNm({ ...nm, etapa: e.target.value })}>
                  {ETAPAS_POR_FLUJO[nm.flujo].map((et) => <option key={et} value={et}>{etapaLabel[et]}</option>)}
                </select>
                <input type="number" placeholder="Monto (Bs)" value={nm.monto} onChange={(e) => setNm({ ...nm, monto: e.target.value })} style={{ width: 140 }} />
                <input placeholder="Concepto" value={nm.concepto} onChange={(e) => setNm({ ...nm, concepto: e.target.value })} style={{ flex: 1, minWidth: 180 }} />
                <input placeholder={nm.flujo === 'egreso' ? 'Proveedor' : 'Cliente'} value={nm.contraparte} onChange={(e) => setNm({ ...nm, contraparte: e.target.value })} style={{ width: 150 }} />
                <input placeholder="Doc (OC/Factura)" value={nm.doc_ref} onChange={(e) => setNm({ ...nm, doc_ref: e.target.value })} style={{ width: 140 }} />
                <input type="date" value={nm.fecha} onChange={(e) => setNm({ ...nm, fecha: e.target.value })} />
                <button className="btn" onClick={addMov}>Registrar</button>
              </div>
            </div>
          )}

          <table>
            <thead><tr><th>Fecha</th><th>Flujo</th><th>Etapa</th><th>Concepto</th><th>Contraparte</th><th>Doc</th><th className="right">Monto</th>{canApprove && <th></th>}</tr></thead>
            <tbody>
              {movs.map((m) => (
                <tr key={m.id}>
                  <td className="num">{fdate(m.fecha)}</td>
                  <td><span className={`pill ${m.flujo === 'ingreso' ? 'green' : 'mut'}`}>{m.flujo === 'ingreso' ? 'Ingreso' : 'Egreso'}</span></td>
                  <td>{etapaLabel[m.etapa]}</td>
                  <td>{m.concepto}</td>
                  <td>{m.contraparte || '—'}</td>
                  <td>{m.doc_ref || '—'}</td>
                  <td className="right num" style={{ color: m.flujo === 'ingreso' ? 'var(--green)' : 'var(--ink)' }}>{fmt(m.monto)}</td>
                  {canApprove && <td className="right"><button className="btn secondary" style={{ padding: '4px 8px' }} onClick={() => delMov(m)}>✕</button></td>}
                </tr>
              ))}
              {!movs.length && <tr><td colSpan={canApprove ? 8 : 7} className="mut" style={{ padding: 16 }}>Sin movimientos. Registrá el primer compromiso o cobro con el formulario de arriba.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
