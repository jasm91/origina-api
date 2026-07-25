import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const { token, user } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setSession(token, user);
      nav('/');
    } catch (e) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Origina <b style={{ color: 'var(--green)' }}>·</b> Control Financiero</h1>
        <p className="mut" style={{ marginTop: -4, fontSize: 13 }}>Ingresá con tu cuenta</p>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" autoFocus />
        <label>Contraseña</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        {err && <div className="error">{err}</div>}
        <button className="btn" style={{ width: '100%', marginTop: 18 }} disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
