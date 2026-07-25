/**
 * og_store.js — Backend del COTIZADOR de producción de Origina (window.OG_API).
 * El cotizador es una app React autocontenida que persiste TODO como pares clave→valor
 * JSON mediante 3 operaciones. Aquí las implementamos contra Postgres, aisladas por
 * tenant y autenticadas con el mismo JWT de la app v3 (el token viaja en el body).
 *
 * Protocolo (POST /api/og):
 *   { op:"get",    key, token }          → { value: <json|null> }
 *   { op:"set",    key, value, token }   → { ok:true }
 *   { op:"delete", key, token }          → { ok:true }
 *
 * Claves compartidas (multiusuario): quotes_index, quote_<id>, og_users, lib_costs,
 * lib_contractors, lib_ordenes, og_correlativo*. Los borradores (*_draft) NO llegan
 * acá: el cotizador los deja en localStorage del dispositivo.
 */
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('./db');

const getSecret = () => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('FATAL: JWT_SECRET no configurado');
  return s;
};

// Verifica el token del body (o del header Authorization como respaldo).
function authFromBody(req) {
  const raw = (req.body && req.body.token)
    || (req.headers.authorization || '').replace(/^Bearer /, '')
    || null;
  if (!raw) return null;
  try { return jwt.verify(raw, getSecret()); } catch { return null; }
}

// Límite defensivo por si el cotizador manda un blob enorme (fotos en base64, etc.).
const MAX_BYTES = 4 * 1024 * 1024;

router.post('/og', async (req, res) => {
  try {
    const { op, key } = req.body || {};
    if (!op) return res.status(400).json({ error: 'bad op' });

    // Ping interno de la app: no requiere sesión válida.
    if (key === '__ping__' && op === 'get') return res.json({ value: 'ok' });

    const auth = authFromBody(req);
    if (!auth) return res.status(401).json({ error: 'unauthorized' });
    const tenant = auth.tenant_id;
    if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key requerida' });

    if (op === 'get') {
      const { rows } = await db.query(
        'SELECT value FROM og_kv WHERE tenant_id=$1 AND key=$2', [tenant, key]);
      return res.json({ value: rows.length ? rows[0].value : null });
    }

    if (op === 'set') {
      const value = req.body.value ?? null;
      const json = JSON.stringify(value);   // sirve para objeto/array/número/booleano/null
      if (Buffer.byteLength(json) > MAX_BYTES) {
        return res.status(413).json({ error: 'valor demasiado grande' });
      }
      await db.query(
        `INSERT INTO og_kv(tenant_id,key,value,updated_at) VALUES($1,$2,$3::jsonb,NOW())
         ON CONFLICT (tenant_id,key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
        [tenant, key, json]);
      return res.json({ ok: true });
    }

    if (op === 'delete') {
      await db.query('DELETE FROM og_kv WHERE tenant_id=$1 AND key=$2', [tenant, key]);
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'bad op' });
  } catch (e) {
    console.error('POST /og', e);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
