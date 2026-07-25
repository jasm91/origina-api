import React, { useEffect, useState } from 'react';
import { api, fmt, animateClose, getUser } from '../api';

const tipoLabel = { material: 'Material', mano_obra: 'Mano de obra', equipo: 'Equipo', subcontrato: 'Subcontrato' };

export default function Partidas() {
  const [data, setData] = useState({ rows: [], total: 0, page: 1, pages: 1 });
  const [caps, setCaps] = useState([]);
  const [q, setQ] = useState('');
  const [cap, setCap] = useState('');
  const [page, setPage] = useState(1);
  const [editorId, setEditorId] = useState(null);
  const [nueva, setNueva] = useState(null);
  const [err, setErr] = useState('');
  const canWrite = ['admin', 'aprobador', 'administrativo'].includes(getUser()?.role);

  const load = () =>
    api(`/partidas?q=${encodeURIComponent(q)}&capitulo_id=${cap}&page=${page}&limit=20`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { api('/capitulos').then(setCaps).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [q, cap]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, cap, page]);

  const crear = async () => {
    setErr('');
    try {
      const p = await api('/partidas', { method: 'POST', body: nueva });
      animateClose(setNueva); load(); setEditorId(p.id);
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h1>Partidas <span className="mut" style={{ fontSize: 14, fontWeight: 400 }}>· catálogo con APU</span></h1>
      <div className="toolbar">
        <input placeholder="Buscar por código o descripción…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
        <select value={cap} onChange={(e) => setCap(e.target.value)}>
          <option value="">Todos los capítulos</option>
          {caps.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        {canWrite && <button className="btn" onClick={() => setNueva({ codigo: '', descripcion: '', unidad: 'u', capitulo_id: '' })}>+ Partida</button>}
        <span className="mut" style={{ marginLeft: 'auto' }}>{data.total} partidas</span>
      </div>
      {err && <div className="error">{err}</div>}

      <table>
        <thead><tr><th>Código</th><th>Descripción</th><th>Capítulo</th><th>Unidad</th><th className="right">P.U. costo</th></tr></thead>
        <tbody>
          {data.rows.map((p) => (
            <tr key={p.id} onClick={() => setEditorId(p.id)} style={{ cursor: 'pointer' }}>
              <td className="num">{p.codigo}</td><td>{p.descripcion}</td>
              <td>{p.capitulo || '—'}</td><td>{p.unidad}</td>
              <td className="right num"><b>{fmt(p.pu_costo)}</b></td>
            </tr>
          ))}
          {!data.rows.length && <tr><td colSpan={5} className="mut" style={{ padding: 18 }}>Sin partidas.</td></tr>}
        </tbody>
      </table>
      <div className="pager">
        <span>Página {data.page} de {data.pages}</span>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
        <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>›</button>
      </div>

      {nueva && (
        <div className="modal-bg" onClick={() => animateClose(setNueva)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Nueva partida</h2>
            <div className="row">
              <input placeholder="Código (ej. HA-COL-01)" value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value })} />
              <input placeholder="Unidad (m³, m², u…)" value={nueva.unidad} onChange={(e) => setNueva({ ...nueva, unidad: e.target.value })} />
            </div>
            <input placeholder="Descripción" value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} />
            <select value={nueva.capitulo_id} onChange={(e) => setNueva({ ...nueva, capitulo_id: e.target.value })}>
              <option value="">Sin capítulo</option>
              {caps.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            {err && <div className="error">{err}</div>}
            <div className="row">
              <button className="btn secondary" onClick={() => animateClose(setNueva)}>Cancelar</button>
              <button className="btn" onClick={crear}>Crear y editar APU</button>
            </div>
          </div>
        </div>
      )}

      {editorId && <ApuEditor id={editorId} caps={caps} canWrite={canWrite} onClose={() => setEditorId(null)} onChanged={load} />}
    </>
  );
}

function ApuEditor({ id, caps, canWrite, onClose, onChanged }) {
  const [p, setP] = useState(null);
  const [insumos, setInsumos] = useState([]);
  const [nl, setNl] = useState({ insumo_id: '', rendimiento: '' });
  const [err, setErr] = useState('');

  const reload = () => api(`/partidas/${id}`).then(setP).catch((e) => setErr(e.message));
  useEffect(() => { reload(); api('/insumos/all').then(setInsumos).catch(() => {}); }, [id]);

  const saveHeader = async () => {
    setErr('');
    try {
      await api(`/partidas/${id}`, { method: 'PUT', body: { codigo: p.codigo, descripcion: p.descripcion, unidad: p.unidad, capitulo_id: p.capitulo_id || null } });
      reload(); onChanged();
    } catch (e) { setErr(e.message); }
  };
  const addLine = async () => {
    if (!nl.insumo_id) return;
    setErr('');
    try {
      await api(`/partidas/${id}/lineas`, { method: 'POST', body: { insumo_id: Number(nl.insumo_id), rendimiento: Number(nl.rendimiento) || 0 } });
      setNl({ insumo_id: '', rendimiento: '' }); reload(); onChanged();
    } catch (e) { setErr(e.message); }
  };
  const setRend = async (line, val) => {
    try { await api(`/lineas/${line.id}`, { method: 'PUT', body: { rendimiento: Number(val) || 0 } }); reload(); onChanged(); }
    catch (e) { setErr(e.message); }
  };
  const delLine = async (line) => {
    try { await api(`/lineas/${line.id}`, { method: 'DELETE' }); reload(); onChanged(); }
    catch (e) { setErr(e.message); }
  };

  const close = () => { const el = document.querySelector('.modal-bg'); if (el) el.classList.add('out'); setTimeout(onClose, 140); };

  return (
    <div className="modal-bg" onClick={close}>
      <div className="modal" style={{ width: 760, maxWidth: '96vw' }} onClick={(e) => e.stopPropagation()}>
        {!p ? <p className="mut">Cargando…</p> : (
          <>
            <h2>APU · {p.codigo}</h2>
            <div className="row">
              <input value={p.codigo} onChange={(e) => setP({ ...p, codigo: e.target.value })} disabled={!canWrite} />
              <input value={p.unidad} onChange={(e) => setP({ ...p, unidad: e.target.value })} disabled={!canWrite} style={{ maxWidth: 120 }} />
            </div>
            <input value={p.descripcion} onChange={(e) => setP({ ...p, descripcion: e.target.value })} disabled={!canWrite} />
            <div className="row">
              <select value={p.capitulo_id || ''} onChange={(e) => setP({ ...p, capitulo_id: e.target.value })} disabled={!canWrite}>
                <option value="">Sin capítulo</option>
                {caps.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
              {canWrite && <button className="btn secondary" onClick={saveHeader}>Guardar datos</button>}
            </div>

            <h3 style={{ margin: '14px 0 6px', fontSize: 14 }}>Composición (insumos × rendimiento por {p.unidad})</h3>
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              <table>
                <thead><tr><th>Insumo</th><th>Tipo</th><th className="right">Precio</th><th className="right">Rend.</th><th className="right">Subtotal</th>{canWrite && <th></th>}</tr></thead>
                <tbody>
                  {p.lineas.map((l) => (
                    <tr key={l.id}>
                      <td><span className="num">{l.codigo}</span> · {l.descripcion} <span className="mut">({l.unidad})</span></td>
                      <td><span className="pill mut">{tipoLabel[l.tipo] || l.tipo}</span></td>
                      <td className="right num">{fmt(l.precio)}</td>
                      <td className="right">
                        {canWrite
                          ? <input type="number" defaultValue={l.rendimiento} onBlur={(e) => setRend(l, e.target.value)} style={{ width: 80, textAlign: 'right' }} />
                          : <span className="num">{l.rendimiento}</span>}
                      </td>
                      <td className="right num">{fmt(l.subtotal)}</td>
                      {canWrite && <td className="right"><button className="btn secondary" style={{ padding: '4px 8px' }} onClick={() => delLine(l)}>✕</button></td>}
                    </tr>
                  ))}
                  {!p.lineas.length && <tr><td colSpan={canWrite ? 6 : 5} className="mut" style={{ padding: 12 }}>Sin insumos todavía.</td></tr>}
                </tbody>
              </table>
            </div>

            {canWrite && (
              <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
                <select value={nl.insumo_id} onChange={(e) => setNl({ ...nl, insumo_id: e.target.value })} style={{ flex: 2 }}>
                  <option value="">+ Agregar insumo…</option>
                  {insumos.map((i) => <option key={i.id} value={i.id}>{i.codigo} · {i.descripcion} ({i.unidad})</option>)}
                </select>
                <input type="number" placeholder="Rend." value={nl.rendimiento} onChange={(e) => setNl({ ...nl, rendimiento: e.target.value })} style={{ width: 90 }} />
                <button className="btn" onClick={addLine}>Agregar</button>
              </div>
            )}

            {err && <div className="error">{err}</div>}
            <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: 16 }}>P.U. costo directo: <b className="num">{fmt(p.pu_costo)}</b> / {p.unidad}</div>
              <button className="btn secondary" onClick={close}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
