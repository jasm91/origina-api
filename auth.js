/**
 * auth.js — Login email+password con JWT multitenant (patrón de la casa: PPS/sg-ventas).
 * JWT payload: { tenant_id, user_id, role, name }
 * Roles Origina: admin, aprobador, administrativo, revisor.
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('./db');

const JWT_TTL = '30d';
const getJwtSecret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('FATAL: JWT_SECRET no configurado');
  return s;
};

// Rate limiting en memoria (anti fuerza bruta).
const _rl = new Map();
function rateLimitOk(key, max = 10, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const e = _rl.get(key) || { n: 0, t: now };
  if (now - e.t > windowMs) { e.n = 0; e.t = now; }
  e.n++; _rl.set(key, e);
  if (_rl.size > 5000) for (const [k, v] of _rl) if (now - v.t > windowMs) _rl.delete(k);
  return e.n <= max;
}
const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'unknown';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email y password requeridos' });
    if (!rateLimitOk('login:' + clientIp(req))) return res.status(429).json({ error: 'Demasiados intentos, esperá 15 minutos' });

    const { rows } = await db.query(
      `SELECT u.*, t.name AS tenant_name FROM users u
       JOIN tenants t ON t.id = u.tenant_id AND t.active
       WHERE lower(u.email) = lower($1) AND u.active`,
      [String(email).trim()]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const token = jwt.sign(
      { tenant_id: user.tenant_id, user_id: user.id, role: user.role, name: user.name },
      getJwtSecret(), { expiresIn: JWT_TTL }
    );
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, tenant: user.tenant_name } });
  } catch (err) {
    console.error('POST /auth/login', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Middleware: exige JWT válido → req.auth = { tenant_id, user_id, role, name }
function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : (req.query.t || null);
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try { req.auth = jwt.verify(token, getJwtSecret()); next(); }
  catch { res.status(401).json({ error: 'Token inválido o expirado' }); }
}

// Middleware: exige uno de los roles (admin siempre pasa).
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
    if (req.auth.role === 'admin' || roles.includes(req.auth.role)) return next();
    res.status(403).json({ error: 'Sin permiso para esta operación' });
  };
}

router.get('/me', requireAuth, (req, res) => res.json({ user: req.auth }));

module.exports = { router, requireAuth, requireRole };
