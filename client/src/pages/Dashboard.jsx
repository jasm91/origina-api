import React, { useEffect, useState } from 'react';
import { api } from '../api';

export default function Dashboard() {
  const [ctx, setCtx] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/context').then(setCtx).catch((e) => setErr(e.message)); }, []);

  return (
    <>
      <h1>Dashboard</h1>
      {err && <div className="error">{err}</div>}
      {ctx && (
        <>
          <p className="mut">Hola, {ctx.user.name}. Rol: {ctx.user.role}.</p>
          <div className="cards">
            <div className="card"><div className="k">Proyectos (diseño)</div><div className="v num">{ctx.counts.proyectos}</div></div>
            <div className="card"><div className="k">Obras (ejecución)</div><div className="v num">{ctx.counts.obras}</div></div>
            <div className="card"><div className="k">Partidas (catálogo)</div><div className="v num">{ctx.counts.partidas ?? 0}</div></div>
            <div className="card"><div className="k">Insumos</div><div className="v num">{ctx.counts.insumos ?? 0}</div></div>
          </div>
          <div className="card">
            <h2>Origina v3 — Fundación</h2>
            <p className="mut" style={{ margin: 0 }}>
              Base rápida al estilo de la casa (React + Vite + Node modular, listas paginadas).
              Próximas fases: catálogos de insumos y partidas (APU), presupuesto por selección,
              y el flujo de dinero con libro de movimientos.
            </p>
          </div>
        </>
      )}
    </>
  );
}
