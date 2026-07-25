/**
 * perms.js — Matriz de permisos por rol (defaults). Se puede extender con
 * overrides por tenant como en PPS; por ahora, defaults del rubro.
 */
const ROLE_PERMS = {
  admin: ['READ', 'WRITE', 'APPROVE', 'USERS'],
  aprobador: ['READ', 'WRITE', 'APPROVE'],
  administrativo: ['READ', 'WRITE'],
  revisor: ['READ'],
};

const can = (role, perm) => (ROLE_PERMS[role] || []).includes(perm);

// Middleware: exige un permiso (no un rol) — más granular que requireRole.
function requirePerm(perm) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'No autenticado' });
    if (can(req.auth.role, perm)) return next();
    res.status(403).json({ error: 'Sin permiso para esta operación' });
  };
}

module.exports = { ROLE_PERMS, can, requirePerm };
