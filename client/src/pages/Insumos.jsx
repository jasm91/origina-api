import React, { useEffect, useState } from 'react';
import { api, fmt, animateClose, getUser } from '../api';

const TIPOS = [
  { v: 'material', l: 'Material' },
  { v: 'mano_obra', l: 'Mano de obra' },
  { v: 'equipo', l: 'Equipo' },
  { v: 'subcontrato', l: 'Subcontrato' },
];
const tipoLabel = (v) => (TIPOS.find((t) => t.v === v) || {}).l || v;
const EMPTY = { codigo: '', descripcion: '', tipo: 'material', unidad: 'u', precio: '' };

export default function Insumos() {
  const [data, setData] = useState({ rows: [], total: 0, page: 1, pages: 1 });
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState('');
  const canWrite = ['admin', 'aprobador', 'administrativo'].includes(getUser()?.role);

  const load = () =>
    api(`/insumos?q=${encodeURIComponent(q)}&tipo=${tipo}&page=${page}&limit=20`).then(setData).catch((e) => setErr(e.message));
  useEffect(() => { setPage(1); }, [q, tipo]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, tipo, page]);

  const save = async () => {
    setErr('');
    try {
      const body = { ...modal, precio: Number(modal.precio) || 0 };
      if (modal.id) await api(`/insumos/${modal.id}`, { method: 'PUT', body });
      else await api('/insumos', { method: 'POST', body });
      animateClose(setModal); load();
    } catch (e) { setErr(e.message); }
  };
  const del = async () => {
    if (!confirm('¿Eliminar el insumo?')) return;
    setErr('');
    try { await api(`/insumos/${modal.id}`, { method: 'DELETE' }); animateClose(setModal); load(); }
    catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h1>Insumos <span className="mut" style={{ fontSize: 14, fontWeight: 400 }}>· catálogo de recursos</span></h1>
      <div className="toolbar">
        <input placeholder="Buscar por código o descripción…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 280 }} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
        </select>
        {canWrite && <button className="btn" onClick={() => setModal({ ...EMPTY })}>+ Insumo</button>}
        <span className="mut" style={{ marginLeft: 'auto' }}>{data.total} insumos</span>
      </div>
      {err && <div className="error">{err}</div>}

      <table>
        <thead><tr><th>Código</th><th>Descripción</th><th>Tipo</th><th>Unidad</th><th className="right">Precio</th></tr></thead>
        <tbody>
          {data.rows.map((i) => (
            <tr key={i.id} onClick={() => setModal({ ...i, precio: i.precio })} style={{ cursor: 'pointer' }}>
              <td className="num">{i.codigo}</td><td>{i.descripcion}</td>
              <td><span className="pill mut">{tipoLabel(i.tipo)}</span></td>
              <td>{i.unidad}</td><td className="right num">{fmt(i.precio)}</td>
            </tr>
          ))}
          {!data.rows.length && <tr><td colSpan={5} className="mut" style={{ padding: 18 }}>Sin insumos.</td></tr>}
        </tbody>
      </table>
      <div className="pager">
        <span>Página {data.page} de {data.pages}</span>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
        <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>›</button>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => animateClose(setModal)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.id ? 'Editar insumo' : 'Nuevo insumo'}</h2>
            <div className="row">
              <input placeholder="Código (ej. MAT-CEM-01)" value={modal.codigo} onChange={(e) => setModal({ ...modal, codigo: e.target.value })} disabled={!canWrite} />
              <select value={modal.tipo} onChange={(e) => setModal({ ...modal, tipo: e.target.value })} disabled={!canWrite}>
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </div>
            <input placeholder="Descripción" value={modal.descripcion} onChange={(e) => setModal({ ...modal, descripcion: e.target.value })} disabled={!canWrite} />
            <div className="row">
              <input placeholder="Unidad (bolsa, m³, hora…)" value={modal.unidad} onChange={(e) => setModal({ ...modal, unidad: e.target.value })} disabled={!canWrite} />
              <input placeholder="Precio (Bs)" type="number" value={modal.precio} onChange={(e) => setModal({ ...modal, precio: e.target.value })} disabled={!canWrite} />
            </div>
            {err && <div className="error">{err}</div>}
            <div className="row">
              {modal.id && canWrite && <button className="btn secondary" style={{ color: 'var(--red)' }} onClick={del}>Eliminar</button>}
              <button className="btn secondary" onClick={() => animateClose(setModal)}>Cerrar</button>
              {canWrite && <button className="btn" onClick={save}>Guardar</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
