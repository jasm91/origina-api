import React, { useEffect, useState } from 'react';
import { api, fdate, animateClose, getUser } from '../api';

const EMPTY = { nombre: '', cliente: '', ubicacion: '', estado: 'en curso' };

export default function Obras({ tipo, titulo }) {
  const [data, setData] = useState({ rows: [], total: 0, page: 1, pages: 1 });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [err, setErr] = useState('');
  const canWrite = ['admin', 'aprobador', 'administrativo'].includes(getUser()?.role);

  const load = () =>
    api(`/obras?tipo=${tipo}&q=${encodeURIComponent(q)}&page=${page}&limit=20`)
      .then(setData).catch((e) => setErr(e.message));

  // Al cambiar la búsqueda, volver a la página 1.
  useEffect(() => { setPage(1); }, [q]);
  // Cargar (con debounce sobre la búsqueda).
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, page]);

  const save = async () => {
    setErr('');
    try {
      if (modal.id) await api(`/obras/${modal.id}`, { method: 'PUT', body: modal });
      else await api('/obras', { method: 'POST', body: { ...modal, tipo } });
      animateClose(setModal); load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <>
      <h1>{titulo}</h1>
      <div className="toolbar">
        <input placeholder="Buscar por nombre o cliente…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 300 }} />
        {canWrite && <button className="btn" onClick={() => setModal({ ...EMPTY })}>+ {tipo === 'obra' ? 'Obra' : 'Proyecto'}</button>}
        <span className="mut" style={{ marginLeft: 'auto' }}>{data.total} en total</span>
      </div>
      {err && <div className="error">{err}</div>}

      <table>
        <thead><tr><th>Nombre</th><th>Cliente</th><th>Ubicación</th><th>Estado</th><th>Creada</th></tr></thead>
        <tbody>
          {data.rows.map((o) => (
            <tr key={o.id} onClick={() => setModal(o)} style={{ cursor: 'pointer' }}>
              <td><b>{o.nombre}</b></td>
              <td>{o.cliente || '—'}</td>
              <td>{o.ubicacion || '—'}</td>
              <td><span className="pill green">{o.estado}</span></td>
              <td className="num">{fdate(o.created_at)}</td>
            </tr>
          ))}
          {!data.rows.length && <tr><td colSpan={5} className="mut" style={{ padding: 18 }}>Sin resultados.</td></tr>}
        </tbody>
      </table>

      <div className="pager">
        <span>Página {data.page} de {data.pages}</span>
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Anterior</button>
        <button disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Siguiente ›</button>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => animateClose(setModal)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{modal.id ? 'Editar' : `Nueva ${tipo === 'obra' ? 'obra' : 'proyecto'}`}</h2>
            <input placeholder="Nombre" value={modal.nombre} onChange={(e) => setModal({ ...modal, nombre: e.target.value })} disabled={!canWrite} />
            <div className="row">
              <input placeholder="Cliente" value={modal.cliente || ''} onChange={(e) => setModal({ ...modal, cliente: e.target.value })} disabled={!canWrite} />
              <input placeholder="Ubicación" value={modal.ubicacion || ''} onChange={(e) => setModal({ ...modal, ubicacion: e.target.value })} disabled={!canWrite} />
            </div>
            <select value={modal.estado} onChange={(e) => setModal({ ...modal, estado: e.target.value })} disabled={!canWrite}>
              {['borrador', 'en curso', 'aceptado', 'cerrado'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {err && <div className="error">{err}</div>}
            <div className="row">
              <button className="btn secondary" onClick={() => animateClose(setModal)}>Cerrar</button>
              {canWrite && <button className="btn" onClick={save}>Guardar</button>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
