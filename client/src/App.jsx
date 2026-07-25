import React, { useState } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { getToken, getUser, clearSession } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Obras from './pages/Obras';
import ObraDetalle from './pages/ObraDetalle';
import Insumos from './pages/Insumos';
import Partidas from './pages/Partidas';

class ErrorBoundary extends React.Component {
  constructor(p) { super(p); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(e, i) { console.error('ErrorBoundary:', e, i); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, maxWidth: 560, margin: '0 auto' }}>
          <h2>Algo salió mal en esta pantalla</h2>
          <p className="err">{String(this.state.error?.message || this.state.error)}</p>
          <button className="btn" onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}>Volver</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GROUPS = [
  { id: 'op', title: 'Operación', links: [
    { to: '/', label: 'Dashboard' },
    { to: '/obras', label: 'Obras' },
    { to: '/proyectos', label: 'Proyectos' },
  ]},
  { id: 'cat', title: 'Catálogo', links: [
    { to: '/partidas', label: 'Partidas (APU)' },
    { to: '/insumos', label: 'Insumos' },
  ]},
];

function Layout({ children }) {
  const user = getUser();
  const nav = useNavigate();
  const location = useLocation();
  const logout = () => { clearSession(); nav('/login'); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">Origina <b>·</b> <span className="mut">Control Financiero</span></div>
        <nav>
          {GROUPS.map((g) => (
            <div key={g.id}>
              <div className="navgroup-title">{g.title}</div>
              {g.links.map((l) => <NavLink key={l.to} to={l.to} end={l.to === '/'}>{l.label}</NavLink>)}
            </div>
          ))}
        </nav>
        <div className="foot">
          <span>{user?.name} · {user?.role}</span>
          <button onClick={logout} title="Salir">Salir</button>
          <div className="ver">Origina v{__APP_VERSION__}</div>
        </div>
      </aside>
      <main className="main" key={location.pathname}><ErrorBoundary>{children}</ErrorBoundary></main>
    </div>
  );
}

function Private({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Private><Dashboard /></Private>} />
      <Route path="/obras" element={<Private><Obras tipo="obra" titulo="Obras" /></Private>} />
      <Route path="/obras/:id" element={<Private><ObraDetalle /></Private>} />
      <Route path="/proyectos" element={<Private><Obras tipo="proyecto" titulo="Proyectos" /></Private>} />
      <Route path="/partidas" element={<Private><Partidas /></Private>} />
      <Route path="/insumos" element={<Private><Insumos /></Private>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
