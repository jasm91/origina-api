require('dotenv').config();
const PDFDocument = require('pdfkit');
const express = require('express');
const cors    = require('cors');
const crypto  = require('crypto');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app        = express();
const PORT       = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const BOT_SECRET  = process.env.BOT_SECRET;
const SG_GEMINI_KEY = process.env.SG_GEMINI_KEY || '';
// v4.3.7: Anthropic API para triage automático de tickets de soporte
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5';
if (!ADMIN_TOKEN || !BOT_SECRET) {
  console.error('FATAL: ADMIN_TOKEN y BOT_SECRET son obligatorios. Configurar en Railway → Variables.');
  process.exit(1);
}
if (!SG_GEMINI_KEY) {
  console.warn('[Gemini] SG_GEMINI_KEY no configurada — features de IA deshabilitadas');
}
if (!ANTHROPIC_API_KEY) {
  console.warn('[Anthropic] ANTHROPIC_API_KEY no configurada — triage de tickets deshabilitado');
}

// ── Email (SMTP) ──────────────────────────────────────────
// Las envs SMTP_* permiten al server enviar notificaciones por email
// (ej: nuevas consultas del form de la landing).
// Si no están configuradas, el server arranca igual pero no manda emails.
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;  // Permite enviar desde alias distinto al usuario auth (ej: noreply@)
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL || SMTP_USER || '';

// v4.10.0: lista ÚNICA y COMPLETA de tablas para backups/snapshots/restore.
// Antes había 4 listas inline desincronizadas: algunas omitían report_params,
// estancia_params, branding, maquinaria, etc. (9 tablas), lo que provocó pérdida
// de configuración (params CREA) en restores desde snapshots internos.
// Centralizar acá garantiza que TODO mecanismo respalde el 100% de las tablas.
const BACKUP_TABLES_FULL = ['lots','vet_products','treatments','health_alerts','sales','purchases','employees','field_activities','tasks','pesajes','advances','maintenance','agua','sal','conteo','partos','alimento','animals','animal_movements','lluvias','diesel','aceite','reproductive_services','cuentas','kardex','historial_sueldos','compras_ganado','bajas','maquinaria','rotation_history','pasture_evals','inventory_counts','estancia_params','branding','report_params','pluvios_config','diesel_tank'];

let _smtpTransporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  _smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,  // 465 = SSL implícito, 587 = STARTTLS
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
  console.log('[SMTP] Configurado:', SMTP_HOST + ':' + SMTP_PORT, '·', SMTP_USER, '→ notify:', NOTIFY_EMAIL);
} else {
  console.warn('[SMTP] No configurado — notificaciones por email deshabilitadas');
}

// Helper: enviar email de notificación (no bloquea la respuesta)
// Devuelve Promise pero el caller puede ignorarla; los errores se loguean.
async function sendNotificationEmail({ subject, html, text, to }) {
  if (!_smtpTransporter) {
    return { ok: false, error: 'SMTP no configurado' };
  }
  const recipient = to || NOTIFY_EMAIL;
  if (!recipient) {
    return { ok: false, error: 'NOTIFY_EMAIL no configurado' };
  }
  try {
    const info = await _smtpTransporter.sendMail({
      from: '"EstanciaPro" <' + SMTP_FROM + '>',
      to: recipient,
      subject: subject,
      text: text || '',
      html: html || ''
    });
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error('[SMTP] Error enviando email:', err.message);
    return { ok: false, error: err.message };
  }
}
const PWA_VERSION = process.env.PWA_VERSION || '1.2.0';
// Versión MÍNIMA permitida del Desktop. Si el cliente es menor, app bloquea hasta actualizar.
// Subir esto cuando haya un fix crítico que requiera adopción universal (ej: bug de sync).
const DESKTOP_MIN_VERSION = process.env.DESKTOP_MIN_VERSION || '1.4.19';
// Versión LATEST del Desktop (informativo). Para indicar al usuario qué versión hay disponible.
const DESKTOP_LATEST_VERSION = process.env.DESKTOP_LATEST_VERSION || '1.4.19';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
// Confiar en proxy de Railway para obtener IP real del cliente
app.set('trust proxy', true);

// ── PostgreSQL ────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// ── Init DB schema ────────────────────────────────────────────
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store (
      tenant_id  TEXT NOT NULL DEFAULT 'default',
      key        TEXT NOT NULL,
      value      JSONB NOT NULL DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (tenant_id, key)
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      token       TEXT UNIQUE NOT NULL,
      plan        TEXT DEFAULT 'standard',
      active      BOOLEAN DEFAULT true,
      notes       TEXT,
      last_desktop_version TEXT,
      last_pwa_version     TEXT,
      last_seen            TIMESTAMPTZ,
      last_pwa_seen        TIMESTAMPTZ,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_device_os TEXT`);
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS last_device_type TEXT`);
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS devices JSONB DEFAULT '[]'`);
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS read_only BOOLEAN DEFAULT false`);
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_reason TEXT`);

  // Tabla de routing de teléfonos del bot WhatsApp
  // phone (PK) → tenant_id 1:1
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bot_phone_routing (
      phone       TEXT PRIMARY KEY,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      user_name   TEXT,
      role        TEXT DEFAULT 'capataz',
      active      BOOLEAN DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      last_seen   TIMESTAMPTZ,
      msg_count   INTEGER DEFAULT 0,
      notes       TEXT
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS bot_phone_routing_tenant_idx ON bot_phone_routing(tenant_id)`);

  // Tabla de solicitudes de nuevos tenants (registro público desde landing)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tenant_requests (
      id            SERIAL PRIMARY KEY,
      contact_name  TEXT NOT NULL,
      email         TEXT NOT NULL,
      phone         TEXT,
      estancia_name TEXT NOT NULL,
      country       TEXT,
      ranch_size    TEXT,
      head_count    INTEGER,
      message       TEXT,
      status        TEXT DEFAULT 'pending',  -- pending, approved, rejected
      tenant_id     INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
      ip_address    TEXT,
      user_agent    TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      processed_at  TIMESTAMPTZ,
      processed_by  TEXT,
      admin_notes   TEXT
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS tenant_requests_status_idx ON tenant_requests(status)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS tenant_requests_email_idx ON tenant_requests(email)`);

  // v4.12.0 — Device Pairing: tokens por dispositivo (aditivo, NO toca tenants ni store)
  // Cada celular/equipo vinculado recibe su propio token 'dtk_...'. El token maestro del
  // tenant sigue funcionando igual; esta tabla es un camino paralelo y opcional.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS device_tokens (
      id          SERIAL PRIMARY KEY,
      token       TEXT UNIQUE NOT NULL,
      tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      device_name TEXT NOT NULL,
      app_type    TEXT DEFAULT 'pwa',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      last_seen   TIMESTAMPTZ,
      revoked_at  TIMESTAMPTZ
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS device_tokens_tenant_idx ON device_tokens(tenant_id)`);

  await pool.query(`
    INSERT INTO tenants (name, token, plan, active, notes)
    VALUES ('Estancia 5M - César Moreno', 'estancia5m-2026-secreto', 'pro', true, 'Primer cliente - Estancia 5M Santa Cruz Bolivia')
    ON CONFLICT (token) DO NOTHING;
  `);

  const cesarTenant = await pool.query(`SELECT id FROM tenants WHERE token='estancia5m-2026-secreto'`);
  if (cesarTenant.rows.length) {
    const tenantId = 'tenant_' + cesarTenant.rows[0].id;
    await pool.query(`UPDATE store SET tenant_id = $1 WHERE tenant_id = 'default' AND key NOT IN (SELECT key FROM store WHERE tenant_id = $1)`, [tenantId]);
    await pool.query(`DELETE FROM store WHERE tenant_id = 'default'`);
    const tables = [
      'lots','vet_products','treatments','health_alerts','sales',
      'purchases','employees','field_activities','tasks','pesajes',
      'advances','maintenance','agua','sal','conteo','partos','alimento',
      'animals','animal_movements','lluvias','diesel','aceite','reproductive_services',
      'cuentas','kardex','historial_sueldos','compras_ganado','backup_snapshots'
    ];
    for (const t of tables) {
      await pool.query(`INSERT INTO store(tenant_id, key, value) VALUES($1, $2, '[]') ON CONFLICT(tenant_id, key) DO NOTHING`, [tenantId, t]);
    }
  }
  console.log('[DB] Schema v4.1 ready — Multi-tenant + Bot TX');
}

// ── Helpers ───────────────────────────────────────────────────
async function getTable(tenantId, key) {
  const res = await pool.query('SELECT value FROM store WHERE tenant_id=$1 AND key=$2', [tenantId, key]);
  return res.rows.length ? res.rows[0].value : [];
}

async function setTable(tenantId, key, data) {
  await pool.query(
    `INSERT INTO store(tenant_id, key, value, updated_at) VALUES($1, $2, $3, NOW())
     ON CONFLICT(tenant_id, key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
    [tenantId, key, JSON.stringify(data)]
  );
}

function mergeById(existing, incoming) {
  const existingMap = {};
  existing.forEach(r => { existingMap[r.id] = r; });
  const merged = [...existing];
  incoming.forEach(r => { if (!existingMap[r.id]) merged.push(r); });
  return merged;
}

// ── v4.9.0: Salvaguardas bulk-push ────────────────────────────────
// Evita que un push con payload vacío o casi-vacío borre una tabla entera
// con datos valiosos (lo que pasó con el seed demo que pisó 590 animales reales).
// Cuenta registros tanto en arrays como en objetos tipo animals {code:[...]}.
const BULK_PROTECTED_TABLES = [
  'animals','lots','pesajes','sales','purchases','employees','treatments',
  'advances','historial_sueldos','reproductive_services','bajas',
  'animal_movements','compras_ganado','cuentas','kardex','maquinaria',
  'vet_products','tasks','field_activities'
];

function _bulkCountRecords(data) {
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object') {
    // objeto tipo animals: {code: [animal, ...]} → sumar largos de los arrays;
    // si los valores no son arrays, contar las claves
    let sum = 0, anyArray = false;
    for (const k of Object.keys(data)) {
      if (Array.isArray(data[k])) { sum += data[k].length; anyArray = true; }
    }
    return anyArray ? sum : Object.keys(data).length;
  }
  return 0;
}

// Devuelve { ok:true } si el push es seguro, o { ok:false, reason } si debe rechazarse.
// `override` permite forzar (header x-bulk-override: 'yes') para casos legítimos de vaciado.
async function evaluateBulkSafety(tenantId, table, incoming, override) {
  if (BULK_PROTECTED_TABLES.indexOf(table) < 0) return { ok: true };

  const incomingCount = _bulkCountRecords(incoming);

  // Regla 3: demasiados records sin id (solo arrays) → payload corrupto
  if (Array.isArray(incoming) && incoming.length > 0) {
    const sinId = incoming.filter(r => !r || (r.id === undefined || r.id === null || r.id === '')).length;
    const ratioSinId = sinId / incoming.length;
    if (ratioSinId > 0.20 && !override) {
      return { ok: false, code: 'TOO_MANY_MISSING_IDS',
        reason: `${sinId}/${incoming.length} (${Math.round(ratioSinId*100)}%) de los registros vienen sin id. Push rechazado para evitar corrupción.` };
    }
  }

  const existing = await getTable(tenantId, table);
  const existingCount = _bulkCountRecords(existing);

  // Si el server estaba vacío, nada que proteger
  if (existingCount === 0) return { ok: true };

  // Regla 1: payload vacío contra server con >10 registros
  if (incomingCount === 0 && existingCount > 10 && !override) {
    return { ok: false, code: 'EMPTY_PAYLOAD',
      reason: `El push está vacío (0 registros) pero el server tiene ${existingCount} en "${table}". Rechazado para no borrar datos. Si es intencional, reenviar con header x-bulk-override: yes.` };
  }

  // Regla 2: caída drástica >70% (perdería la mayoría de los datos)
  if (incomingCount > 0 && existingCount > 20) {
    const dropRatio = (existingCount - incomingCount) / existingCount;
    if (dropRatio > 0.70 && !override) {
      return { ok: false, code: 'DRASTIC_DROP',
        reason: `El push reduciría "${table}" de ${existingCount} a ${incomingCount} registros (-${Math.round(dropRatio*100)}%). Rechazado por seguridad. Si es intencional, reenviar con header x-bulk-override: yes.` };
    }
  }

  return { ok: true };
}

// Guarda un snapshot de seguridad de la tabla antes de un REPLACE riesgoso,
// para poder revertir. Se guarda en _presafe_<tabla> con timestamp.
async function saveBulkPresafe(tenantId, table, existing) {
  try {
    const cnt = _bulkCountRecords(existing);
    if (cnt === 0) return;
    await setTable(tenantId, '_presafe_' + table, {
      saved_at: new Date().toISOString(),
      count: cnt,
      data: existing
    });
    console.log(`[bulk-presafe] tenant=${tenantId} table=${table} guardado snapshot de ${cnt} registros en _presafe_${table}`);
  } catch (e) {
    console.error('[bulk-presafe] error:', e.message);
  }
}


function generateToken() {
  return 'jisunu-' + crypto.randomBytes(8).toString('hex');
}

// ── Parser de User-Agent y geolocalización por IP ─────────────
// Cache de IP→geo en memoria (evita rate-limit de ip-api.com: 45 req/min)
const _geoCache = new Map();
const _GEO_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function parseUserAgent(ua) {
  ua = ua || '';
  let os = 'Unknown', osVer = '';
  let browser = 'Unknown', browserVer = '';
  let type = 'desktop';
  let isElectron = false;

  // OS
  let m;
  if ((m = ua.match(/Windows NT ([\d.]+)/))) {
    os = 'Windows';
    const winMap = { '10.0':'10/11', '6.3':'8.1', '6.2':'8', '6.1':'7' };
    osVer = winMap[m[1]] || m[1];
  } else if ((m = ua.match(/Mac OS X ([\d_]+)/))) {
    os = 'macOS'; osVer = m[1].replace(/_/g, '.');
  } else if ((m = ua.match(/Android ([\d.]+)/))) {
    os = 'Android'; osVer = m[1]; type = 'mobile';
  } else if ((m = ua.match(/iPhone OS ([\d_]+)/))) {
    os = 'iOS'; osVer = m[1].replace(/_/g, '.'); type = 'mobile';
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS'; type = 'tablet';
    if ((m = ua.match(/CPU OS ([\d_]+)/))) osVer = m[1].replace(/_/g, '.');
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }

  // Browser
  if (/Electron/i.test(ua))                    { browser = 'Electron'; isElectron = true; type = 'desktop-app'; if ((m = ua.match(/Electron\/([\d.]+)/))) browserVer = m[1]; }
  else if (/Edg\//i.test(ua))                  { browser = 'Edge';    if ((m = ua.match(/Edg\/([\d.]+)/))) browserVer = m[1]; }
  else if (/OPR\/|Opera/i.test(ua))            { browser = 'Opera';   if ((m = ua.match(/(?:OPR|Opera)\/([\d.]+)/))) browserVer = m[1]; }
  else if (/Chrome\//i.test(ua) && !/Edg|OPR/i.test(ua)) { browser = 'Chrome';  if ((m = ua.match(/Chrome\/([\d.]+)/))) browserVer = m[1]; }
  else if (/Firefox\//i.test(ua))              { browser = 'Firefox'; if ((m = ua.match(/Firefox\/([\d.]+)/))) browserVer = m[1]; }
  else if (/Safari\//i.test(ua) && !/Chrome|Edge|Edg|OPR/i.test(ua)) { browser = 'Safari'; if ((m = ua.match(/Version\/([\d.]+)/))) browserVer = m[1]; }

  // Versión corta (mayor)
  const browserMajor = browserVer.split('.')[0] || '';

  return { os, os_version: osVer, browser, browser_version: browserVer, browser_major: browserMajor, device_type: type, is_electron: isElectron };
}

function getClientIp(req) {
  // Express con trust proxy ya pone la IP correcta en req.ip
  // pero Railway/CDN puede agregar más layers
  let ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.connection?.remoteAddress || '';
  // Limpiar prefijo IPv6 que envuelve IPv4
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  // Filtrar IPs locales/privadas
  if (!ip || ip === '::1' || ip === '127.0.0.1' || /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return '';
  return ip;
}

async function lookupGeo(ip) {
  if (!ip) return null;
  const cached = _geoCache.get(ip);
  if (cached && (Date.now() - cached.ts < _GEO_TTL_MS)) return cached.geo;
  try {
    // ip-api.com: gratis 45 req/min, devuelve city/country/lat/lon/isp
    const fetchFn = (typeof fetch !== 'undefined') ? fetch : (await import('node-fetch')).default;
    const resp = await fetchFn('http://ip-api.com/json/' + encodeURIComponent(ip) + '?fields=status,country,countryCode,regionName,city,lat,lon,isp,query', {
      signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined
    });
    const data = await resp.json();
    if (data.status !== 'success') {
      _geoCache.set(ip, { ts: Date.now(), geo: null });
      return null;
    }
    const geo = {
      country: data.country,
      country_code: data.countryCode,
      region: data.regionName,
      city: data.city,
      lat: data.lat,
      lon: data.lon,
      isp: data.isp,
    };
    _geoCache.set(ip, { ts: Date.now(), geo });
    return geo;
  } catch(e) {
    _geoCache.set(ip, { ts: Date.now(), geo: null });
    return null;
  }
}

// ── AUDIT LOGS ─────────────────────────────────────────
// Logs por tenant en tabla "audit_logs" (key-value compatible con setTable/getTable)
// Limit en memoria: máximo 5000 entradas/tenant, prune automático >30 días al guardar
const _AUDIT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 días
const _AUDIT_MAX_ENTRIES = 5000;

async function appendAuditLog(tenantId, entry) {
  if (!tenantId || !entry) return;
  try {
    const logs = await getTable(tenantId, 'audit_logs');
    const list = Array.isArray(logs) ? logs : [];
    // Stamp obligatorio del server (autoritativo)
    const stamped = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      ts: new Date().toISOString(),
      ...entry
    };
    // Truncar campos largos para mantener logs livianos
    if (stamped.record_summary && stamped.record_summary.length > 200) {
      stamped.record_summary = stamped.record_summary.slice(0, 200) + '…';
    }
    if (stamped.diff) {
      // Compactar diff: si un valor es muy largo o es un array/objeto grande, resumirlo
      const compactDiff = {};
      Object.keys(stamped.diff).slice(0, 30).forEach(k => {
        const v = stamped.diff[k];
        if (Array.isArray(v) && v.length === 2) {
          compactDiff[k] = [_summarizeValue(v[0]), _summarizeValue(v[1])];
        }
      });
      stamped.diff = compactDiff;
    }
    list.push(stamped);
    // Auto-prune por edad y por límite
    const cutoff = Date.now() - _AUDIT_MAX_AGE_MS;
    const pruned = list
      .filter(l => new Date(l.ts).getTime() >= cutoff)
      .slice(-_AUDIT_MAX_ENTRIES);
    await setTable(tenantId, 'audit_logs', pruned);
  } catch(e) {
    console.error('[Audit] Error guardando log:', e.message);
  }
}

function _summarizeValue(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 80) + '…' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (Array.isArray(v)) return '[Array(' + v.length + ')]';
  if (typeof v === 'object') {
    try {
      const keys = Object.keys(v).slice(0, 5);
      return '{' + keys.join(',') + (Object.keys(v).length > 5 ? ',…' : '') + '}';
    } catch(e) { return '[Object]'; }
  }
  return String(v).slice(0, 80);
}

// ── v4.13.0: Auditoría automática server-side (cubre TODAS las tablas) ──
// En cada bulk-push, el server compara el estado previo con el nuevo y registra
// create/update/delete por registro. Así ninguna tabla queda sin trazabilidad aunque
// el cliente no llame a auditLog. Deduplica contra los logs ricos que ya manda el cliente.
const _AUDIT_SKIP_TABLES = new Set([
  'audit_logs','backup_snapshots','transaction_images','bot_session','sync_metadata',
  'sync_meta','_deleted_ids','next_ids','animals'
]);
// Alias nombre-cliente → nombre-storage (para deduplicar contra los logs del cliente)
const _AUDIT_TABLE_ALIAS = { products: 'vet_products', activities: 'field_activities', activity: 'field_activities' };
function _auditCanon(t) { return _AUDIT_TABLE_ALIAS[t] || t; }
const _AUDIT_AUTO_CAP = 40;            // máx movimientos detallados por push (arriba: entrada coarse)
const _AUDIT_DIFF_MAXRECORDS = 6000;   // por encima, no diff per-record (evita costo)

function _autoAuditSummary(table, rec) {
  if (!rec || typeof rec !== 'object') return '';
  const pick = ['code','name','nombre','device_name','lot_code','lote','animal_id','tipo','fecha','date','proveedor','comprador','motivo','causa'];
  const parts = [];
  for (const k of pick) {
    if (rec[k] !== undefined && rec[k] !== null && String(rec[k]).trim() !== '') {
      parts.push(String(rec[k]).slice(0, 40));
      if (parts.length >= 3) break;
    }
  }
  const num = rec.total != null ? rec.total : (rec.monto != null ? rec.monto : (rec.amount != null ? rec.amount : null));
  if (num != null) parts.push('Bs ' + num);
  return parts.join(' · ').slice(0, 140);
}

function _auditStamp(entry) {
  return Object.assign({ id: Date.now() + '_' + Math.random().toString(36).substr(2, 6), ts: new Date().toISOString() }, entry);
}

async function _autoAuditTable(tenantId, table, oldVal, newVal, req) {
  try {
    if (!tenantId || !table || _AUDIT_SKIP_TABLES.has(table) || /^_/.test(table)) return;
    const source = (req && req.headers && req.headers['x-app-type']) ? String(req.headers['x-app-type']) : 'sync';
    const appVer = (req && req.headers && req.headers['x-app-version']) || '';

    // Config (objeto, no array de registros): una sola entrada 'update' si cambió
    if (!Array.isArray(newVal)) {
      let changed = true;
      try { changed = JSON.stringify(oldVal == null ? null : oldVal) !== JSON.stringify(newVal == null ? null : newVal); } catch(e) {}
      if (!changed) return;
      const logsC = await getTable(tenantId, 'audit_logs');
      const listC = Array.isArray(logsC) ? logsC : [];
      listC.push(_auditStamp({ action: 'update', table, record_id: '', record_summary: 'Configuración actualizada', user: 'sync', source, app_version: appVer, auto: true }));
      const cutC = Date.now() - _AUDIT_MAX_AGE_MS;
      await setTable(tenantId, 'audit_logs', listC.filter(l => new Date(l.ts).getTime() >= cutC).slice(-_AUDIT_MAX_ENTRIES));
      return;
    }

    const oldArr = Array.isArray(oldVal) ? oldVal : [];
    if (oldArr.length + newVal.length > _AUDIT_DIFF_MAXRECORDS) return;

    const oldMap = {}; oldArr.forEach(r => { if (r && r.id !== undefined) oldMap[String(r.id)] = r; });
    const newMap = {}; newVal.forEach(r => { if (r && r.id !== undefined) newMap[String(r.id)] = r; });

    const creates = [], updates = [], deletes = [];
    for (const id in newMap) {
      if (!(id in oldMap)) creates.push(id);
      else { let a, b; try { a = JSON.stringify(oldMap[id]); b = JSON.stringify(newMap[id]); } catch(e) { a = 0; b = 1; } if (a !== b) updates.push(id); }
    }
    for (const id in oldMap) { if (!(id in newMap)) deletes.push(id); }
    const totalMoves = creates.length + updates.length + deletes.length;
    if (totalMoves === 0) return;

    const logs = await getTable(tenantId, 'audit_logs');
    const list = Array.isArray(logs) ? logs : [];
    const recentCut = Date.now() - 5 * 60 * 1000;
    const recentKeys = new Set();
    for (const l of list) {
      if (!l || !l.ts || new Date(l.ts).getTime() < recentCut) continue;
      recentKeys.add(_auditCanon(l.table) + '|' + l.action + '|' + String(l.record_id || ''));
    }

    if (totalMoves > _AUDIT_AUTO_CAP) {
      list.push(_auditStamp({ action: 'sync', table, record_id: '', record_summary: creates.length + ' nuevos · ' + updates.length + ' modificados · ' + deletes.length + ' eliminados', user: 'sync', source, app_version: appVer, auto: true }));
    } else {
      const mk = (action, id, rec) => {
        const key = table + '|' + action + '|' + String(id);
        if (recentKeys.has(key)) return; // ya logueado por el cliente (o auto previo)
        list.push(_auditStamp({ action, table, record_id: String(id), record_summary: action === 'delete' ? ('Eliminado #' + id) : _autoAuditSummary(table, rec), user: 'sync', source, app_version: appVer, auto: true }));
        recentKeys.add(key);
      };
      creates.forEach(id => mk('create', id, newMap[id]));
      updates.forEach(id => mk('update', id, newMap[id]));
      deletes.forEach(id => mk('delete', id, oldMap[id]));
    }

    const cutoff = Date.now() - _AUDIT_MAX_AGE_MS;
    await setTable(tenantId, 'audit_logs', list.filter(l => new Date(l.ts).getTime() >= cutoff).slice(-_AUDIT_MAX_ENTRIES));
  } catch(e) {
    console.error('[Audit auto] error:', e.message);
  }
}

// ── Auth middleware (acepta header Authorization O ?token= en query) ──
async function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim() || (req.query.token || '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });

  try {
    let result = await pool.query('SELECT id, name, plan, active, read_only FROM tenants WHERE token=$1', [token]);
    let deviceId = null;

    // ── v4.12.0: segundo intento — token por dispositivo (Device Pairing) ──
    // Solo corre si el token NO matcheó ningún tenant Y empieza con 'dtk_'.
    // El token maestro de cada cliente (ej. César) matchea arriba y NUNCA entra acá.
    if (!result.rows.length && token.indexOf('dtk_') === 0) {
      const dev = await pool.query(
        `SELECT t.id, t.name, t.plan, t.active, t.read_only, d.id AS device_id, d.revoked_at
           FROM device_tokens d JOIN tenants t ON t.id = d.tenant_id
          WHERE d.token = $1`, [token]);
      if (dev.rows.length) {
        if (dev.rows[0].revoked_at) {
          return res.status(401).json({ error: 'Dispositivo desvinculado', code: 'DEVICE_REVOKED' });
        }
        deviceId = dev.rows[0].device_id;
        result = { rows: [{ id: dev.rows[0].id, name: dev.rows[0].name, plan: dev.rows[0].plan, active: dev.rows[0].active, read_only: dev.rows[0].read_only }] };
        pool.query('UPDATE device_tokens SET last_seen=NOW() WHERE id=$1', [deviceId]).catch(() => {});
      }
    }

    if (!result.rows.length) return res.status(401).json({ error: 'Token inválido' });
    const tenant = result.rows[0];
    if (!tenant.active) return res.status(403).json({ error: 'Cuenta suspendida' });

    req.tenant = tenant;
    req.tenantId = 'tenant_' + tenant.id;
    req.deviceId = deviceId;

    // ── Bloqueo de escritura para tenants suspendidos en read_only ──
    // Si tenant.read_only=true y el método NO es GET/HEAD/OPTIONS → 403 con código claro
    // Las apps cliente leen este código para mostrar banner "Cuenta suspendida"
    const method = (req.method || '').toUpperCase();
    const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    if (tenant.read_only && isWrite) {
      return res.status(403).json({
        error: 'Cuenta suspendida — contactar a su administrador',
        code: 'ACCOUNT_SUSPENDED',
        tenant_id: tenant.id
      });
    }

    const appVersion = req.headers['x-app-version'];
    const appType    = req.headers['x-app-type'] || 'desktop';
    const userAgent  = req.headers['user-agent'] || '';

    // Parser detallado de UA
    const parsed = parseUserAgent(userAgent);
    const deviceOs = parsed.os;
    const deviceType = parsed.device_type;

    // IP y lookup geo
    const ip = getClientIp(req);
    let geo = null;
    if (ip) {
      // Lookup async, NO bloqueante: si falla queda null
      try { geo = await Promise.race([
        lookupGeo(ip),
        new Promise(resolve => setTimeout(() => resolve(null), 2500))
      ]); } catch(e) { geo = null; }
    }

    const devResult = await pool.query('SELECT devices FROM tenants WHERE id=$1', [tenant.id]);
    const devices   = devResult.rows[0]?.devices || [];
    // Key más específica: incluye browser para distinguir Chrome vs Safari en mismo OS
    const devKey    = appType + '_' + deviceOs + '_' + parsed.browser;
    const existIdx  = devices.findIndex(d => d.key === devKey);
    const devEntry  = {
      key: devKey,
      type: appType,
      os: deviceOs,
      os_version: parsed.os_version || '',
      device_type: deviceType,
      browser: parsed.browser,
      browser_version: parsed.browser_version || '',
      browser_major: parsed.browser_major || '',
      version: appVersion || '—',
      last_seen: new Date().toISOString(),
      ua: userAgent.slice(0, 200),
      ip: ip || '',
      geo: geo || null,
    };
    if (existIdx >= 0) {
      // Preservar first_seen si ya existía
      devEntry.first_seen = devices[existIdx].first_seen || devices[existIdx].last_seen;
      devices[existIdx] = devEntry;
    } else {
      devEntry.first_seen = devEntry.last_seen;
      devices.push(devEntry);
    }

    if (appVersion) {
      if (appType === 'pwa') {
        await pool.query('UPDATE tenants SET last_pwa_version=$1, last_pwa_seen=NOW(), last_device_os=$2, last_device_type=$3, devices=$4 WHERE id=$5', [appVersion, deviceOs, deviceType, JSON.stringify(devices), tenant.id]);
      } else {
        await pool.query('UPDATE tenants SET last_desktop_version=$1, last_seen=NOW(), last_device_os=$2, last_device_type=$3, devices=$4 WHERE id=$5', [appVersion, deviceOs, deviceType, JSON.stringify(devices), tenant.id]);
      }
    } else {
      await pool.query('UPDATE tenants SET last_seen=NOW(), last_device_os=$1, last_device_type=$2, devices=$3 WHERE id=$4', [deviceOs, deviceType, JSON.stringify(devices), tenant.id]);
    }
    next();
  } catch(e) { res.status(500).json({ error: e.message }); }
}

// ── Admin auth ────────────────────────────────────────────────
function adminAuth(req, res, next) {
  const token = (req.headers['x-admin-token'] || '').trim();
  if (token !== ADMIN_TOKEN) return res.status(401).json({ error: 'Admin token inválido' });
  next();
}

// ════════════════════════════════════════════════════════════════
// v4.12.0 — Device Pairing (vinculación de dispositivos)
// ════════════════════════════════════════════════════════════════
// Códigos de vinculación EN MEMORIA: code -> { tenant_id, device_name, app_type, expires }
// TTL 10 min, un solo uso. Si Railway redeploya se pierden (basta regenerar el código).
const _pairCodes = new Map();
const _PAIR_TTL_MS = 10 * 60 * 1000;

function _genPairCode() {
  let code;
  do { code = String(Math.floor(100000 + Math.random() * 900000)); } while (_pairCodes.has(code));
  return code;
}
function _purgePairCodes() {
  const now = Date.now();
  for (const [c, v] of _pairCodes) if (v.expires < now) _pairCodes.delete(c);
}

// Rate-limit simple en memoria para /claim (anti fuerza bruta), por IP
const _claimHits = new Map();
function _claimRateOk(ip) {
  const now = Date.now();
  const slot = _claimHits.get(ip);
  if (!slot || slot.resetAt < now) { _claimHits.set(ip, { count: 1, resetAt: now + 60000 }); return true; }
  slot.count++;
  return slot.count <= 10; // máx 10 intentos/min/IP
}

// 1) Generar código — requiere token válido (maestro o de dispositivo) del tenant
app.post('/api/devices/pair-code', auth, async (req, res) => {
  try {
    const deviceName = String((req.body && req.body.device_name) || '').trim().slice(0, 60);
    const appType = String((req.body && req.body.app_type) || 'pwa').trim().slice(0, 16);
    if (!deviceName) return res.status(400).json({ error: 'Falta el nombre del dispositivo' });
    _purgePairCodes();
    const code = _genPairCode();
    _pairCodes.set(code, {
      tenant_id: req.tenant.id,
      device_name: deviceName,
      app_type: appType,
      expires: Date.now() + _PAIR_TTL_MS
    });
    res.json({ ok: true, code, expires_in: Math.floor(_PAIR_TTL_MS / 1000), device_name: deviceName });
  } catch (e) { res.status(500).json({ error: 'No se pudo generar el código' }); }
});

// 2) Canjear código — SIN auth (el dispositivo aún no tiene token). Rate-limited.
app.post('/api/devices/claim', async (req, res) => {
  try {
    const ip = getClientIp(req) || 'unknown';
    if (!_claimRateOk(ip)) return res.status(429).json({ error: 'Demasiados intentos, esperá un minuto' });
    const code = String((req.body && req.body.code) || '').replace(/\s+/g, '').trim();
    const appType = String((req.body && req.body.app_type) || 'pwa').trim().slice(0, 16);
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Código inválido' });
    _purgePairCodes();
    const entry = _pairCodes.get(code);
    if (!entry || entry.expires < Date.now()) return res.status(404).json({ error: 'Código inexistente o vencido' });
    _pairCodes.delete(code); // un solo uso

    const token = 'dtk_' + crypto.randomBytes(16).toString('hex');
    const ins = await pool.query(
      `INSERT INTO device_tokens (token, tenant_id, device_name, app_type, last_seen)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING id`,
      [token, entry.tenant_id, entry.device_name, appType || entry.app_type]);
    const tn = await pool.query('SELECT name FROM tenants WHERE id=$1', [entry.tenant_id]);
    res.json({
      ok: true,
      device_token: token,
      device_id: ins.rows[0].id,
      device_name: entry.device_name,
      tenant_name: tn.rows.length ? tn.rows[0].name : ''
    });
  } catch (e) { res.status(500).json({ error: 'No se pudo vincular el dispositivo' }); }
});

// 3) Listar dispositivos vinculados del tenant (el token se muestra ofuscado)
app.get('/api/devices', auth, async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, device_name, app_type, created_at, last_seen, revoked_at,
              ('dtk_…' || RIGHT(token, 4)) AS token_hint
         FROM device_tokens WHERE tenant_id=$1 ORDER BY created_at DESC`, [req.tenant.id]);
    res.json({ ok: true, devices: r.rows });
  } catch (e) { res.status(500).json({ error: 'No se pudo listar dispositivos' }); }
});

// 4) Revocar un dispositivo (no borra: marca revoked_at para auditoría)
app.post('/api/devices/:id/revoke', auth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'ID inválido' });
    const r = await pool.query(
      `UPDATE device_tokens SET revoked_at=NOW()
        WHERE id=$1 AND tenant_id=$2 AND revoked_at IS NULL RETURNING id`, [id, req.tenant.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Dispositivo no encontrado o ya revocado' });
    res.json({ ok: true, revoked: id });
  } catch (e) { res.status(500).json({ error: 'No se pudo revocar' }); }
});

// ════════════════════════════════════════════════════════════════
// v4.14.0 — Contexto liviano del bot (latencia)
// El bot (n8n) hacía GET /api/sync-pull en cada mensaje → bajaba el dataset COMPLETO
// (~1.4 MB: animals, pesajes, kardex, etc.) solo para armar el prompt de Gemini.
// El bot NO usa animals/pesajes/kardex/animal_movements (los conteos salen de lots.animal_count).
// Este endpoint devuelve la MISMA forma que sync-pull pero con esas tablas pesadas vacías
// → payload de pocos KB → baja más rápido Y achica el prompt (Gemini más rápido).
// Es DROP-IN: en n8n solo se cambia la URL del nodo "Obtener Datos".

// Auth liviano: resuelve el tenant SIN geo ni escrituras de telemetría (rápido, máquina-a-máquina)
async function botLightAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim() || (req.query.token || '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    let r = await pool.query('SELECT id, name, plan, active, read_only FROM tenants WHERE token=$1', [token]);
    if (!r.rows.length && token.indexOf('dtk_') === 0) {
      r = await pool.query('SELECT t.id, t.name, t.plan, t.active, t.read_only FROM device_tokens d JOIN tenants t ON t.id = d.tenant_id WHERE d.token=$1 AND d.revoked_at IS NULL', [token]);
    }
    if (!r.rows.length) return res.status(401).json({ error: 'Token inválido' });
    const t = r.rows[0];
    if (!t.active) return res.status(403).json({ error: 'Cuenta suspendida' });
    req.tenant = t; req.tenantId = 'tenant_' + t.id;
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
}

const _BOT_CTX_TABLES = ['lots','vet_products','treatments','health_alerts','sales','purchases','employees','tasks','advances','maintenance','partos','lluvias','diesel','bajas','maquinaria','diesel_tank','report_params','estancia_params','pluvios_config'];
app.get('/api/bot/context', botLightAuth, async (req, res) => {
  try {
    const t = req.tenantId;
    const vals = await Promise.all(_BOT_CTX_TABLES.map(function(k){ return getTable(t, k); }));
    const g = {}; _BOT_CTX_TABLES.forEach(function(k, i){ g[k] = vals[i]; });
    res.json({
      // Tablas que el bot SÍ usa (mismos nombres que sync-pull; products = vet_products)
      lots: Array.isArray(g.lots) ? g.lots : [],
      products: Array.isArray(g.vet_products) ? g.vet_products : [],
      treatments: g.treatments || [], health_alerts: g.health_alerts || [],
      sales: g.sales || [], purchases: g.purchases || [], employees: g.employees || [],
      tasks: g.tasks || [], advances: g.advances || [], maintenance: g.maintenance || [],
      partos: g.partos || [], lluvias: g.lluvias || [], diesel: g.diesel || [],
      bajas: g.bajas || [], maquinaria: g.maquinaria || [], diesel_tank: g.diesel_tank || [],
      report_params: Array.isArray(g.report_params) ? {} : (g.report_params || {}),
      estancia_params: g.estancia_params || {},
      pluvios_config: Array.isArray(g.pluvios_config) ? g.pluvios_config : [],
      // Tablas pesadas que el bot NO usa → vacías (conserva la forma de sync-pull, no rompe "Preparar Contexto")
      animals: {}, pesajes: [], kardex: [], animal_movements: [], field_activities: [],
      agua: [], sal: [], conteo: [], alimento: [], aceite: [], cuentas: [],
      historial_sueldos: [], compras_ganado: [], rotation_history: [], pasture_evals: [],
      reproductive_services: [], inventory_counts: [],
      timestamp: new Date().toISOString(),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Health ────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ app: 'EstanciaPro API', version: '4.15.0', status: 'online', db: 'postgresql', multiTenant: true, timestamp: new Date().toISOString() }));
app.get('/ping', (req, res) => res.json({ ok: true }));

// ── ADMIN — Gestión de tenants ────────────────────────────────
app.get('/api/admin/tenants', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, name, token, plan, active, notes, last_desktop_version, last_pwa_version, last_seen, last_pwa_seen, created_at, last_device_os, last_device_type, devices, read_only, suspended_at, suspended_reason FROM tenants ORDER BY created_at DESC`);
    const tenants = await Promise.all(result.rows.map(async t => {
      const tenantId = 'tenant_' + t.id;
      const [lots, employees, pesajes, sales, treatments, deletedIdsRaw] = await Promise.all([
        getTable(tenantId, 'lots'), getTable(tenantId, 'employees'), getTable(tenantId, 'pesajes'),
        getTable(tenantId, 'sales'), getTable(tenantId, 'treatments'),
        getTable(tenantId, '_deleted_ids'),
      ]);
      // Aplicar deleted_ids para no mostrar lotes que deberían estar borrados
      const deletedMap = (deletedIdsRaw && typeof deletedIdsRaw === 'object' && !Array.isArray(deletedIdsRaw)) ? deletedIdsRaw : {};
      const lotsAfterDel = (lots || []).filter(l => !deletedMap['lots:' + String(l.id)]);
      // Misma lógica de validación que /api/sync-pull:
      //  - Excluir vendidos
      //  - Excluir activos sin animales
      //  - Sin status definido = se considera activo (default histórico)
      const activeLots = lotsAfterDel.filter(l => {
        const status = (l.status || '').toLowerCase();
        if (status === 'sold' || status === 'vendido') return false;
        if (!l.animal_count || l.animal_count === 0) return false;  // sin animales = no se muestra
        return true;
      });
      const totalAnimals = activeLots.reduce((s, l) => s + (l.animal_count || 0), 0);
      const lastPesaje = (pesajes||[]).sort((a,b) => (b.date||'').localeCompare(a.date||''))[0];
      return {
        ...t, total_lots: activeLots.length, total_animals: totalAnimals,
        total_employees: (employees||[]).filter(e => e.active).length,
        total_sales: (sales||[]).reduce((s, v) => s + (v.total || 0), 0),
        total_treatments: (treatments||[]).length,
        last_pesaje_date: lastPesaje ? lastPesaje.date : null,
        lots_detail: activeLots.map(l => ({ code: l.code, category: l.category, animal_count: l.animal_count, avg_weight: l.avg_weight, paddock: l.paddock })),
      };
    }));
    res.json(tenants);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
// TENANT REQUESTS — registro público desde landing
// ════════════════════════════════════════════════════════════

// Rate limiting básico en memoria por IP (max 5 solicitudes por IP por hora)
const _registerRateLimit = new Map();
function checkRegisterRateLimit(ip) {
  const now = Date.now();
  const oneHourAgo = now - 3600000;
  const requests = (_registerRateLimit.get(ip) || []).filter(t => t > oneHourAgo);
  if (requests.length >= 5) return false;
  requests.push(now);
  _registerRateLimit.set(ip, requests);
  return true;
}

// Endpoint público (sin auth) para que landing envíe solicitudes
app.post('/api/public/register-request', async (req, res) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    if (!checkRegisterRateLimit(ip)) {
      return res.status(429).json({ error: 'Demasiadas solicitudes desde tu IP. Intenta más tarde.' });
    }
    const {
      contact_name, email, phone, estancia_name,
      country, ranch_size, head_count, message
    } = req.body || {};

    // Validaciones básicas
    if (!contact_name || !email || !estancia_name) {
      return res.status(400).json({ error: 'Nombre, email y nombre de estancia son obligatorios.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email inválido.' });
    }
    if (String(contact_name).length > 200 || String(email).length > 200 || String(estancia_name).length > 200) {
      return res.status(400).json({ error: 'Algún campo excede longitud máxima.' });
    }

    // Honeypot check (campo invisible que solo los bots llenan)
    if (req.body.website && String(req.body.website).trim() !== '') {
      // Bot detectado, fingir éxito sin guardar nada
      return res.json({ ok: true, message: 'Solicitud recibida.' });
    }

    // Verificar si ya hay solicitud pendiente del mismo email
    const existing = await pool.query(
      `SELECT id, status FROM tenant_requests WHERE email = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
      [email.toLowerCase()]
    );
    if (existing.rows.length > 0) {
      return res.json({
        ok: true,
        message: 'Ya recibimos una solicitud previa con este email. Te contactaremos pronto.',
        duplicate: true
      });
    }

    const userAgent = req.headers['user-agent'] || '';
    await pool.query(
      `INSERT INTO tenant_requests
        (contact_name, email, phone, estancia_name, country, ranch_size, head_count, message, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        String(contact_name).trim(),
        String(email).trim().toLowerCase(),
        phone ? String(phone).trim() : null,
        String(estancia_name).trim(),
        country ? String(country).trim() : null,
        ranch_size ? String(ranch_size).trim() : null,
        head_count ? parseInt(head_count) || null : null,
        message ? String(message).trim().slice(0, 1000) : null,
        ip,
        userAgent.slice(0, 500)
      ]
    );

    // Notificación por email (no bloquea la respuesta — fire and forget)
    // Si SMTP no está configurado o falla, igual se respondió OK al cliente
    // (la solicitud quedó guardada en DB y se ve desde admin PWA).
    const escapeHtml = (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const emailHtml = `
      <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#f7f7f7">
        <div style="background:#fff;border-radius:8px;padding:24px;border-left:4px solid #c9a84c">
          <h2 style="margin:0 0 16px 0;color:#1a1a1a">🌾 Nueva consulta — EstanciaPro</h2>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <tr><td style="padding:6px 0;color:#666;width:140px">Nombre:</td><td style="padding:6px 0"><strong>${escapeHtml(contact_name)}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#666">Email:</td><td style="padding:6px 0"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
            ${phone ? `<tr><td style="padding:6px 0;color:#666">Teléfono:</td><td style="padding:6px 0">${escapeHtml(phone)}</td></tr>` : ''}
            ${country ? `<tr><td style="padding:6px 0;color:#666">País:</td><td style="padding:6px 0">${escapeHtml(country)}</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:#666">Estancia:</td><td style="padding:6px 0"><strong>${escapeHtml(estancia_name)}</strong></td></tr>
            ${ranch_size ? `<tr><td style="padding:6px 0;color:#666">Superficie:</td><td style="padding:6px 0">${escapeHtml(ranch_size)}</td></tr>` : ''}
            ${head_count ? `<tr><td style="padding:6px 0;color:#666">Cabezas:</td><td style="padding:6px 0">${escapeHtml(head_count)}</td></tr>` : ''}
          </table>
          ${message ? `<div style="margin-top:16px;padding:12px;background:#f7f7f7;border-radius:6px;font-size:13px;line-height:1.5"><strong>Mensaje:</strong><br>${escapeHtml(message).replace(/\n/g, '<br>')}</div>` : ''}
          <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e0e0e0;font-size:12px;color:#999">
            IP: ${escapeHtml(ip)}<br>
            Recibido: ${new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}<br>
            Vista en admin: <a href="https://estancia5m-admin.netlify.app">Panel admin</a>
          </div>
        </div>
      </div>`;
    const emailText = `Nueva consulta EstanciaPro\n\n` +
      `Nombre: ${contact_name}\nEmail: ${email}\n` +
      (phone ? `Teléfono: ${phone}\n` : '') +
      (country ? `País: ${country}\n` : '') +
      `Estancia: ${estancia_name}\n` +
      (ranch_size ? `Superficie: ${ranch_size}\n` : '') +
      (head_count ? `Cabezas: ${head_count}\n` : '') +
      (message ? `\nMensaje:\n${message}\n` : '') +
      `\nIP: ${ip}\nFecha: ${new Date().toISOString()}`;

    sendNotificationEmail({
      subject: `🌾 Nueva consulta EstanciaPro — ${contact_name}`,
      html: emailHtml,
      text: emailText
    }).then(r => {
      if (r.ok) console.log('[register-request] Email enviado:', r.messageId);
      else console.warn('[register-request] Email NO enviado:', r.error);
    });

    res.json({
      ok: true,
      message: 'Solicitud recibida. Te contactaremos en 24-48 horas con tus credenciales de acceso.'
    });
  } catch(e) {
    console.error('[register-request] Error:', e);
    res.status(500).json({ error: 'Error procesando solicitud. Intenta de nuevo más tarde.' });
  }
});

// Listar solicitudes (admin)
app.get('/api/admin/tenant-requests', adminAuth, async (req, res) => {
  try {
    const status = req.query.status || null;
    const limit = parseInt(req.query.limit) || 100;
    let query = `SELECT * FROM tenant_requests`;
    const params = [];
    if (status) {
      query += ` WHERE status = $1`;
      params.push(status);
    }
    query += ` ORDER BY created_at DESC LIMIT ${limit}`;
    const result = await pool.query(query, params);
    res.json({ requests: result.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Aprobar solicitud — crea tenant y marca como approved
app.post('/api/admin/tenant-requests/:id/approve', adminAuth, async (req, res) => {
  try {
    const reqId = parseInt(req.params.id);
    const { plan, admin_notes, processed_by } = req.body || {};

    // Obtener la solicitud
    const reqResult = await pool.query(`SELECT * FROM tenant_requests WHERE id = $1`, [reqId]);
    if (!reqResult.rows.length) return res.status(404).json({ error: 'Solicitud no encontrada' });
    const tr = reqResult.rows[0];
    if (tr.status !== 'pending') return res.status(400).json({ error: 'Solicitud ya procesada' });

    // Crear tenant
    const tenantName = tr.estancia_name;
    const token = generateToken();
    const newTenant = await pool.query(
      `INSERT INTO tenants (name, token, plan, active, notes, created_at) VALUES ($1, $2, $3, true, $4, NOW()) RETURNING id, name, token, plan`,
      [tenantName, token, plan || 'standard', 'Contacto: ' + tr.contact_name + ' <' + tr.email + '>' + (tr.phone ? ' ' + tr.phone : '')]
    );
    const tenant = newTenant.rows[0];
    const tenantId = 'tenant_' + tenant.id;

    // Inicializar tablas (mismo bloque que POST /api/admin/tenants)
    const arrayTables = [
      'lots','vet_products','treatments','health_alerts','sales','purchases',
      'employees','field_activities','tasks','pesajes','advances','maintenance',
      'agua','sal','conteo','partos','alimento','animal_movements','lluvias',
      'diesel','aceite','cuentas','kardex','historial_sueldos','compras_ganado',
      'inventory_counts','bajas','maquinaria','pasture_evals','rotation_history'
    ];
    for (const t of arrayTables) {
      await pool.query(`INSERT INTO store(tenant_id, key, value) VALUES($1, $2, '[]') ON CONFLICT DO NOTHING`, [tenantId, t]);
    }
    const objectTables = ['animals','branding','report_params','estancia_params','diesel_tank','pluvios_config','_deleted_ids'];
    for (const t of objectTables) {
      const initVal = (t === 'pluvios_config' || t === 'diesel_tank') ? '[]' : '{}';
      await pool.query(`INSERT INTO store(tenant_id, key, value) VALUES($1, $2, $3) ON CONFLICT DO NOTHING`, [tenantId, t, initVal]);
    }

    // Marcar solicitud como aprobada
    await pool.query(
      `UPDATE tenant_requests SET status = 'approved', tenant_id = $1, processed_at = NOW(), processed_by = $2, admin_notes = $3 WHERE id = $4`,
      [tenant.id, processed_by || 'admin', admin_notes || null, reqId]
    );

    res.json({
      ok: true,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      api_token: tenant.token,
      plan: tenant.plan,
      contact_email: tr.email,
      contact_name: tr.contact_name,
      pwa_url: 'https://estancia5movil.netlify.app'
    });
  } catch(e) {
    console.error('[approve] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Rechazar solicitud
app.post('/api/admin/tenant-requests/:id/reject', adminAuth, async (req, res) => {
  try {
    const { admin_notes, processed_by } = req.body || {};
    await pool.query(
      `UPDATE tenant_requests SET status = 'rejected', processed_at = NOW(), processed_by = $1, admin_notes = $2 WHERE id = $3 AND status = 'pending'`,
      [processed_by || 'admin', admin_notes || null, parseInt(req.params.id)]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════
// fin TENANT REQUESTS
// ════════════════════════════════════════════════════════════

app.post('/api/admin/tenants', adminAuth, async (req, res) => {
  try {
    const { name, plan, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name requerido' });
    const token = generateToken();
    const result = await pool.query(`INSERT INTO tenants (name, token, plan, active, notes, created_at) VALUES ($1, $2, $3, true, $4, NOW()) RETURNING id, name, token, plan`, [name, token, plan || 'standard', notes || '']);
    const tenant = result.rows[0];
    const tenantId = 'tenant_' + tenant.id;
    // Tablas tipo array (vacías al inicio)
    const arrayTables = [
      'lots','vet_products','treatments','health_alerts','sales','purchases',
      'employees','field_activities','tasks','pesajes','advances','maintenance',
      'agua','sal','conteo','partos','alimento','animal_movements','lluvias',
      'diesel','aceite','cuentas','kardex','historial_sueldos','compras_ganado',
      'inventory_counts','bajas','maquinaria','pasture_evals','rotation_history',
    ];
    for (const t of arrayTables) {
      await pool.query(`INSERT INTO store(tenant_id, key, value) VALUES($1, $2, '[]') ON CONFLICT DO NOTHING`, [tenantId, t]);
    }
    // Tablas tipo objeto (estructura distinta)
    const objectTables = ['animals','branding','report_params','estancia_params','diesel_tank','pluvios_config','_deleted_ids'];
    for (const t of objectTables) {
      // animals/branding/etc empiezan como objeto vacío
      const initVal = (t === 'pluvios_config' || t === 'diesel_tank') ? '[]' : '{}';
      await pool.query(`INSERT INTO store(tenant_id, key, value) VALUES($1, $2, $3) ON CONFLICT DO NOTHING`, [tenantId, t, initVal]);
    }
    res.json({ ok: true, tenant_id: tenantId, name: tenant.name, api_token: tenant.token, plan: tenant.plan, pwa_url: 'https://estancia5movil.netlify.app' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/admin/tenants/:id', adminAuth, async (req, res) => {
  try {
    const { active, plan, notes } = req.body;
    await pool.query('UPDATE tenants SET active=$1, plan=COALESCE($2,plan), notes=COALESCE($3,notes) WHERE id=$4', [active, plan, notes, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Limpiar dispositivos viejos del tenant ──
// Borra entries de "devices" que no se conectaron en los últimos N días
// POST /api/admin/tenants/:id/cleanup-devices  body: { days_threshold: 30, keep_only_latest_per_type: false }
app.post('/api/admin/tenants/:id/cleanup-devices', adminAuth, async (req, res) => {
  try {
    const { days_threshold, keep_only_latest_per_type } = req.body || {};
    const days = parseInt(days_threshold) || 30;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

    const r = await pool.query('SELECT devices FROM tenants WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Tenant no encontrado' });
    const original = r.rows[0].devices || [];
    let kept = original.filter(d => {
      if (!d.last_seen) return false;  // sin last_seen, descartar
      return new Date(d.last_seen).getTime() >= cutoffMs;
    });

    // Si se pide, dejar solo el más reciente por tipo (desktop / pwa)
    if (keep_only_latest_per_type) {
      const byType = {};
      kept.forEach(d => {
        const t = d.type || 'desktop';
        if (!byType[t] || new Date(d.last_seen).getTime() > new Date(byType[t].last_seen).getTime()) {
          byType[t] = d;
        }
      });
      kept = Object.values(byType);
    }

    await pool.query('UPDATE tenants SET devices=$1 WHERE id=$2', [JSON.stringify(kept), req.params.id]);
    res.json({
      ok: true,
      tenant_id: req.params.id,
      before: original.length,
      after: kept.length,
      removed: original.length - kept.length,
      cutoff_days: days,
      kept_only_latest_per_type: !!keep_only_latest_per_type,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Limpiar TODOS los devices de un tenant (resetear) ──
// DELETE /api/admin/tenants/:id/devices
app.delete('/api/admin/tenants/:id/devices', adminAuth, async (req, res) => {
  try {
    await pool.query('UPDATE tenants SET devices=$1 WHERE id=$2', ['[]', req.params.id]);
    res.json({ ok: true, tenant_id: req.params.id, message: 'Devices reseteados' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Eliminar tenant completo (HARD DELETE) ──
// DELETE /api/admin/tenants/:id
// Requiere:
//   - x-admin-token (header)
//   - body: { confirm_name: "<nombre exacto del tenant>" }
// Protección: tenant_id = 1 (César producción) NO se puede eliminar nunca
// Acción: borra el tenant + todos sus datos en cascada
app.delete('/api/admin/tenants/:id', adminAuth, async (req, res) => {
  const tenantId = parseInt(req.params.id);
  if (!tenantId || isNaN(tenantId)) {
    return res.status(400).json({ error: 'ID de tenant inválido' });
  }

  // Protección: tenant 1 (César producción) bloqueado a nivel server
  if (tenantId === 1) {
    return res.status(403).json({
      error: 'Este tenant está protegido y no puede ser eliminado',
      tenant_id: 1,
      reason: 'PROTECTED_PRODUCTION_TENANT'
    });
  }

  const { confirm_name } = req.body || {};
  if (!confirm_name) {
    return res.status(400).json({
      error: 'Falta confirmación. Body debe incluir { confirm_name: "<nombre del tenant>" }'
    });
  }

  try {
    // 1. Obtener el tenant para validar nombre
    const tr = await pool.query('SELECT id, name FROM tenants WHERE id=$1', [tenantId]);
    if (!tr.rows.length) {
      return res.status(404).json({ error: 'Tenant no encontrado', tenant_id: tenantId });
    }
    const tenant = tr.rows[0];

    // 2. Validar nombre: el confirm_name debe coincidir EXACTO con el nombre del tenant
    if (String(confirm_name).trim() !== String(tenant.name).trim()) {
      return res.status(400).json({
        error: 'El nombre de confirmación no coincide con el del tenant',
        expected: tenant.name,
        received: confirm_name
      });
    }

    // 3. Calcular stats antes de borrar (para auditoría / response)
    const storeRows = await pool.query(
      'SELECT COUNT(*)::int AS keys FROM store WHERE tenant_id=$1',
      [String(tenantId)]
    );
    const phoneRows = await pool.query(
      'SELECT COUNT(*)::int AS phones FROM bot_phone_routing WHERE tenant_id=$1',
      [tenantId]
    );

    // 4. Borrar en orden: store → bot_phone_routing (CASCADE) → tenant_requests (SET NULL) → tenants
    await pool.query('DELETE FROM store WHERE tenant_id=$1', [String(tenantId)]);
    // bot_phone_routing tiene ON DELETE CASCADE → se borra solo al borrar el tenant
    // tenant_requests tiene ON DELETE SET NULL → queda el request pero con tenant_id=NULL
    await pool.query('DELETE FROM tenants WHERE id=$1', [tenantId]);

    res.json({
      ok: true,
      deleted: {
        tenant_id: tenantId,
        tenant_name: tenant.name,
        store_keys_deleted: storeRows.rows[0].keys,
        bot_phones_deleted: phoneRows.rows[0].phones
      },
      message: `Tenant "${tenant.name}" (id=${tenantId}) eliminado permanentemente`
    });
  } catch(e) {
    console.error('[DELETE tenant] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Suspender tenant (activar read_only mode) ──
// POST /api/admin/tenants/:id/suspend
// Body: { reason?: string }
// Efecto: tenants.read_only=true → bloqueo de escrituras pero lectura sigue OK
// Las apps cliente reciben 403 ACCOUNT_SUSPENDED en sus POST/PUT/DELETE
app.post('/api/admin/tenants/:id/suspend', adminAuth, async (req, res) => {
  const tenantId = parseInt(req.params.id);
  if (!tenantId || isNaN(tenantId)) return res.status(400).json({ error: 'ID de tenant inválido' });

  // Protección: tenant 1 (César) no puede ser suspendido tampoco
  if (tenantId === 1) {
    return res.status(403).json({
      error: 'Este tenant está protegido y no puede ser suspendido',
      tenant_id: 1,
      reason: 'PROTECTED_PRODUCTION_TENANT'
    });
  }

  const reason = (req.body && req.body.reason) ? String(req.body.reason).slice(0, 500) : null;

  try {
    const r = await pool.query(
      `UPDATE tenants
       SET read_only = true,
           suspended_at = NOW(),
           suspended_reason = $1
       WHERE id=$2
       RETURNING id, name, active, read_only, suspended_at, suspended_reason`,
      [reason, tenantId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tenant no encontrado', tenant_id: tenantId });
    res.json({ ok: true, tenant: r.rows[0], message: `Tenant "${r.rows[0].name}" suspendido (read-only)` });
  } catch(e) {
    console.error('[POST tenant suspend] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Activar tenant (quitar read_only) ──
// POST /api/admin/tenants/:id/activate
app.post('/api/admin/tenants/:id/activate', adminAuth, async (req, res) => {
  const tenantId = parseInt(req.params.id);
  if (!tenantId || isNaN(tenantId)) return res.status(400).json({ error: 'ID de tenant inválido' });

  try {
    const r = await pool.query(
      `UPDATE tenants
       SET read_only = false,
           suspended_at = NULL,
           suspended_reason = NULL
       WHERE id=$1
       RETURNING id, name, active, read_only`,
      [tenantId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Tenant no encontrado', tenant_id: tenantId });
    res.json({ ok: true, tenant: r.rows[0], message: `Tenant "${r.rows[0].name}" reactivado` });
  } catch(e) {
    console.error('[POST tenant activate] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Exportar TODOS los datos de un tenant en un JSON (para backup local) ──
// GET /api/admin/tenants/:id/export
// Devuelve un JSON gigante con tenant info + todas las claves de su tabla `store`
// Útil para backup local, análisis offline, debug
app.get('/api/admin/tenants/:id/export', adminAuth, async (req, res) => {
  const tenantId = parseInt(req.params.id);
  if (!tenantId || isNaN(tenantId)) return res.status(400).json({ error: 'ID de tenant inválido' });

  try {
    // 1. Tenant info (sin token por seguridad — ya lo tiene el admin)
    const tr = await pool.query(
      `SELECT id, name, plan, active, read_only, suspended_at, suspended_reason,
              last_desktop_version, last_pwa_version, last_seen, last_pwa_seen,
              last_device_os, last_device_type, devices, notes, created_at
       FROM tenants WHERE id=$1`,
      [tenantId]
    );
    if (!tr.rows.length) return res.status(404).json({ error: 'Tenant no encontrado', tenant_id: tenantId });
    const tenant = tr.rows[0];

    // 2. Todas las keys del store del tenant
    const sr = await pool.query(
      'SELECT key, value, updated_at FROM store WHERE tenant_id=$1 ORDER BY key',
      [String(tenantId)]
    );

    // 3. Capataces del bot WhatsApp ligados a este tenant
    const br = await pool.query(
      'SELECT phone, user_name, role, active, created_at, last_seen, msg_count, notes FROM bot_phone_routing WHERE tenant_id=$1 ORDER BY created_at',
      [tenantId]
    );

    // Construir el JSON exportado
    const data = {};
    sr.rows.forEach(row => {
      try { data[row.key] = JSON.parse(row.value); }
      catch(e) { data[row.key] = row.value; }
    });

    const exportData = {
      _meta: {
        export_version: 1,
        exported_at: new Date().toISOString(),
        server_version: '1.4.28',
        tenant_id: tenantId,
        tenant_name: tenant.name,
        keys_count: sr.rows.length,
        bot_phones_count: br.rows.length,
      },
      tenant: tenant,
      bot_phones: br.rows,
      data: data,
    };

    // Headers para que el navegador descargue como archivo
    const safeName = String(tenant.name).replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 50);
    const filename = `estancia5m-tenant-${tenantId}-${safeName}-${new Date().toISOString().slice(0,10)}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch(e) {
    console.error('[GET tenant export] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// POST /api/admin/tenants/:id/reconcile-counts (v1.4.26)
// Recalcula animal_count de todos los lotes contra animals[code].length
// Útil si un tenant quedó atascado con conteos incorrectos por race conditions
// históricas. Idempotente: siempre lleva al estado correcto.
// ══════════════════════════════════════════════════════════════
app.post('/api/admin/tenants/:id/reconcile-counts', adminAuth, async (req, res) => {
  const tenantId = parseInt(req.params.id);
  if (!tenantId || isNaN(tenantId)) return res.status(400).json({ error: 'ID de tenant inválido' });

  try {
    const tr = await pool.query('SELECT id, name FROM tenants WHERE id=$1', [tenantId]);
    if (!tr.rows.length) return res.status(404).json({ error: 'Tenant no encontrado' });
    const tenantName = tr.rows[0].name;

    const lots = await getTable(tenantId, 'lots') || [];
    const animals = await getTable(tenantId, 'animals') || {};

    const changes = [];
    const updated = lots.map(l => {
      if (!l || !l.code) return l;
      if (l.status === 'vendido' || l.status === 'sold') return l;
      const lotAnimals = animals[l.code];
      // Solo reconciliar si hay un kardex registrado (incluso vacío)
      if (lotAnimals === undefined) return l;
      const realCount = lotAnimals.length;
      if ((l.animal_count || 0) !== realCount) {
        changes.push({
          code: l.code,
          before: l.animal_count || 0,
          after: realCount,
          delta: realCount - (l.animal_count || 0)
        });
        return { ...l, animal_count: realCount, server_updated_at: new Date().toISOString() };
      }
      return l;
    });

    if (changes.length > 0) {
      await setTable(tenantId, 'lots', updated);
      console.log(`[reconcile-counts] tenant_${tenantId} (${tenantName}): ${changes.length} lotes corregidos`);
      changes.forEach(c => console.log(`  ${c.code}: ${c.before} → ${c.after} (${c.delta >= 0 ? '+' : ''}${c.delta})`));
    }

    res.json({
      ok: true,
      tenant_id: tenantId,
      tenant_name: tenantName,
      lots_total: lots.length,
      lots_changed: changes.length,
      changes: changes,
      message: changes.length === 0
        ? 'Todos los lotes ya están reconciliados'
        : `${changes.length} lote(s) corregido(s)`
    });
  } catch(e) {
    console.error('[reconcile-counts] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// BOT MULTITENANT ROUTING
// ══════════════════════════════════════════════════════════════

// Auth para el bot — usa BOT_SECRET, no admin token
function botAuth(req, res, next) {
  const secret = req.headers['x-bot-secret'] || '';
  if (secret !== BOT_SECRET) return res.status(401).json({ error: 'Bot secret inválido' });
  next();
}

// Normalizar formato de teléfono: solo dígitos
function normalizePhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

// ── Lookup de tenant por número de teléfono (lo usa n8n) ──
// GET /api/bot/route?phone=5917XXXXXXX
// Header: X-Bot-Secret: <BOT_SECRET>
app.get('/api/bot/route', botAuth, async (req, res) => {
  try {
    const phone = normalizePhone(req.query.phone);
    if (!phone) return res.status(400).json({ error: 'phone requerido' });

    const result = await pool.query(`
      SELECT br.phone, br.tenant_id, br.user_name, br.role, br.active,
             t.token, t.name as tenant_name, t.active as tenant_active, t.plan
      FROM bot_phone_routing br
      JOIN tenants t ON t.id = br.tenant_id
      WHERE br.phone = $1
    `, [phone]);

    if (!result.rows.length) return res.status(404).json({ error: 'Teléfono no registrado', phone: phone });
    const row = result.rows[0];
    if (!row.active) return res.status(403).json({ error: 'Usuario desactivado', phone: phone });
    if (!row.tenant_active) return res.status(403).json({ error: 'Tenant suspendido', tenant_id: row.tenant_id });

    // Actualizar last_seen y msg_count async (no bloquea respuesta)
    pool.query('UPDATE bot_phone_routing SET last_seen = NOW(), msg_count = msg_count + 1 WHERE phone = $1', [phone]).catch(() => {});

    res.json({
      ok: true,
      phone: row.phone,
      tenant_id: row.tenant_id,
      tenant_name: row.tenant_name,
      tenant_token: row.token,
      user_name: row.user_name,
      role: row.role,
      plan: row.plan,
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: listar todos los routings (con info del tenant) ──
app.get('/api/admin/bot-routing', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT br.phone, br.tenant_id, br.user_name, br.role, br.active,
             br.created_at, br.last_seen, br.msg_count, br.notes,
             t.name as tenant_name, t.token as tenant_token, t.active as tenant_active
      FROM bot_phone_routing br
      JOIN tenants t ON t.id = br.tenant_id
      ORDER BY br.tenant_id, br.created_at
    `);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: listar routings de un tenant específico ──
app.get('/api/admin/tenants/:id/bot-routing', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT phone, user_name, role, active, created_at, last_seen, msg_count, notes
      FROM bot_phone_routing
      WHERE tenant_id = $1
      ORDER BY created_at
    `, [req.params.id]);
    res.json(result.rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: crear/registrar un teléfono ──
// POST /api/admin/bot-routing
// body: { phone, tenant_id, user_name, role?, notes?, force? }
// Si phone ya existe en OTRO tenant: 409 Conflict con info, salvo que force=true
app.post('/api/admin/bot-routing', adminAuth, async (req, res) => {
  try {
    const { phone, tenant_id, user_name, role, notes, force } = req.body || {};
    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) return res.status(400).json({ error: 'phone requerido' });
    if (!tenant_id) return res.status(400).json({ error: 'tenant_id requerido' });

    // Verificar que el tenant existe
    const tCheck = await pool.query('SELECT id, name FROM tenants WHERE id = $1', [tenant_id]);
    if (!tCheck.rows.length) return res.status(404).json({ error: 'Tenant no existe' });

    // Validar conflicto: ¿el phone ya pertenece a OTRO tenant?
    const existing = await pool.query(`
      SELECT br.tenant_id, br.user_name, t.name as tenant_name
      FROM bot_phone_routing br
      JOIN tenants t ON t.id = br.tenant_id
      WHERE br.phone = $1
    `, [cleanPhone]);
    if (existing.rows.length && existing.rows[0].tenant_id !== Number(tenant_id) && !force) {
      return res.status(409).json({
        error: 'Phone ya asignado a otro tenant',
        conflict: true,
        current_tenant_id: existing.rows[0].tenant_id,
        current_tenant_name: existing.rows[0].tenant_name,
        current_user_name: existing.rows[0].user_name,
      });
    }

    const result = await pool.query(`
      INSERT INTO bot_phone_routing (phone, tenant_id, user_name, role, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (phone) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            user_name = EXCLUDED.user_name,
            role      = COALESCE(EXCLUDED.role, bot_phone_routing.role),
            notes     = EXCLUDED.notes,
            active    = true
      RETURNING *
    `, [cleanPhone, tenant_id, user_name || null, role || 'capataz', notes || null]);

    res.json({ ok: true, routing: result.rows[0], moved: existing.rows.length > 0 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: actualizar un routing ──
app.patch('/api/admin/bot-routing/:phone', adminAuth, async (req, res) => {
  try {
    const cleanPhone = normalizePhone(req.params.phone);
    const { user_name, role, active, notes, tenant_id } = req.body || {};
    const result = await pool.query(`
      UPDATE bot_phone_routing
      SET user_name = COALESCE($1, user_name),
          role      = COALESCE($2, role),
          active    = COALESCE($3, active),
          notes     = COALESCE($4, notes),
          tenant_id = COALESCE($5, tenant_id)
      WHERE phone = $6
      RETURNING *
    `, [user_name, role, active, notes, tenant_id, cleanPhone]);
    if (!result.rows.length) return res.status(404).json({ error: 'Phone no encontrado' });
    res.json({ ok: true, routing: result.rows[0] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: borrar un routing ──
app.delete('/api/admin/bot-routing/:phone', adminAuth, async (req, res) => {
  try {
    const cleanPhone = normalizePhone(req.params.phone);
    const result = await pool.query('DELETE FROM bot_phone_routing WHERE phone = $1 RETURNING phone', [cleanPhone]);
    if (!result.rows.length) return res.status(404).json({ error: 'Phone no encontrado' });
    res.json({ ok: true, deleted: cleanPhone });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════

// ── Bot Transaction (endpoint genérico para el bot de WhatsApp) ──
// ── Whitelist de tipos válidos para /api/bot-transaction ──
// Cualquier tipo fuera de esta lista se rechaza (defense in depth)
// Nota: 'sales' y 'partos' están en n8n pero el workflow los bloquea.
//       Los dejamos acá por si en futuro se habilitan desde el bot.
// ════════════════════════════════════════════════════════════════
// v4.5.1: helper centralizado para mantener rotation_history consistente
// con db.lots.paddock. Llamado desde TODOS los endpoints que crean
// o modifican lotes con paddock.
//
// Comportamiento:
//   - Si newLot.paddock está vacío → no hace nada (lote sin asignar)
//   - Si newLot está vendido/inactivo/0-cab → cierra todas sus entries abiertas
//   - Si newLot.paddock cambió respecto a prevLot.paddock → cierra entries
//     abiertas viejas + abre una nueva
//   - Si newLot.paddock es nuevo (creación) o el lote no tiene entry abierta
//     en ese paddock → abre una entry
//   - Idempotente: si ya existe una entry abierta para el mismo lote+paddock,
//     no duplica
//
// Retorna: { history: [], opened: bool, closed: int }
// ════════════════════════════════════════════════════════════════
async function syncRotationOnLotChange(tenantId, newLot, prevLot = null, opts = {}) {
  if (!newLot || !newLot.code) return { history: null, opened: false, closed: 0 };
  const reason = opts.reason || 'auto-sync';
  const by = opts.by || 'server';
  const now = opts.now || new Date().toISOString();
  const today = now.slice(0, 10);

  let history = await getTable(tenantId, 'rotation_history');
  if (!Array.isArray(history)) history = [];

  const lotCode = newLot.code;
  const newPaddock = String(newLot.paddock || '').trim();
  const prevPaddock = prevLot ? String(prevLot.paddock || '').trim() : '';
  const isInactive = ['vendido', 'sold', 'inactivo', 'inactive'].includes(String(newLot.status || '').toLowerCase());
  const noAnimals = (newLot.animal_count || 0) === 0;

  let closed = 0;
  let opened = false;
  let changed = false;

  // Caso A: lote vendido/inactivo/sin animales → cerrar todas sus entries abiertas
  if (isInactive || noAnimals) {
    history.forEach(r => {
      if (r && r.lot_code === lotCode && !r.exit_date) {
        r.exit_date = today;
        r.exit_at = now;
        if (r.entry_at) {
          const entryMs = new Date(r.entry_at).getTime();
          r.days_occupied = Math.max(1, Math.floor((Date.now() - entryMs) / 86400000));
        }
        closed++;
        changed = true;
      }
    });
    if (changed) await setTable(tenantId, 'rotation_history', history);
    return { history, opened, closed };
  }

  // Caso B: sin paddock asignado → nada que hacer
  if (!newPaddock) return { history, opened, closed };

  // Caso C: paddock cambió → cerrar viejas, abrir nueva
  // Caso D: paddock nuevo (creación) o sin entry abierta → abrir nueva
  const paddockChanged = prevLot && prevPaddock && prevPaddock !== newPaddock;
  const hasOpenOnNewPaddock = history.some(r =>
    r && r.lot_code === lotCode && r.potrero === newPaddock && !r.exit_date
  );

  if (paddockChanged) {
    history.forEach(r => {
      if (r && r.lot_code === lotCode && !r.exit_date && r.potrero !== newPaddock) {
        r.exit_date = today;
        r.exit_at = now;
        if (r.entry_at) {
          const entryMs = new Date(r.entry_at).getTime();
          r.days_occupied = Math.max(1, Math.floor((Date.now() - entryMs) / 86400000));
        }
        closed++;
        changed = true;
      }
    });
  }

  if (!hasOpenOnNewPaddock) {
    history.push({
      id: Date.now() + Math.random() * 1000,
      lot_code: lotCode,
      potrero: newPaddock,
      from_potrero: prevPaddock || '',
      entry_date: today,
      entry_at: now,
      exit_date: null,
      exit_at: null,
      days_occupied: 0,
      cabezas: newLot.animal_count || 0,
      reason: reason,
      by: by,
      source: opts.source || 'auto'
    });
    opened = true;
    changed = true;
  }

  if (changed) await setTable(tenantId, 'rotation_history', history);
  return { history, opened, closed };
}

const ALLOWED_BOT_TYPES = new Set([
  'treatments', 'purchases', 'sales', 'maintenance', 'tasks', 'tasks_complete',
  'pesajes', 'conteo', 'bajas', 'animal_movements',
  'diesel', 'sal', 'agua', 'lluvias', 'partos',
  'advances',  // FIX v4.3.3: faltaba en whitelist, el bot generaba "type: advances" y server rechazaba
  'lot_split', 'lot_rotation'  // v4.4.5: separación y rotación por WhatsApp
]);

// ════════════════════════════════════════════════════════════════
// v4.4.5: handlers para lot_split y lot_rotation (acciones complejas)
// ════════════════════════════════════════════════════════════════

// handleLotSplit:
// data = {
//   from_lot: 'SSD3',
//   sublots: [
//     { code: 'SSD3-A', min_weight: 300, max_weight: 380, paddock: 'Potrero Oeste' },
//     { code: 'SSD3-B', min_weight: 381, max_weight: 460, paddock: 'Potrero Oeste' }
//   ],
//   by: 'WhatsApp 59177...'
// }
// Para cada sub-lote: crea el lote nuevo + mueve animales que caen en el rango
async function handleLotSplit(req, res, data) {
  try {
    const fromLotCode = String(data.from_lot || '').trim();
    const sublots = Array.isArray(data.sublots) ? data.sublots : [];
    // v4.4.9: modo extract (1+ sub-lote, lo no extraído queda en el origen)
    //         vs partition (2+ sub-lotes, lote origen queda vacío/inactivo)
    // Por defecto inferimos: si solo viene 1 sub-lote → extract, sino → partition
    const mode = (data.mode === 'extract' || data.mode === 'partition') ? data.mode
                 : (sublots.length === 1 ? 'extract' : 'partition');
    if (!fromLotCode || sublots.length < 1) {
      return res.status(400).json({ ok: false, error: 'lot_split requiere from_lot y al menos 1 sublot' });
    }
    if (mode === 'partition' && sublots.length < 2) {
      return res.status(400).json({ ok: false, error: 'modo partition requiere al menos 2 sublots' });
    }

    const allLots = await getTable(req.tenantId, 'lots') || [];
    const fromNorm = fromLotCode.toLowerCase();
    const fromLot = allLots.find(l => l && l.code && l.code.toLowerCase() === fromNorm);
    if (!fromLot) {
      return res.status(400).json({ ok: false, error: 'Lote origen "' + fromLotCode + '" no encontrado' });
    }
    // v4.4.7: bloquear separación si el lote no es operable (cuarentena, vacío, etc.)
    if (!isLotOperable(fromLot)) {
      const motivo = fromLot.status === 'cuarentena' ? 'está en cuarentena' :
                     fromLot.status === 'vendido' || fromLot.status === 'sold' ? 'fue vendido' :
                     (fromLot.paddock || '').toLowerCase().indexOf('cuarentena') === 0 ? 'está en el potrero de cuarentena' :
                     !fromLot.animal_count || fromLot.animal_count === 0 ? 'no tiene animales' :
                     'no es operable';
      return res.status(400).json({ ok: false, error: 'No se puede separar el lote "' + fromLot.code + '": ' + motivo });
    }

    // Validar codes únicos de sub-lotes
    for (const sl of sublots) {
      if (!sl.code || !sl.min_weight || !sl.max_weight) {
        return res.status(400).json({ ok: false, error: 'Cada sub-lote requiere code, min_weight, max_weight' });
      }
      const exists = allLots.find(l => l && l.code && l.code.toLowerCase() === String(sl.code).toLowerCase());
      if (exists && exists.code !== fromLot.code) {
        return res.status(400).json({ ok: false, error: 'Sub-lote "' + sl.code + '" ya existe' });
      }
    }

    // Cargar animales del lote origen
    const animalsTable = await getTable(req.tenantId, 'animals') || {};
    const sourceAnimals = (animalsTable[fromLot.code] || []).slice();
    if (!sourceAnimals.length) {
      return res.status(400).json({ ok: false, error: 'Lote ' + fromLot.code + ' no tiene animales registrados' });
    }

    // Función helper: obtener último peso de un animal
    const lastWeight = (a) => {
      const ps = (a.pesajes || []).slice().sort((x,y) => String(x.fecha||'').localeCompare(String(y.fecha||'')));
      return ps.length ? Number(ps[ps.length-1].peso || 0) : 0;
    };

    // Para cada sublote: asignar animales que caen en el rango
    const now = new Date().toISOString();
    const movementsCreated = [];
    const newLots = [];
    const stillInSource = [];
    const assignedIds = new Set();

    // Primero clasificamos cada animal a su sublote (preferir el primero que matche)
    const animalsPerSublot = {};
    sublots.forEach(sl => { animalsPerSublot[sl.code] = []; });

    sourceAnimals.forEach(a => {
      const w = lastWeight(a);
      if (w <= 0) {
        stillInSource.push(a);  // sin pesaje: queda en origen
        return;
      }
      let assigned = false;
      for (const sl of sublots) {
        if (w >= Number(sl.min_weight) && w <= Number(sl.max_weight)) {
          animalsPerSublot[sl.code].push(a);
          assignedIds.add(String(a.animal_id || a.id));
          assigned = true;
          break;
        }
      }
      if (!assigned) stillInSource.push(a);
    });

    // Crear lotes nuevos y mover animales
    for (const sl of sublots) {
      const cabs = animalsPerSublot[sl.code];
      if (!cabs.length) continue;
      const totalKg = cabs.reduce((s,a) => s + lastWeight(a), 0);
      const avgKg = Math.round((totalKg / cabs.length) * 10) / 10;
      // v4.5.7 FIX: agregar id al lote nuevo. Antes lo creábamos sin id, lo que rompía
      // operaciones Desktop que buscan por id (modal Mover, deleteLot, marcar cuarentena).
      // Usar timestamp+random para evitar colisión con ids existentes.
      const newLotId = 'split_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      const newLot = {
        id: newLotId,
        code: sl.code,
        category: fromLot.category || 'novillo',
        paddock: sl.paddock || fromLot.paddock || '',
        animal_count: cabs.length,
        avg_weight: avgKg,
        entry_date: now.slice(0,10),
        status: 'activo',
        cost_origin: {
          from_lot: fromLot.code,
          date: now.slice(0,10),
          animal_count: cabs.length,
          total_kg: Math.round(totalKg * 10) / 10,
          batch_id: 'split_' + Date.now(),
          via: 'whatsapp'
        },
        server_updated_at: now,
        created_at: now,
        source: 'whatsapp'
      };
      allLots.push(newLot);
      newLots.push({ code: newLot.code, cab: cabs.length, avg_kg: avgKg, min_kg: sl.min_weight, max_kg: sl.max_weight });

      // Asignar al lote nuevo: stamping de movimientos en cada animal
      animalsTable[sl.code] = cabs.map(a => {
        const movs = (a._movements || []).slice();
        movs.push({ from: fromLot.code, to: sl.code, date: now, reason: 'lot_split', by: data.by || 'whatsapp' });
        movementsCreated.push({
          animal_id: a.animal_id || a.id,
          from_lot_code: fromLot.code,
          to_lot_code: sl.code,
          date: now,
          reason: 'lot_split',
          by: data.by || 'whatsapp'
        });
        return Object.assign({}, a, { _movements: movs });
      });
    }

    // Actualizar el lote origen: dejar solo los que NO fueron asignados
    animalsTable[fromLot.code] = stillInSource;
    fromLot.animal_count = stillInSource.length;
    fromLot.server_updated_at = now;
    if (stillInSource.length > 0) {
      const totalKg = stillInSource.reduce((s,a) => s + lastWeight(a), 0);
      const withWeight = stillInSource.filter(a => lastWeight(a) > 0).length;
      fromLot.avg_weight = withWeight > 0 ? Math.round((totalKg / withWeight) * 10) / 10 : (fromLot.avg_weight || 0);
    } else {
      // Lote origen queda vacío: marcarlo como inactivo (vacío)
      fromLot.status = 'inactivo';
      fromLot.avg_weight = 0;
    }

    // Persistir
    await setTable(req.tenantId, 'lots', allLots);
    await setTable(req.tenantId, 'animals', animalsTable);

    // Registrar los animal_movements
    let allMovs = await getTable(req.tenantId, 'animal_movements') || [];
    if (!Array.isArray(allMovs)) allMovs = [];
    movementsCreated.forEach(m => {
      m.id = 'mov_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      m.created_at = now;
      m.source = 'whatsapp';
      allMovs.push(m);
    });
    await setTable(req.tenantId, 'animal_movements', allMovs);

    // v4.4.8: actualizar rotation_history para los sub-lotes nuevos
    // Cada sub-lote arranca su historial en el mismo potrero del origen (o el que el usuario indicó)
    try {
      let rotHist = await getTable(req.tenantId, 'rotation_history');
      if (!Array.isArray(rotHist)) rotHist = [];
      // Si el lote origen quedó vacío, cerrar su entry activa
      if (fromLot.status === 'inactivo') {
        const openSourceEntries = rotHist.filter(r =>
          r && r.lot_code === fromLot.code && !r.exit_date
        );
        openSourceEntries.forEach(r => {
          r.exit_date = now.slice(0, 10);
          r.exit_at = now;
          if (r.entry_at) {
            const entryMs = new Date(r.entry_at).getTime();
            r.days_occupied = Math.floor((Date.now() - entryMs) / (24 * 60 * 60 * 1000));
          }
        });
      }
      // Abrir entries para cada sub-lote nuevo
      newLots.forEach(nl => {
        const subLotCfg = sublots.find(s => s.code === nl.code) || {};
        rotHist.push({
          id: Date.now() + Math.random() * 1000,
          lot_code: nl.code,
          potrero: subLotCfg.paddock || fromLot.paddock || '',
          from_potrero: '',
          entry_date: now.slice(0, 10),
          entry_at: now,
          exit_date: null,
          exit_at: null,
          days_occupied: 0,
          cabezas: nl.cab,
          reason: 'Separación del lote ' + fromLot.code,
          by: data.by || 'whatsapp',
          source: 'whatsapp'
        });
      });
      await setTable(req.tenantId, 'rotation_history', rotHist);
    } catch (e) {
      console.error('[lot_split] error actualizando rotation_history:', e.message);
    }

    // v4.4.8: entries en kardex para los sub-lotes nuevos (tipo movimiento)
    try {
      let kardex = await getTable(req.tenantId, 'kardex');
      if (!Array.isArray(kardex)) kardex = [];
      newLots.forEach(nl => {
        kardex.push({
          id: Date.now() + Math.random() * 1000,
          lote: nl.code,
          tipo: 'movimiento',
          fecha: now.slice(0, 10),
          cabezas: nl.cab,
          precio: 0,
          total: 0,
          desc: 'Sub-lote creado por separación de ' + fromLot.code + ' (' + nl.min_kg + '-' + nl.max_kg + ' kg)',
          by: data.by || 'whatsapp',
          source: 'whatsapp',
          created_at: now,
          auto: true
        });
      });
      await setTable(req.tenantId, 'kardex', kardex);
    } catch (e) {
      console.error('[lot_split] error actualizando kardex:', e.message);
    }

    // Audit log
    const ip = getClientIp(req);
    await appendAuditLog(req.tenantId, {
      action: 'create',
      table: 'lots',
      record_id: newLots.map(l => l.code).join(','),
      record_summary: 'Separación lote ' + fromLot.code + ' → ' + newLots.map(l => l.code + '(' + l.cab + ')').join(', '),
      user: data.by || 'whatsapp',
      source: 'bot',
      device_browser: 'WhatsApp',
      ip: ip || ''
    });

    console.log('[lot_split]', req.tenantId, fromLot.code, '→', newLots.map(l => l.code + ':' + l.cab).join(', '),
      '· quedaron', stillInSource.length, 'en origen');

    // Mensaje según el modo
    let message;
    if (mode === 'extract') {
      const subList = newLots.map(l => '*' + l.code + '* (' + l.cab + ' cab, ' + l.min_kg + '-' + l.max_kg + ' kg)').join(', ');
      if (stillInSource.length > 0) {
        message = 'Separación OK · ' + subList + ' creado(s)\n*' + fromLot.code + '* sigue activo con ' + stillInSource.length + ' cab restantes';
      } else {
        message = 'Separación OK · ' + subList + ' creado(s)\n*' + fromLot.code + '* quedó sin animales y se marcó como inactivo';
      }
    } else {
      message = 'Separación OK · ' + newLots.length + ' sub-lotes creados · ' + movementsCreated.length + ' animales movidos';
      if (stillInSource.length > 0) {
        message += '\n_(' + stillInSource.length + ' animales sin peso quedaron en ' + fromLot.code + ')_';
      }
    }

    return res.json({
      ok: true,
      mode: mode,
      from_lot: fromLot.code,
      new_lots: newLots,
      remaining_in_source: stillInSource.length,
      source_status: fromLot.status,
      total_moved: movementsCreated.length,
      message: message
    });
  } catch (e) {
    console.error('[lot_split] error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

// handleLotRotation:
// data = { lot_code: 'SSD3', new_paddock: 'Potrero Este', by: '...', force: false }
// Si la rotación sobrepoblara el potrero >130% y force=false, devuelve warning sin ejecutar.
async function handleLotRotation(req, res, data) {
  try {
    const lotCode = String(data.lot_code || '').trim();
    const newPaddock = String(data.new_paddock || '').trim();
    const force = !!data.force;
    if (!lotCode || !newPaddock) {
      return res.status(400).json({ ok: false, error: 'lot_rotation requiere lot_code y new_paddock' });
    }

    const allLots = await getTable(req.tenantId, 'lots') || [];
    const lotNorm = lotCode.toLowerCase();
    const lot = allLots.find(l => l && l.code && l.code.toLowerCase() === lotNorm);
    if (!lot) {
      return res.status(400).json({ ok: false, error: 'Lote "' + lotCode + '" no encontrado' });
    }
    if (lot.paddock === newPaddock) {
      return res.status(400).json({ ok: false, error: 'El lote ya está en ' + newPaddock });
    }
    // v4.4.7: bloquear rotación si el lote no es operable (cuarentena, vacío, etc.)
    if (!isLotOperable(lot)) {
      const motivo = lot.status === 'cuarentena' ? 'está en cuarentena' :
                     lot.status === 'vendido' || lot.status === 'sold' ? 'fue vendido' :
                     (lot.paddock || '').toLowerCase().indexOf('cuarentena') === 0 ? 'está en el potrero de cuarentena' :
                     !lot.animal_count || lot.animal_count === 0 ? 'no tiene animales' :
                     'no es operable';
      return res.status(400).json({ ok: false, error: 'No se puede rotar el lote "' + lot.code + '": ' + motivo });
    }

    // Cargar config y verificar capacidad
    let params = {};
    try {
      const paramsTable = await getTable(req.tenantId, 'params');
      params = Array.isArray(paramsTable) ? (paramsTable[0] || {}) : (paramsTable || {});
    } catch(e) { params = {}; }
    let capacidad = 0;
    (params.potreros || []).forEach(p => {
      const nm = p.name || p.nombre || '';
      if (nm === newPaddock) capacidad = p.capacidad || p.cap_max || 0;
    });

    let ocupActual = 0;
    allLots.forEach(l => {
      if (!l || l.paddock !== newPaddock) return;
      if (l.status && l.status !== 'activo' && l.status !== 'active') return;
      ocupActual += (l.animal_count || 0);
    });
    const totalPost = ocupActual + (lot.animal_count || 0);
    const pctPost = capacidad > 0 ? Math.round((totalPost / capacidad) * 100) : null;

    // Si sobrepoblaría >130% y no es force → devolver warning
    if (capacidad > 0 && pctPost > 130 && !force) {
      return res.json({
        ok: false,
        reason: 'overcrowding',
        warning: 'Rotar el lote a ' + newPaddock + ' lo sobrepoblaría al ' + pctPost + '% (' + totalPost + '/' + capacidad + ' cab). ¿Confirmás de todos modos?',
        require_confirm: true,
        details: { ocup_actual: ocupActual, capacidad: capacidad, cab_lote: lot.animal_count, total_post: totalPost, pct_post: pctPost }
      });
    }

    // Ejecutar rotación
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const fromPaddock = lot.paddock || '';
    lot.paddock = newPaddock;
    lot.last_paddock_change = now;
    // v4.5.4: también setear paddock_updated_at para que el Desktop sync-pull lo reconozca
    // como cambio reciente. Sin este campo el Desktop ignoraba el cambio de paddock del bot.
    lot.paddock_updated_at = now;
    lot.server_updated_at = now;
    await setTable(req.tenantId, 'lots', allLots);

    // v4.4.8: actualizar rotation_history (cerrar entry actual + abrir nueva)
    // El Desktop renderiza la pestaña Rotación desde rotation_history, no desde lot.paddock.
    // Sin esta actualización, el Desktop seguía mostrando el potrero anterior.
    // v4.5.4 FIX: cerrar TODAS las entries abiertas del lote (no solo las que matcheen
    // fromPaddock), porque si el lot.paddock estaba desactualizado o hubo una entry
    // huérfana en otro potrero, quedaba abierta y el lote aparecía en 2 potreros.
    try {
      let rotHist = await getTable(req.tenantId, 'rotation_history');
      if (!Array.isArray(rotHist)) rotHist = [];
      // Cerrar TODAS las entradas abiertas del lote (independientemente del potrero)
      const openEntries = rotHist.filter(r =>
        r && r.lot_code === lot.code && !r.exit_date
      );
      if (openEntries.length > 1) {
        console.log('[lot_rotation] ⚠ ' + lot.code + ' tenía ' + openEntries.length + ' entries abiertas — cerrando todas');
      }
      openEntries.forEach(r => {
        r.exit_date = today;
        r.exit_at = now;
        if (r.entry_at) {
          const entryMs = new Date(r.entry_at).getTime();
          r.days_occupied = Math.floor((Date.now() - entryMs) / (24 * 60 * 60 * 1000));
        }
      });
      // Abrir nueva entrada en el potrero destino (sólo si no hay ya una abierta en ese potrero)
      const alreadyOpenAtTarget = rotHist.some(r =>
        r && r.lot_code === lot.code && !r.exit_date && r.potrero === newPaddock
      );
      if (!alreadyOpenAtTarget) {
        rotHist.push({
          id: Date.now(),
          lot_code: lot.code,
          potrero: newPaddock,
          from_potrero: fromPaddock,
          entry_date: today,
          entry_at: now,
          exit_date: null,
          exit_at: null,
          days_occupied: 0,
          cabezas: lot.animal_count || 0,
          reason: data.reason || (force ? 'forzado vía bot' : ''),
          by: data.by || 'whatsapp',
          source: 'whatsapp'
        });
      }
      await setTable(req.tenantId, 'rotation_history', rotHist);
    } catch (e) {
      console.error('[lot_rotation] error actualizando rotation_history:', e.message);
    }

    // v4.4.8: agregar entry en kardex (contable / trazabilidad)
    try {
      let kardex = await getTable(req.tenantId, 'kardex');
      if (!Array.isArray(kardex)) kardex = [];
      kardex.push({
        id: Date.now() + 3,
        lote: lot.code,
        tipo: 'movimiento',
        fecha: today,
        cabezas: lot.animal_count || 0,
        precio: 0,
        total: 0,
        desc: 'Rotacion: ' + (fromPaddock || '?') + ' → ' + newPaddock + (force ? ' (forzado)' : ''),
        by: data.by || 'whatsapp',
        source: 'whatsapp',
        created_at: now,
        auto: true
      });
      await setTable(req.tenantId, 'kardex', kardex);
    } catch (e) {
      console.error('[lot_rotation] error actualizando kardex:', e.message);
    }

    // Audit log
    const ip = getClientIp(req);
    await appendAuditLog(req.tenantId, {
      action: 'update',
      table: 'lots',
      record_id: lot.code,
      record_summary: 'Rotación: ' + lot.code + ' · ' + fromPaddock + ' → ' + newPaddock + (force ? ' (forzado)' : ''),
      user: data.by || 'whatsapp',
      source: 'bot',
      device_browser: 'WhatsApp',
      ip: ip || ''
    });

    console.log('[lot_rotation]', req.tenantId, lot.code, fromPaddock, '→', newPaddock, force ? '(forced)' : '');

    return res.json({
      ok: true,
      lot_code: lot.code,
      from_paddock: fromPaddock,
      to_paddock: newPaddock,
      animal_count: lot.animal_count,
      pct_post: pctPost,
      message: 'Rotación OK · ' + lot.code + ' movido de ' + fromPaddock + ' a ' + newPaddock + (pctPost ? ' (' + pctPost + '% capacidad)' : '')
    });
  } catch (e) {
    console.error('[lot_rotation] error:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}

app.post('/api/bot-transaction', auth, async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type || !data) return res.status(400).json({ error: 'type y data requeridos' });

    // Whitelist de tipos
    if (!ALLOWED_BOT_TYPES.has(type)) {
      console.warn('[bot-transaction] tipo rechazado:', type, 'tenant:', req.tenantId);
      return res.status(400).json({ error: 'tipo de transacción no permitido: ' + type });
    }

    // ════════════════════════════════════════════════════════════
    // v4.4.5: Handlers especiales (no persisten en tabla homónima)
    // lot_split: separa un lote en sub-lotes según rangos de peso
    // lot_rotation: cambia el potrero de un lote completo
    // ════════════════════════════════════════════════════════════
    if (type === 'lot_split') {
      return await handleLotSplit(req, res, data);
    }
    if (type === 'lot_rotation') {
      return await handleLotRotation(req, res, data);
    }

    const table = type;

    // Deduplicación: rechazar transacciones idénticas en los últimos 2 minutos
    const records = await getTable(req.tenantId, table);
    const list = Array.isArray(records) ? records : [];
    const now = Date.now();
    const dedupKey = JSON.stringify({ type, employee: data.employee || '', amount: data.amount || 0, product_name: data.product_name || '', desc: data.desc || '', lot_code: data.lot_code || '', total: data.total || 0, qty: data.qty || 0, reason: data.reason || '' });
    const duplicate = list.find(function(r) {
      if (!r.source || r.source !== 'whatsapp') return false;
      if (!r.created_at) return false;
      var age = now - new Date(r.created_at).getTime();
      if (age > 120000) return false; // más de 2 min = no es duplicado
      var rKey = JSON.stringify({ type, employee: r.employee || '', amount: r.amount || 0, product_name: r.product_name || '', desc: r.desc || '', lot_code: r.lot_code || '', total: r.total || 0, qty: r.qty || 0, reason: r.reason || '' });
      return rKey === dedupKey;
    });
    if (duplicate) {
      console.log('[Bot TX] DUPLICADO rechazado:', table, dedupKey.slice(0, 80));
      return res.json({ ok: true, id: duplicate.id, type: table, deduplicated: true });
    }

    data.id = table.slice(0,3) + '_' + Date.now();
    data.created_at = new Date().toISOString();
    data.source = 'whatsapp';

    // Si es tratamiento: la lógica de stock se mueve DESPUÉS de validación (v4.4.4).
    // Antes este bloque corría primero y descontaba con el total sin normalizar.
    let stockMsg = '';
    let matchInfo = null;

    // v4.4.3: TREATMENTS - validación y autocompletado de lot_code
    // El bot puede enviar lot_code vacío (sobre todo en scope=individual).
    // El server completa automáticamente desde animals[] o rechaza si falta info.
    // v4.4.4: además valida total > 0 y normaliza unidades (ml ↔ L) según el producto
    if (type === 'treatments') {
      const lotCodeRaw = (data.lot_code || '').toString().trim();
      const scope = (data.scope || '').toString().toLowerCase();
      const animalId = (data.animal_id || '').toString().trim();

      console.log('[bot-tx treatments] entrada:', {
        scope: scope || '(no scope)',
        lot_code: lotCodeRaw || '(vacío)',
        animal_id: animalId || '(no animal)',
        product: data.product_name || '',
        total: data.total,
        count: data.count,
        unit: data.unit
      });

      // ── v4.4.4: validar total > 0 (sino queda curación fantasma como en el screenshot) ──
      const totalNum = parseFloat(data.total);
      if (!totalNum || totalNum <= 0) {
        console.warn('[bot-tx treatments] RECHAZADO: total no válido', data.total);
        return res.status(400).json({
          ok: false,
          error: 'La cantidad total aplicada debe ser mayor a 0. Recibido: ' + (data.total || '(vacío)')
        });
      }

      // ── v4.4.4: normalizar unidad según producto del catálogo ──
      // Si el bot/usuario mandó total en ml pero el producto está en L (o viceversa), convertir.
      // Detección por magnitud sospechosa cuando no se manda unidad o se manda incorrecta.
      if (data.product_name) {
        const productsCat = await getTable(req.tenantId, 'vet_products');
        const prodMatch = (productsCat || []).find(p =>
          p.name && p.name.toLowerCase() === (data.product_name || '').toLowerCase()
        );
        if (prodMatch) {
          const prodUnit = (prodMatch.unit || 'ml').toLowerCase();
          const sentUnit = (data.unit || prodUnit).toLowerCase();

          // Conversión ml ↔ L según unidad del producto
          if (prodUnit === 'l' && sentUnit === 'ml') {
            // Usuario mandó ml, producto es L → convertir
            const totalL = totalNum / 1000;
            console.log('[bot-tx treatments] conversión ml→L:', totalNum + ' ml = ' + totalL + ' L');
            data.total = totalL;
            data.unit = 'L';
            // Si dose también vino en ml, convertir
            if (data.dose) {
              const doseNum = parseFloat(data.dose);
              if (doseNum > 0) data.dose = Math.round((doseNum / 1000) * 10000) / 10000;
            }
          } else if (prodUnit === 'ml' && sentUnit === 'l') {
            // Usuario mandó L, producto es ml → convertir
            const totalMl = totalNum * 1000;
            console.log('[bot-tx treatments] conversión L→ml:', totalNum + ' L = ' + totalMl + ' ml');
            data.total = totalMl;
            data.unit = 'ml';
            if (data.dose) {
              const doseNum = parseFloat(data.dose);
              if (doseNum > 0) data.dose = Math.round(doseNum * 1000 * 100) / 100;
            }
          } else {
            // Mismas unidades o no convertible: respetar la unidad del producto
            data.unit = prodMatch.unit || 'ml';
          }

          // Detección de magnitud sospechosa (heurística):
          // Si producto es [L] y total > 50 L para <100 animales → probablemente quiso ml
          const countNum = parseFloat(data.count) || 1;
          if (prodUnit === 'l' && parseFloat(data.total) > 50 && countNum < 100) {
            console.warn('[bot-tx treatments] ADVERTENCIA magnitud sospechosa:',
              data.total + ' L para ' + countNum + ' animales. Posible error de unidad.');
            // No rechazamos, solo logueamos para auditar
          }

          // Validar stock disponible (avisar si total > stock_qty)
          const stockDisp = parseFloat(prodMatch.stock_qty) || 0;
          if (parseFloat(data.total) > stockDisp + 0.001) {  // tolerancia
            console.warn('[bot-tx treatments] ADVERTENCIA: total > stock', {
              total: data.total,
              stock_disponible: stockDisp,
              producto: prodMatch.name
            });
            // No rechazamos pero podríamos en el futuro
          }
        }
      }

      // ── v4.4.4: auto-derivar dose si falta o es inconsistente ──
      const finalTotal = parseFloat(data.total) || 0;
      const finalCount = parseInt(data.count) || 0;
      if (finalTotal > 0 && finalCount > 0) {
        const expectedDose = finalTotal / finalCount;
        const sentDose = parseFloat(data.dose) || 0;
        if (sentDose <= 0 || Math.abs(sentDose * finalCount - finalTotal) > 0.01) {
          data.dose = Math.round(expectedDose * 1000) / 1000;
          console.log('[bot-tx treatments] dose derivada:', data.dose, '(total/count)');
        }
      }

      // Caso 1: scope=individual sin lot_code → buscar el lote del animal en animals[]
      if (scope === 'individual' && animalId && !lotCodeRaw) {
        const animalsTable = await getTable(req.tenantId, 'animals');
        if (animalsTable && typeof animalsTable === 'object' && !Array.isArray(animalsTable)) {
          let foundLot = null;
          for (const lotKey of Object.keys(animalsTable)) {
            const arr = animalsTable[lotKey] || [];
            const hit = arr.find(a => String(a.animal_id || a.id || '') === animalId);
            if (hit) { foundLot = lotKey; break; }
          }
          if (foundLot) {
            data.lot_code = foundLot;
            console.log('[bot-tx treatments] lot_code autocompletado:', foundLot, 'para animal', animalId);
          } else {
            // Animal no encontrado: rechazar
            console.warn('[bot-tx treatments] RECHAZADO: animal_id', animalId, 'no existe');
            return res.status(400).json({
              ok: false,
              error: 'Animal #' + animalId + ' no encontrado en ningún lote. Verifica el ID.'
            });
          }
        }
      }
      // Caso 2: scope=lote (o sin scope con lot_code) → validar que el lote existe
      else if (lotCodeRaw) {
        const allLots = await getTable(req.tenantId, 'lots') || [];
        // Match exacto, o case-insensitive como fallback
        let matched = allLots.find(l => l && l.code === lotCodeRaw);
        if (!matched) {
          matched = allLots.find(l =>
            l && l.code && l.code.toLowerCase() === lotCodeRaw.toLowerCase()
          );
        }
        if (matched) {
          // Normalizar al code exacto del server (case sensitive consistency)
          if (matched.code !== lotCodeRaw) {
            console.log('[bot-tx treatments] lot_code normalizado:', lotCodeRaw, '→', matched.code);
          }
          data.lot_code = matched.code;
          // Validar que el lote tenga animales (si scope=lote)
          if (scope === 'lote' || scope === 'lot' || !scope) {
            const animalsTable = await getTable(req.tenantId, 'animals');
            const lotAnimals = (animalsTable && animalsTable[matched.code]) || [];
            if (lotAnimals.length === 0 && (matched.animal_count || 0) === 0) {
              console.warn('[bot-tx treatments] ADVERTENCIA: lote', matched.code, 'no tiene animales registrados');
              // No rechazamos (el lote existe), solo log
            }
          }
        } else {
          // Lote no existe: rechazar
          console.warn('[bot-tx treatments] RECHAZADO: lot_code', lotCodeRaw, 'no existe en lots[]');
          const codes = allLots.slice(0, 8).map(l => l.code).filter(Boolean).join(', ');
          return res.status(400).json({
            ok: false,
            error: 'Lote "' + lotCodeRaw + '" no encontrado. Lotes disponibles: ' + codes + (allLots.length > 8 ? '...' : '')
          });
        }
      }
      // Caso 3: ni lot_code ni animal_id → rechazar
      else if (!lotCodeRaw && !animalId) {
        console.warn('[bot-tx treatments] RECHAZADO: sin lot_code ni animal_id');
        return res.status(400).json({
          ok: false,
          error: 'Falta información: especifica un lote (lot_code) o un animal individual (animal_id).'
        });
      }

      // v4.4.4: descontar stock DESPUÉS de toda la validación + normalización de unidades.
      // El total ya está en la unidad correcta del producto.
      if (data.product_name) {
        const productsForStock = await getTable(req.tenantId, 'vet_products');
        const prod = productsForStock.find(p =>
          p.name && p.name.toLowerCase() === (data.product_name || '').toLowerCase()
        );
        if (prod) {
          data.product_id = prod.id;
          // data.unit ya quedó normalizado a prod.unit por el bloque de conversión
          const totalUsed = parseFloat(data.total) || 0;
          if (totalUsed > 0) {
            const stockAntes = prod.stock_qty || 0;
            prod.stock_qty = Math.round((stockAntes - totalUsed) * 100) / 100;
            prod.stock_updated_at = new Date().toISOString();
            await setTable(req.tenantId, 'vet_products', productsForStock);
            stockMsg = '. Stock ' + prod.name + ': ' + prod.stock_qty + ' ' + (prod.unit || 'ml') + ' restante';
            console.log('[bot-tx treatments] stock descontado:', {
              producto: prod.name,
              total: totalUsed,
              unit: prod.unit,
              stock_antes: stockAntes,
              stock_despues: prod.stock_qty
            });
          }
        }
      }
    }

    // ── COMPRAS ──
    // Si es compra multi-item: tiene data.items=[{desc,qty,unit_price,total}]. NO se asocia a stock vet (son items mixtos).
    // Si es compra single-item: tiene data.desc/qty/unit_price y se intenta matching de producto vet.
    if (type === 'purchases' && Array.isArray(data.items) && data.items.length > 0) {
      // Normalizar items y recalcular total si no viene
      const cleanItems = data.items.map(it => {
        const q = parseFloat(it.qty) || 0;
        const u = parseFloat(it.unit_price) || 0;
        const tot = (it.total != null && !isNaN(parseFloat(it.total))) ? parseFloat(it.total) : Math.round(q * u * 100) / 100;
        return { desc: String(it.desc || '').trim(), qty: q, unit: it.unit || '', unit_price: u, total: tot };
      }).filter(it => it.desc);

      if (cleanItems.length) {
        data.items = cleanItems;
        const totalCalc = cleanItems.reduce((s, it) => s + (it.total || 0), 0);
        if (!data.total || parseFloat(data.total) <= 0) data.total = Math.round(totalCalc * 100) / 100;
        // Si la desc top-level no vino, sintetizar resumen
        if (!data.desc || !String(data.desc).trim()) {
          data.desc = cleanItems.map(it => (it.qty ? it.qty + 'x ' : '') + it.desc).join(', ').slice(0, 200);
        }
        // qty top-level = suma de cantidades (informativo)
        if (!data.qty) data.qty = cleanItems.reduce((s, it) => s + (it.qty || 0), 0);
        // unit_price top-level = total / qty si tiene sentido
        if (!data.unit_price && data.qty) data.unit_price = Math.round((data.total / data.qty) * 100) / 100;
        data.is_multi = true;
        stockMsg = '. Compra multi-item con ' + cleanItems.length + ' artículos registrada (total Bs ' + data.total + ')';
      }
    } else if (type === 'purchases' && data.desc) {
      const products = await getTable(req.tenantId, 'vet_products');

      const _norm = (s) => String(s||'')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // quita acentos
        .replace(/[%\-_.,()/]/g, ' ')                        // signos → espacio
        .replace(/\s+/g, ' ')
        .trim();

      const qNorm = _norm(data.desc);
      const qNoSpace = qNorm.replace(/\s+/g, '');
      let prod = null;
      if (qNorm) {
        const qTokens = qNorm.split(' ').filter(t => t.length >= 3);
        const scored = (products || []).map(p => {
          if (!p || !p.name) return null;
          const pNorm = _norm(p.name);
          const pNoSpace = pNorm.replace(/\s+/g, '');
          if (!pNorm) return null;
          let score = 0;
          if (pNorm === qNorm) score = 100;                                          // exacto normalizado
          else if (pNoSpace === qNoSpace && qNoSpace.length >= 5) score = 95;       // exacto sin espacios (penestreptomicina ↔ pen estreptomicina)
          else if (pNorm.includes(qNorm) && qNorm.length >= 4) score = 90;          // query es substring del producto
          else if (qNorm.includes(pNorm) && pNorm.length >= 4) score = 85;          // producto es substring de query
          else if (pNoSpace.includes(qNoSpace) && qNoSpace.length >= 5) score = 80; // substring sin espacios
          else if (qNoSpace.includes(pNoSpace) && pNoSpace.length >= 5) score = 75;
          else {
            // Token overlap (palabras >= 3 chars)
            const pTokens = pNorm.split(' ').filter(t => t.length >= 3);
            if (qTokens.length === 0 || pTokens.length === 0) return null;
            const matched = qTokens.filter(t => pTokens.some(pt => pt === t || pt.startsWith(t) || t.startsWith(pt)));
            if (!matched.length) return null;
            const ratio = matched.length / Math.max(qTokens.length, pTokens.length);
            score = Math.round(ratio * 70);
          }
          return { product: p, score };
        }).filter(x => x && x.score >= 50).sort((a,b) => b.score - a.score);

        if (scored.length) {
          const top = scored[0];
          const second = scored[1];
          // Si hay un segundo candidato muy cercano y el top NO es exacto (100),
          // marcamos como ambiguo y NO asociamos automáticamente
          const ambiguous = !!(second && top.score < 100 && (top.score - second.score) < 10);

          if (ambiguous) {
            matchInfo = {
              ambiguous: true,
              candidates: scored.slice(0, 3).map(s => ({
                name: s.product.name,
                unit: s.product.unit || 'unidades',
                score: s.score,
                stock_qty: s.product.stock_qty || 0
              })),
              user_input: data.desc
            };
            // prod queda null → cae al flujo libre, NO suma a stock
          } else {
            prod = top.product;
            matchInfo = {
              matched_name: prod.name,
              matched_unit: prod.unit || 'unidades',
              score: top.score,
              was_fuzzy: top.score < 100,
              user_input: data.desc
            };
          }
        }
      }

      if (prod) {
        data.product_id = prod.id;
        data.unit = data.unit || prod.unit || 'ml';
        data.type = 'veterinaria';
        const qty = parseFloat(data.qty) || 0;
        if (qty > 0) {
          prod.stock_qty = Math.round(((prod.stock_qty || 0) + qty) * 100) / 100;
          prod.stock_updated_at = new Date().toISOString();
          await setTable(req.tenantId, 'vet_products', products);
          if (matchInfo && matchInfo.was_fuzzy) {
            stockMsg = '. ⚠️ Asociado a *' + prod.name + '* (unidad: ' + (prod.unit || 'unidades') + '). Stock ahora: ' + prod.stock_qty + ' ' + (prod.unit || 'ml') + ' (+' + qty + '). Si las unidades no coinciden, edita desde la app';
          } else {
            stockMsg = '. Stock ' + prod.name + ': ' + prod.stock_qty + ' ' + (prod.unit || 'ml') + ' (+' + qty + ')';
          }
          // Limpiar alerta de stock bajo si ya superó el mínimo
          if (prod.stock_qty > (prod.stock_min || 0)) {
            const alerts = await getTable(req.tenantId, 'health_alerts');
            const filtered = alerts.filter(a => !(a.type === 'stock_low' && a.title && a.title.includes(prod.name) && !a.resolved));
            if (filtered.length !== alerts.length) await setTable(req.tenantId, 'health_alerts', filtered);
          }
        }
      } else if (matchInfo && matchInfo.ambiguous) {
        // Productos similares encontrados — no asociamos automáticamente
        const list = matchInfo.candidates.map(c => '*' + c.name + '* (' + c.unit + ', stock ' + c.stock_qty + ')').join(' / ');
        stockMsg = '. ⚠️ Encontré varios productos similares: ' + list + '. Compra registrada SIN asociar a stock — edita desde Desktop para vincular al correcto';
      } else {
        // No hay match cercano → flujo actual (compra sin stock)
        stockMsg = '. Sin coincidencia en stock veterinario, registrado como compra suelta';
      }
    }

    // Si vino subcuenta explícita (del bot o donde sea), resolver cuenta + tipo_gasto desde el catálogo
    if (type === 'purchases' && data.subcuenta && (!data.cuenta || !data.tipo_gasto)) {
      try {
        const params = await getTable(req.tenantId, 'estancia_params');
        const subs = (params && params.subcuentas) || [];
        const cuentas = (params && params.cuentas) || [];
        const subObj = subs.find(s => s.name && data.subcuenta && s.name.toLowerCase() === String(data.subcuenta).toLowerCase());
        if (subObj) {
          if (!data.cuenta) data.cuenta = subObj.cuenta || '';
          if (!data.tipo_gasto && subObj.cuenta_tipo) data.tipo_gasto = subObj.cuenta_tipo;
          if (!data.tipo_gasto) {
            const cuObj = cuentas.find(c => c.name === data.cuenta);
            data.tipo_gasto = cuObj ? cuObj.tipo_gasto : 'VARIABLE';
          }
        }
      } catch(e) { /* sin params, sigue */ }
    }

    // v4.5.14: Inferir paddock y normalizar fecha para tablas de actividad por lote enviadas por el bot.
    // El bot manda registros vía /api/bot-transaction (este endpoint), no /api/sal directo,
    // por lo que el middleware _inferPaddockMiddleware no se activa aquí.
    // También el bot manda 'fecha' (español) mientras Desktop espera 'date' — normalizamos a ambos.
    const ACTIVITY_TABLES_BOT = ['sal', 'agua', 'alimento', 'conteo', 'partos'];
    if (ACTIVITY_TABLES_BOT.indexOf(type) >= 0) {
      // Normalizar fecha: si el bot mandó "fecha" pero no "date", copiar; y viceversa
      if (data.fecha && !data.date) data.date = data.fecha;
      if (data.date && !data.fecha) data.fecha = data.date;
      // Si ninguno existe, usar today
      if (!data.fecha && !data.date) {
        const today = new Date().toISOString().slice(0, 10);
        data.fecha = today;
        data.date = today;
      }

      // Inferir paddock si el bot no lo mandó
      if (!data.paddock || !String(data.paddock).trim()) {
        if (data.lot_code) {
          const lotsForBot = await getTable(req.tenantId, 'lots') || [];
          const lotMatch = lotsForBot.find(l => l && l.code === data.lot_code);
          if (lotMatch && lotMatch.paddock) {
            data.paddock = lotMatch.paddock;
            console.log(`[bot-tx infer-paddock] tenant=${req.tenantId} type=${type} lot=${data.lot_code} → paddock="${lotMatch.paddock}"`);
          }
        }
      }

      // v4.5.16: default tipo='mineral' para registros de sal sin tipo explícito.
      // El bot WhatsApp y PWA no preguntan tipo, así que llegan con tipo=null/undefined/''
      // y en Desktop salen como "Sin clasificar". Asumimos mineral como default razonable;
      // si después se quiere especificar otro tipo, se edita o se actualiza el flow del bot.
      if (type === 'sal' && (!data.tipo || !String(data.tipo).trim())) {
        data.tipo = 'mineral';
        console.log(`[bot-tx default-tipo] tenant=${req.tenantId} lot=${data.lot_code} → tipo="mineral"`);
      }
    }

    // Guardar el registro (con product_id ya asignado)
    // Tasks y movimientos se manejan por separado con formato propio
    if (type !== 'tasks' && type !== 'animal_movements' && type !== 'tasks_complete') {
      list.push(data);
      await setTable(req.tenantId, table, list);

      // If bot sent a photo, save it to transaction_images
      if (data.photo_base64 || req.body.photo_base64) {
        try {
          const photoB64 = data.photo_base64 || req.body.photo_base64;
          const txId = table.slice(0,4) + '_' + data.id;
          const imgList = await getTable(req.tenantId, 'transaction_images');
          const images = Array.isArray(imgList) ? imgList : [];
          images.push({
            id: 'img_' + Date.now(),
            transaction_id: txId,
            transaction_type: table,
            base64: photoB64.replace(/^data:image\/\w+;base64,/, ''),
            mime_type: 'image/jpeg',
            size_kb: Math.round(photoB64.length / 1024),
            created_at: new Date().toISOString(),
            uploaded_by: 'WhatsApp'
          });
          await setTable(req.tenantId, 'transaction_images', images);
          data.has_photo = true;
          // Re-save record with has_photo flag
          await setTable(req.tenantId, table, list);
          console.log('[Bot] Photo saved for', txId, Math.round(photoB64.length/1024)+'KB');
        } catch(e) { console.error('[Bot] Photo save error:', e.message); }
      }
    }

    // Si es mover animal entre lotes
    if (type === 'animal_movements') {
      try {
        const animals = await getTable(req.tenantId, 'animals');
        const lots = await getTable(req.tenantId, 'lots');
        const fromLot = data.from_lot;
        const toLot = data.to_lot;
        const animalId = String(data.animal_id);
        if (animals[fromLot]) {
          const animalIdx = animals[fromLot].findIndex(a => String(a.id || a.animal_id) === animalId);
          if (animalIdx > -1) {
            const animal = animals[fromLot].splice(animalIdx, 1)[0];
            if (!animals[toLot]) animals[toLot] = [];
            animals[toLot].push(animal);
            await setTable(req.tenantId, 'animals', animals);
            // Update lot counts
            const fromL = lots.find(l => l.code === fromLot);
            const toL = lots.find(l => l.code === toLot);
            if (fromL && fromL.animal_count > 0) fromL.animal_count--;
            if (toL) toL.animal_count++;
            await setTable(req.tenantId, 'lots', lots);
            stockMsg = '. Animal #' + animalId + ' movido de ' + fromLot + ' a ' + toLot;
          } else {
            stockMsg = '. Animal #' + animalId + ' no encontrado en lote ' + fromLot;
          }
        }
      } catch(e) { console.error('[MoverAnimal] Error:', e.message); }
    }

    // Si es venta individual (un animal específico)
    if (type === 'sales' && data.animal_id) {
      try {
        const animals = await getTable(req.tenantId, 'animals');
        const lots = await getTable(req.tenantId, 'lots');
        const lotCode = data.lot_code;
        const animalId = String(data.animal_id);
        if (animals[lotCode]) {
          animals[lotCode] = animals[lotCode].filter(a => String(a.id || a.animal_id) !== animalId);
          await setTable(req.tenantId, 'animals', animals);
          const lot = lots.find(l => l.code === lotCode);
          if (lot && lot.animal_count > 0) {
            lot.animal_count--;
            await setTable(req.tenantId, 'lots', lots);
          }
          stockMsg += '. Animal #' + animalId + ' vendido y removido del lote ' + lotCode;
        }
      } catch(e) { console.error('[VentaIndividual] Error:', e.message); }
    }

    // Si es completar tarea
    if (type === 'tasks_complete') {
      try {
        const tasks = await getTable(req.tenantId, 'tasks');
        const taskId = data.task_id;
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          task.status = 'completada';
          task.completed_at = new Date().toISOString();
          task.completed_by = 'WhatsApp';
          if (data.comment) task.completion_comment = data.comment;
          await setTable(req.tenantId, 'tasks', tasks);
          stockMsg = '. Tarea completada: ' + task.title;
        } else {
          stockMsg = '. Tarea ' + taskId + ' no encontrada';
        }
      } catch(e) { console.error('[TaskComplete] Error:', e.message); }
    }

    // Conteo con alerta automática
    if (type === 'conteo') {
      try {
        const lots = await getTable(req.tenantId, 'lots');
        const lotObj = lots.find(l => l.code === data.lot_code);
        const ref = lotObj ? (lotObj.animal_count || 0) : 0;
        const counted = parseInt(data.counted) || 0;
        const diff = counted - ref;
        const conteoRec = {
          id: Date.now(), lot_code: data.lot_code, date: data.date || new Date().toISOString().slice(0,10),
          counted, ref, diff, obs: data.obs || '', by: data.by || 'WhatsApp', source: 'whatsapp', created_at: new Date().toISOString()
        };
        const conteos = await getTable(req.tenantId, 'conteo');
        conteos.push(conteoRec);
        await setTable(req.tenantId, 'conteo', conteos);

        if (diff < 0) {
          const faltantes = Math.abs(diff);
          // Create alert
          const alerts = await getTable(req.tenantId, 'health_alerts');
          const existAlert = alerts.find(a => !a.resolved && a.type === 'conteo_diff' && a.lot_code === data.lot_code);
          if (!existAlert) {
            alerts.push({id: Date.now(), type:'conteo_diff', severity:'critical', lot_code: data.lot_code, title:'⚠️ Faltan '+faltantes+' animales - Lote '+data.lot_code, message:'Conteo: '+counted+' contadas vs '+ref+' en sistema.', resolved:false, created_at: new Date().toISOString(), by: data.by || 'WhatsApp'});
          } else {
            existAlert.message = 'Conteo: '+counted+' contadas vs '+ref+' en sistema. Faltan '+faltantes+'.';
            existAlert.created_at = new Date().toISOString();
          }
          await setTable(req.tenantId, 'health_alerts', alerts);

          // Create task
          const tasks = await getTable(req.tenantId, 'tasks');
          const existTask = tasks.find(t => t.status === 'pendiente' && t.title.includes('Faltante Lote '+data.lot_code));
          if (!existTask) {
            tasks.push({id:'task_'+Date.now(), title:'Investigar faltante Lote '+data.lot_code+' ('+faltantes+' cab)', desc:'Conteo reportó '+faltantes+' animales faltantes. Contados: '+counted+', sistema: '+ref+'.', assignee:'', priority:'alta', due: conteoRec.date, lot: data.lot_code, status:'pendiente', created_at: new Date().toISOString(), by:'Auto'});
            await setTable(req.tenantId, 'tasks', tasks);
          }
          return res.json({ok:true, type:'conteo', conteo: conteoRec, alert:'Faltan '+faltantes+' animales', task_created: !existTask});
        } else if (diff === 0) {
          // Resolve alert
          const alerts = await getTable(req.tenantId, 'health_alerts');
          let resolved = false;
          alerts.forEach(a => { if (a.type === 'conteo_diff' && a.lot_code === data.lot_code && !a.resolved) { a.resolved = true; a.resolved_at = new Date().toISOString(); resolved = true; } });
          if (resolved) await setTable(req.tenantId, 'health_alerts', alerts);
          return res.json({ok:true, type:'conteo', conteo: conteoRec, message:'Conteo cuadra: '+counted+' cabezas'});
        }
        return res.json({ok:true, type:'conteo', conteo: conteoRec, diff});
      } catch(e) { return res.status(500).json({error: e.message}); }
    }

    // Si es tarea, formatear y agregar a la tabla de tasks
    if (type === 'tasks') {
      try {
        const tasks = await getTable(req.tenantId, 'tasks');
        const newTask = {
          id: 'task_' + Date.now(),
          title: data.title || 'Sin título',
          desc: data.desc || '',
          assignee: data.assignee || '',
          priority: data.priority || 'media',
          due: data.due || '',
          lot: data.lot || '',
          status: 'pendiente',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          by: 'WhatsApp'
        };
        tasks.push(newTask);
        await setTable(req.tenantId, 'tasks', tasks);
        stockMsg = '. Tarea creada: ' + newTask.title + (newTask.assignee ? ' → ' + newTask.assignee : '');
      } catch(e) { console.error('[Tasks] Error:', e.message); }
    }

    // Si es baja (muerte), descontar del lote y eliminar del kardex de animales
    // FIX BAJAS (v1.4.26): animals[lot].length es la ÚNICA fuente de verdad de animal_count.
    // Antes el bot hacía lot.animal_count-- manualmente, lo que mantenía cualquier
    // desincronización previa. Ahora primero eliminamos el animal del kardex y después
    // recalculamos animal_count = animals[lot].length, garantizando coherencia.
    if (type === 'bajas' && data.animal_id && data.lot_code) {
      try {
        const lots = await getTable(req.tenantId, 'lots');
        const lot = lots.find(l => l.code === data.lot_code);
        if (!lot) {
          return res.status(400).json({ ok: false, error: 'Lote ' + data.lot_code + ' no encontrado' });
        }
        // Validar que el animal existe
        const animals = await getTable(req.tenantId, 'animals');
        const lotAnimals = (animals && animals[data.lot_code]) ? animals[data.lot_code] : [];
        const animal = lotAnimals.find(a =>
          String(a.id || a.animal_id || '') === String(data.animal_id)
        );
        if (!animal) {
          return res.status(400).json({ ok: false, error: 'Animal #' + data.animal_id + ' no encontrado en lote ' + data.lot_code + '. Verifica el ID.' });
        }
        // Guardar último peso del animal
        if (animal.pesajes && animal.pesajes.length) {
          data.ultimo_peso = animal.pesajes[animal.pesajes.length - 1].peso || 0;
        }
        data.raza = animal.breed || animal.raza || '';
        // Eliminar del kardex de animales (PRIMERO)
        animals[data.lot_code] = lotAnimals.filter(a =>
          String(a.id || a.animal_id || '') !== String(data.animal_id)
        );
        await setTable(req.tenantId, 'animals', animals);
        // Recalcular animal_count del lote a partir de animals[code].length (DESPUÉS)
        const newCount = animals[data.lot_code].length;
        const oldCount = lot.animal_count || 0;
        lot.animal_count = newCount;
        lot.server_updated_at = new Date().toISOString();
        await setTable(req.tenantId, 'lots', lots);
        if (oldCount !== newCount) {
          console.log(`[bot-transaction baja] tenant_${req.tenantId}: Lote ${data.lot_code} animal_count ${oldCount} → ${newCount}`);
        }
        stockMsg = '. Animal #' + data.animal_id + ' (' + (data.raza||'') + ', ' + (data.ultimo_peso||0) + 'kg) dado de baja del lote ' + data.lot_code;
      } catch(e) { console.error('[Baja] Error:', e.message); }
    }

    // Si es diesel recarga, actualizar nivel del tanque
    if (type === 'diesel' && data.type === 'recarga') {
      try {
        let tanks = await getTable(req.tenantId, 'diesel_tank');
        if (!Array.isArray(tanks)) tanks = [{ id: 'tank_1', name: 'Cisterna Principal', capacity: (tanks && tanks.capacity) || 1000, current_level: (tanks && tanks.current_level) || 0 }];
        // v4.5.5 FIX: resolver tanque incluso si el bot mandó tank_name en vez de tank_id.
        // Gemini a veces dice "Cisterna Principal" en chat pero no incluye tank_id en el body.
        // Buscar por id, name (case-insensitive) o tomar el primero como fallback.
        let tank = null;
        if (data.tank_id) tank = tanks.find(t => t.id === data.tank_id);
        if (!tank && data.tank_name) tank = tanks.find(t => String(t.name||'').toLowerCase() === String(data.tank_name).toLowerCase());
        if (!tank && data._tank_name) tank = tanks.find(t => String(t.name||'').toLowerCase() === String(data._tank_name).toLowerCase());
        if (!tank) tank = tanks[0];
        const litros = parseFloat(data.litros) || 0;
        // Validación: rechazar si excede capacidad
        if ((tank.current_level + litros) > tank.capacity) {
          const espacio = Math.round((tank.capacity - tank.current_level) * 10) / 10;
          return res.status(400).json({ ok: false, error: 'Excede capacidad de ' + tank.name + ' (' + tank.capacity + ' L). Espacio disponible: ' + espacio + ' L' });
        }
        tank.current_level = Math.round((tank.current_level + litros) * 10) / 10;
        await setTable(req.tenantId, 'diesel_tank', tanks);
        // v4.5.5 FIX: enriquecer el record con info del tanque para que persista
        data.tank_id = tank.id;
        data.tank_name = tank.name;
        data._tank_name = tank.name; // compat con PWA v9.7.28 que lee este campo
        data.tanque = tank.name; // compat con vistas viejas
        stockMsg += '. ' + tank.name + ': ' + tank.current_level + ' L';
      } catch(e) { console.error('[diesel recarga]', e.message); }
    }
    if (type === 'diesel' && data.type === 'despacho') {
      try {
        let tanks = await getTable(req.tenantId, 'diesel_tank');
        if (!Array.isArray(tanks)) tanks = [{ id: 'tank_1', name: 'Cisterna Principal', capacity: (tanks && tanks.capacity) || 1000, current_level: (tanks && tanks.current_level) || 0 }];
        // v4.5.5 FIX: idem recarga, resolver tanque por id/name/fallback
        let tank = null;
        if (data.tank_id) tank = tanks.find(t => t.id === data.tank_id);
        if (!tank && data.tank_name) tank = tanks.find(t => String(t.name||'').toLowerCase() === String(data.tank_name).toLowerCase());
        if (!tank && data._tank_name) tank = tanks.find(t => String(t.name||'').toLowerCase() === String(data._tank_name).toLowerCase());
        if (!tank) tank = tanks[0];
        const litros = parseFloat(data.litros) || 0;
        // Validación: rechazar si stock insuficiente
        if (litros > tank.current_level) {
          return res.status(400).json({ ok: false, error: 'Stock insuficiente en ' + tank.name + '. Disponible: ' + tank.current_level + ' L, solicitado: ' + litros + ' L' });
        }
        tank.current_level = Math.round((tank.current_level - litros) * 10) / 10;
        if (tank.current_level < 0) tank.current_level = 0;
        await setTable(req.tenantId, 'diesel_tank', tanks);
        // v4.5.5 FIX: enriquecer el record con info del tanque para que persista
        data.tank_id = tank.id;
        data.tank_name = tank.name;
        data._tank_name = tank.name; // compat con PWA v9.7.28 que lee este campo
        data.tanque = tank.name; // compat con vistas viejas
        stockMsg += '. ' + tank.name + ': ' + tank.current_level + ' L';
      } catch(e) { console.error('[diesel despacho]', e.message); }
    }

    console.log('[Bot TX]', req.tenantId, table, data.id, stockMsg);

    // ── Audit log para acciones del bot ────────────────────────
    // Genera un log con source='bot', user=phone (si viene en headers) o 'WhatsApp'
    try {
      const botPhone = req.headers['x-bot-phone'] || data.by || '';
      const botUser = botPhone ? String(botPhone).replace(/[^\d+]/g, '').slice(0, 20) : 'WhatsApp';

      // Construir summary descriptivo según el tipo
      let summary = '';
      const fmtAmt = (n) => (n != null && !isNaN(n)) ? Number(n).toLocaleString('es-BO', { maximumFractionDigits: 2 }) : '';
      switch(table) {
        case 'treatments':
          summary = 'Curación: ' + (data.product_name || '?') + (data.lot_code ? ' · Lote ' + data.lot_code : '') + (data.total ? ' · ' + fmtAmt(data.total) + ' ' + (data.unit || 'ml') : '');
          break;
        case 'sales':
          summary = 'Venta: ' + (data.buyer || '?') + ' · ' + (data.animals || data.animal_id ? '1 cab' : '?') + ' · Bs ' + fmtAmt(data.total || 0);
          break;
        case 'purchases':
          summary = 'Compra: ' + (data.desc || '?').slice(0, 80) + ' · Bs ' + fmtAmt(data.total || 0);
          break;
        case 'maintenance':
          summary = 'Mantenimiento: ' + (data.desc || '?').slice(0, 80) + (data.equipo ? ' · ' + data.equipo : '');
          break;
        case 'advances':
          summary = 'Adelanto: ' + (data.employee || '?') + ' · Bs ' + fmtAmt(data.amount || 0);
          break;
        case 'lluvias':
          summary = 'Lluvia: ' + (data.mm || 0) + ' mm' + (data.pluviometro ? ' · ' + data.pluviometro : '');
          break;
        case 'agua':
          summary = 'Agua: Lote ' + (data.lot_code || '?') + ' · ' + (data.litros || data.qty || '?') + ' L';
          break;
        case 'sal':
          summary = 'Sal: Lote ' + (data.lot_code || '?') + ' · ' + (data.kg || data.qty || '?') + ' kg';
          break;
        case 'conteo':
          summary = 'Conteo: Lote ' + (data.lot_code || '?') + ' · ' + (data.counted || '?') + ' cab';
          break;
        case 'partos':
          summary = 'Parto: Lote ' + (data.lot_code || '?') + (data.terneros ? ' · ' + data.terneros + ' terneros' : '');
          break;
        case 'alimento':
          summary = 'Alimento: Lote ' + (data.lot_code || '?') + ' · ' + (data.product || data.desc || '?');
          break;
        case 'bajas':
          summary = 'Baja: Lote ' + (data.lot_code || '?') + ' · ' + (data.reason || '?');
          break;
        case 'diesel':
          if (data.type === 'carga') summary = 'Diesel carga: ' + (data.litros || 0) + ' L';
          else if (data.type === 'despacho') summary = 'Diesel despacho: ' + (data.litros || 0) + ' L · ' + (data.equipo || data.vehiculo || '?');
          else summary = 'Diesel: ' + (data.litros || 0) + ' L';
          break;
        case 'aceite':
          summary = 'Aceite: ' + (data.litros || 0) + ' L' + (data.equipo ? ' · ' + data.equipo : '');
          break;
        case 'animal_movements':
          summary = 'Movido: Animal #' + (data.animal_id || '?') + ' de ' + (data.from_lot_code || '?') + ' → ' + (data.to_lot_code || '?');
          break;
        case 'tasks_complete':
          summary = 'Tarea completada: ' + (data.task_id || '?') + (data.comment ? ' · ' + String(data.comment).slice(0, 80) : '');
          break;
        default:
          summary = String(table) + ': ' + (data.desc || data.summary || data.id || '?').toString().slice(0, 100);
      }

      const ip = getClientIp(req);
      await appendAuditLog(req.tenantId, {
        action: type === 'tasks_complete' ? 'update' : 'create',
        table: table === 'tasks_complete' ? 'tasks' : table,
        record_id: data.id || data.task_id || '',
        record_summary: summary,
        user: botUser,
        source: 'bot',
        device_os: '',
        device_browser: 'WhatsApp',
        ip: ip || '',
        geo_city: '',
        app_version: req.headers['x-bot-version'] || 'n8n',
      });
    } catch(e) {
      console.error('[Bot Audit] Error logueando:', e.message);
    }

    // ════════════════════════════════════════════════════════════
    // v4.11.0: saldo del mes del empleado tras registrar un adelanto.
    // Misma fórmula que el Desktop: salario − deuda_arrastrada − adelantos del mes.
    // El adelanto ya está en `list` (se hizo push arriba), así que el total es real.
    // Campo aditivo: solo lo lee el bot; no afecta sync-pull/push ni al Desktop.
    // ════════════════════════════════════════════════════════════
    let saldoMes = null;
    if (type === 'advances' && data && data.employee) {
      try {
        const empsTbl = await getTable(req.tenantId, 'employees');
        const empRec = (Array.isArray(empsTbl) ? empsTbl : []).find(function(e){ return e.name === data.employee; });
        if (empRec) {
          const salario = parseFloat(empRec.salary) || 0;
          const deudaPrevia = parseFloat(empRec.deuda_arrastrada) || 0;
          const mesAdv = String(data.date || data.created_at || '').slice(0, 7); // YYYY-MM
          const advMes = (Array.isArray(list) ? list : [])
            .filter(function(a){ return a.employee === data.employee && String(a.date || '').slice(0,7) === mesAdv; })
            .reduce(function(s,a){ return s + (parseFloat(a.amount) || 0); }, 0);
          const balance = salario - deudaPrevia - advMes;
          saldoMes = {
            mes: mesAdv,
            salario: salario,
            deuda_previa: deudaPrevia,
            adelantos_mes: advMes,
            neto: Math.max(0, balance),
            deuda_resultante: balance < 0 ? Math.abs(balance) : 0,
            excede: balance < 0
          };
        }
      } catch(e) { console.error('[bot-tx advances saldo] error:', e.message); }
    }

    res.json({ ok: true, id: data.id, type: table, stock: stockMsg, match_info: matchInfo || null, saldo_mes: saldoMes });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Transaction Images ──────────────────────────────────────
app.post('/api/transaction-image', auth, async (req, res) => {
  try {
    const { transaction_id, transaction_type, base64, mime_type } = req.body;
    if (!transaction_id || !base64) return res.status(400).json({ error: 'transaction_id y base64 requeridos' });
    const images = await getTable(req.tenantId, 'transaction_images');
    const list = Array.isArray(images) ? images : [];
    const record = {
      id: 'img_' + Date.now(),
      transaction_id,
      transaction_type: transaction_type || 'unknown',
      base64: base64,
      mime_type: mime_type || 'image/jpeg',
      size_kb: Math.round(base64.length / 1024),
      created_at: new Date().toISOString(),
      uploaded_by: req.body.uploaded_by || 'unknown'
    };
    list.push(record);
    await setTable(req.tenantId, 'transaction_images', list);
    console.log('[Image]', req.tenantId, record.id, record.size_kb + 'KB for', transaction_id);
    // Update has_photo on source record
    if (transaction_type && transaction_type !== 'unknown') {
      try {
        const sourceTable = transaction_type;
        const sourceRecords = await getTable(req.tenantId, sourceTable);
        if (Array.isArray(sourceRecords)) {
          const srcRec = sourceRecords.find(r => String(r.id) === String(transaction_id));
          if (srcRec) {
            srcRec.has_photo = true;
            await setTable(req.tenantId, sourceTable, sourceRecords);
            console.log('[Image] Updated has_photo on', sourceTable, transaction_id);
          }
        }
      } catch(e) { console.log('[Image] Could not update has_photo:', e.message); }
    }
    res.json({ ok: true, id: record.id, size_kb: record.size_kb });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transaction-image/:txId', auth, async (req, res) => {
  try {
    const images = await getTable(req.tenantId, 'transaction_images');
    const img = (Array.isArray(images) ? images : []).find(i => i.transaction_id === req.params.txId);
    if (!img) return res.status(404).json({ error: 'No image' });
    res.json({ id: img.id, transaction_id: img.transaction_id, base64: img.base64, mime_type: img.mime_type, size_kb: img.size_kb, created_at: img.created_at });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/transaction-images/list', auth, async (req, res) => {
  try {
    const images = await getTable(req.tenantId, 'transaction_images');
    const list = (Array.isArray(images) ? images : []).map(i => ({ id: i.id, transaction_id: i.transaction_id, transaction_type: i.transaction_type, size_kb: i.size_kb, created_at: i.created_at }));
    res.json(list);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Send PDF via WhatsApp ─────────────────────────────────────
app.post('/api/send-whatsapp-pdf', auth, async (req, res) => {
  try {
    const { base64, phone, caption, filename, meta_token, phone_number_id } = req.body;
    if (!base64 || !phone) return res.status(400).json({ error: 'base64 y phone requeridos' });

    const token = meta_token || process.env.META_TOKEN;
    const phoneId = phone_number_id || process.env.META_PHONE_ID || '1124983387355546';
    if (!token) return res.status(400).json({ error: 'META_TOKEN no configurado' });

    const pdfBuffer = Buffer.from(base64, 'base64');
    const boundary = '----FormBoundary' + Date.now();
    const parts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="messaging_product"\r\n\r\nwhatsapp\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename || 'informe.pdf'}"\r\nContent-Type: application/pdf\r\n\r\n`,
    ];
    const bodyEnd = `\r\n--${boundary}--\r\n`;
    const fullBody = Buffer.concat([Buffer.from(parts[0]), Buffer.from(parts[1]), pdfBuffer, Buffer.from(bodyEnd)]);

    // 1. Upload media
    // Node 18+ has built-in fetch, no need for node-fetch
    const uploadRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: fullBody
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.id) {
      console.error('[WA-PDF] Upload failed:', JSON.stringify(uploadData));
      return res.status(500).json({ error: 'Upload to Meta failed', details: uploadData });
    }

    // 2. Send document message
    const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: phone, type: 'document',
        document: { id: uploadData.id, filename: filename || 'informe.pdf', caption: caption || 'Informe EstanciaPro' }
      })
    });
    const sendData = await sendRes.json();
    console.log('[WA-PDF] Sent to', phone, 'media_id:', uploadData.id);
    res.json({ ok: true, media_id: uploadData.id, message_id: sendData.messages?.[0]?.id });
  } catch(e) {
    console.error('[WA-PDF] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Sistema de tickets de soporte (reemplaza /api/bot-escalate-bug viejo) ──
// ═══════════════════════════════════════════════════════════════════════════
// Flujo:
//  1. Usuario escribe /soporte en WhatsApp → bot llama POST /api/support-ticket
//     → server crea ticket en estado 'abierto', retorna {id, code}
//  2. Bot setea flag pending_support_ticket en sesión
//  3. Cada mensaje del usuario (texto, audio transcripto, foto) hasta LISTO/comando
//     → bot llama POST /api/support-ticket/:id/append
//  4. Cuando usuario dice LISTO → bot llama POST /api/support-ticket/:id/close
//  5. Admin (vos) ve tickets en App Auditoría con GET /api/admin/support-tickets
//  6. Admin cambia estado/agrega nota con PATCH /api/admin/support-ticket/:id
//  7. Cuando cambia a 'resuelto', server envía mensaje al usuario via WhatsApp
//     - Si falla (>24h sin mensaje del usuario), queda en cola para enviar después
//
// Tablas:
//   support_tickets: id, code, tenant_id, user_phone, status, description,
//                    resolution_note, created_at, updated_at, resolved_at,
//                    pending_notification (bool, true si falló envío proactivo)
//   support_attachments: id, ticket_id, kind ('image'), data_base64, received_at

// ── Helper: generar código humano-amigable del ticket (SUP-XXX)
async function _generateTicketCode() {
  try {
    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) tickets = [];
    // Encontrar el número más alto y sumar 1
    let maxNum = 0;
    tickets.forEach(t => {
      const m = (t.code || '').match(/^SUP-(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    });
    return 'SUP-' + String(maxNum + 1).padStart(3, '0');
  } catch (e) {
    return 'SUP-' + Date.now().toString().slice(-6);
  }
}

// ── POST /api/support-ticket: crear ticket vacío
app.post('/api/support-ticket', auth, async (req, res) => {
  try {
    const { user_phone, user_name } = req.body;
    if (!user_phone) return res.status(400).json({ error: 'user_phone requerido' });

    // Cargar info del tenant para el nombre legible
    let tenantName = 'Desconocido';
    try {
      const branding = await getTable(req.tenantId, 'branding');
      const brand = (branding && !Array.isArray(branding)) ? branding : {};
      tenantName = brand.nombre || brand.estancia_name || 'Sin nombre';
    } catch (e) {}

    const code = await _generateTicketCode();
    const ticket = {
      id: 'tkt_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      code: code,
      tenant_id: req.tenantId,
      tenant_name: tenantName,
      user_phone: user_phone,
      user_name: user_name || null,
      status: 'abierto',
      description: '',
      messages_count: 0,
      images_count: 0,
      resolution_note: null,
      resolved_by: null,
      resolved_at: null,
      pending_notification: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) tickets = [];
    tickets.push(ticket);
    if (tickets.length > 500) tickets = tickets.slice(-500); // cap
    await setTable('global', 'support_tickets', tickets);

    console.log('[Support]', code, 'creado para', user_phone, '(' + tenantName + ')');
    res.json({ ok: true, id: ticket.id, code: code });
  } catch (e) {
    console.error('[Support create]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/support-ticket/:id/append: agregar contenido al ticket
app.post('/api/support-ticket/:id/append', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { kind, content, image_base64, audio_transcript } = req.body;
    // kind: 'text' | 'audio_transcript' | 'image'
    // content: texto (para text)
    // image_base64: base64 (para image)
    // audio_transcript: texto transcripto por Gemini (para audio_transcript)

    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) return res.status(404).json({ error: 'ticket no encontrado' });
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return res.status(404).json({ error: 'ticket no encontrado: ' + id });
    if (ticket.status !== 'abierto') {
      return res.status(400).json({ error: 'ticket no está abierto, estado: ' + ticket.status });
    }

    // Append según tipo
    if (kind === 'text' && content) {
      ticket.description = (ticket.description || '') + (ticket.description ? '\n\n' : '') + content;
      ticket.messages_count = (ticket.messages_count || 0) + 1;
    } else if (kind === 'audio_transcript' && audio_transcript) {
      ticket.description = (ticket.description || '') + (ticket.description ? '\n\n' : '') + '[audio]: ' + audio_transcript;
      ticket.messages_count = (ticket.messages_count || 0) + 1;
    } else if (kind === 'image' && image_base64) {
      // Guardar imagen en tabla separada
      let attachments = await getTable('global', 'support_attachments');
      if (!Array.isArray(attachments)) attachments = [];
      const attachment = {
        id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        ticket_id: id,
        kind: 'image',
        data_base64: image_base64,
        received_at: new Date().toISOString()
      };
      attachments.push(attachment);
      // Cap a 1000 attachments totales (auditoría no debería crecer infinito)
      if (attachments.length > 1000) attachments = attachments.slice(-1000);
      await setTable('global', 'support_attachments', attachments);
      ticket.images_count = (ticket.images_count || 0) + 1;
    } else {
      return res.status(400).json({ error: 'kind inválido o falta content/image_base64/audio_transcript' });
    }

    ticket.updated_at = new Date().toISOString();
    await setTable('global', 'support_tickets', tickets);

    res.json({ ok: true, messages_count: ticket.messages_count, images_count: ticket.images_count });
  } catch (e) {
    console.error('[Support append]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/support-ticket/:id/close: cerrar captura (NO cambia status a resuelto, solo cierra el modo abierto)
// El status sigue siendo 'abierto' hasta que admin lo procese.
// v4.3.8: dispara triage automático con Claude (best-effort, no bloquea respuesta al bot)
app.post('/api/support-ticket/:id/close', auth, async (req, res) => {
  try {
    const { id } = req.params;
    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) return res.status(404).json({ error: 'ticket no encontrado' });
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return res.status(404).json({ error: 'ticket no encontrado' });

    ticket.updated_at = new Date().toISOString();

    // Triage automático con Claude (best-effort). Si falla, el ticket se cierra igual.
    // El admin puede correr "Analizar con Claude" manualmente desde la app.
    let triageResult = null;
    if (ANTHROPIC_API_KEY) {
      try {
        triageResult = await _runTriageAnalysis(ticket);
        if (!triageResult.ok) {
          console.warn('[Triage auto]', ticket.code, 'falló:', triageResult.error, '— ticket se cierra sin análisis');
        }
      } catch (triageErr) {
        // Defensivo: cualquier excepción no debe romper el cierre
        console.error('[Triage auto]', ticket.code, 'excepción no capturada:', triageErr.message);
        triageResult = { ok: false, error: triageErr.message };
      }
    } else {
      console.log('[Triage auto]', ticket.code, 'skip — ANTHROPIC_API_KEY no configurada');
    }

    await setTable('global', 'support_tickets', tickets);
    console.log('[Support]', ticket.code, 'captura cerrada por usuario - mensajes:', ticket.messages_count, 'imágenes:', ticket.images_count, '- triage:', triageResult ? (triageResult.ok ? 'OK' : 'fail') : 'skip');
    res.json({
      ok: true,
      code: ticket.code,
      messages_count: ticket.messages_count,
      images_count: ticket.images_count,
      ai_analyzed: !!(triageResult && triageResult.ok)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/support-tickets: lista global de tickets (vos como admin)
app.get('/api/admin/support-tickets', adminAuth, async (req, res) => {
  try {
    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) tickets = [];
    // Filtros opcionales por query string
    const { status, tenant_id } = req.query;
    if (status) tickets = tickets.filter(t => t.status === status);
    if (tenant_id) tickets = tickets.filter(t => t.tenant_id === tenant_id);
    // Más recientes primero
    tickets.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    res.json({ ok: true, tickets: tickets, total: tickets.length });
  } catch (e) {
    console.error('[Support list]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/admin/support-ticket/:id: detalle de un ticket con sus attachments
app.get('/api/admin/support-ticket/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) return res.status(404).json({ error: 'ticket no encontrado' });
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return res.status(404).json({ error: 'ticket no encontrado' });

    // Cargar attachments asociados
    let attachments = await getTable('global', 'support_attachments');
    if (!Array.isArray(attachments)) attachments = [];
    const ticketAttachments = attachments.filter(a => a.ticket_id === id);

    res.json({ ok: true, ticket: ticket, attachments: ticketAttachments });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── PATCH /api/admin/support-ticket/:id: cambiar estado + agregar nota
app.patch('/api/admin/support-ticket/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution_note, resolved_by, notify_user, notification_message } = req.body;
    // status: 'abierto' | 'en_proceso' | 'resuelto'
    // resolution_note: nota interna del admin
    // notify_user: bool, si true envía mensaje al usuario por WhatsApp
    // notification_message: texto personalizado a enviar (si notify_user=true)

    if (status && !['abierto', 'en_proceso', 'resuelto'].includes(status)) {
      return res.status(400).json({ error: 'status inválido' });
    }

    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) return res.status(404).json({ error: 'ticket no encontrado' });
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return res.status(404).json({ error: 'ticket no encontrado' });

    if (status) ticket.status = status;
    if (resolution_note !== undefined) ticket.resolution_note = resolution_note;
    if (resolved_by) ticket.resolved_by = resolved_by;
    if (status === 'resuelto' && !ticket.resolved_at) ticket.resolved_at = new Date().toISOString();
    ticket.updated_at = new Date().toISOString();

    // Notificación al usuario por WhatsApp si pidieron
    let notificationResult = null;
    if (notify_user && notification_message) {
      const phoneId = process.env.META_PHONE_ID || '1108305135698485';
      const token = process.env.META_TOKEN;
      if (!token) {
        notificationResult = { delivered: false, error: 'META_TOKEN no configurado en Railway' };
        ticket.pending_notification = true;
        ticket.pending_notification_text = notification_message;
        ticket.last_notification_error = 'META_TOKEN no configurado en Railway';
        ticket.last_notification_attempt_at = new Date().toISOString();
      } else {
        try {
          console.log('[Support notify]', ticket.code, 'enviando a', ticket.user_phone, 'via phone_id', phoneId);
          const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: ticket.user_phone,
              type: 'text',
              text: { body: '🎫 *Ticket ' + ticket.code + '*\n\n' + notification_message }
            })
          });
          const sendData = await sendRes.json();
          if (sendData.error) {
            // Construir mensaje de error detallado con código + tipo + razón
            const err = sendData.error;
            const fullError = (err.code ? '#' + err.code + ' ' : '') +
                              (err.message || 'WhatsApp send failed') +
                              (err.error_subcode ? ' (sub: ' + err.error_subcode + ')' : '') +
                              (err.type ? ' [' + err.type + ']' : '');
            notificationResult = { delivered: false, error: fullError, raw: err };
            ticket.pending_notification = true;
            ticket.pending_notification_text = notification_message;
            ticket.last_notification_error = fullError;
            ticket.last_notification_attempt_at = new Date().toISOString();
            console.warn('[Support notify]', ticket.code, 'FALLA:', fullError, '— phoneId:', phoneId, '— to:', ticket.user_phone);
          } else {
            notificationResult = { delivered: true, message_id: sendData.messages && sendData.messages[0] && sendData.messages[0].id };
            ticket.pending_notification = false;
            ticket.pending_notification_text = null;
            ticket.last_notification_error = null;
            ticket.last_notification_attempt_at = new Date().toISOString();
            ticket.notified_at = new Date().toISOString();
            console.log('[Support notify]', ticket.code, 'OK enviado a', ticket.user_phone);
          }
        } catch (sendErr) {
          notificationResult = { delivered: false, error: sendErr.message };
          ticket.pending_notification = true;
          ticket.pending_notification_text = notification_message;
          ticket.last_notification_error = sendErr.message;
          ticket.last_notification_attempt_at = new Date().toISOString();
          console.error('[Support notify]', ticket.code, 'EXCEPCION:', sendErr.message);
        }
      }
    }

    await setTable('global', 'support_tickets', tickets);
    res.json({ ok: true, ticket: ticket, notification: notificationResult });
  } catch (e) {
    console.error('[Support patch]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/admin/support-ticket/:id/analyze: triage automático con Claude API (v4.3.7)
// On-demand desde App Auditoría. Llama a Claude Sonnet 4 con el contenido del ticket
// y guarda el resultado estructurado en ticket.ai_analysis.
const TRIAGE_SYSTEM_PROMPT = `Eres un agente de triage para tickets de soporte de EstanciaPro, un ERP de gestión ganadera multi-tenant (Desktop Electron + PWA Capataz + bot WhatsApp, backend Node.js/Express en Railway).

Recibirás un ticket de un cliente o capataz. Tu tarea es analizarlo y devolver SOLO un JSON con este schema:

{
  "category": "bug" | "consulta" | "feature_request" | "auth" | "sync" | "onboarding" | "otro",
  "severity": "critica" | "alta" | "media" | "baja",
  "summary": "Resumen del ticket en 1 oración (max 120 chars)",
  "diagnosis": "Hipótesis técnica preliminar en 2-3 oraciones",
  "suggested_action": "Acción concreta sugerida para el equipo",
  "related_features": ["lista de features afectados, ej: sync, stock, lluvias"],
  "confidence": "alta" | "media" | "baja"
}

Severidad:
- critica = pérdida de datos, app crasheada, no puede operar
- alta = funcionalidad principal rota
- media = funcionalidad secundaria con workaround
- baja = pregunta, mejora, ajuste cosmético

Sé conciso. No incluyas markdown ni texto fuera del JSON.`;

// Helper interno: ejecuta el análisis de Claude para un ticket y lo guarda.
// Devuelve { ok, analysis?, meta?, error? }. NO escribe la tabla (eso lo hace quien llama)
// para permitir batching de writes si el caller ya estaba escribiendo otros campos.
async function _runTriageAnalysis(ticket) {
  if (!ANTHROPIC_API_KEY) {
    return { ok: false, error: 'ANTHROPIC_API_KEY no configurada en Railway. Agregarla en Variables.', errorCode: 503 };
  }

  // Armar contenido del ticket (texto only, sin imágenes en esta fase)
  const ticketLines = [
    `Código: ${ticket.code}`,
    `Tenant: ${ticket.tenant_name || ticket.tenant_id || 'desconocido'}`,
    `Estado: ${ticket.status}`,
    `Creado: ${ticket.created_at}`,
    `Mensajes adjuntos: ${ticket.messages_count || 0}`,
    `Imágenes adjuntas: ${ticket.images_count || 0}`,
    '',
    'Descripción del usuario:',
    ticket.description || '(sin descripción)'
  ];
  const userContent = ticketLines.join('\n');

  console.log('[Triage]', ticket.code, '→ llamando Claude', ANTHROPIC_MODEL);
  const startTs = Date.now();

  let apiRes;
  try {
    apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: TRIAGE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }]
      })
    });
  } catch (netErr) {
    console.error('[Triage]', ticket.code, 'network error:', netErr.message);
    return { ok: false, error: 'Error de red al contactar Anthropic: ' + netErr.message, errorCode: 502 };
  }

  const apiData = await apiRes.json();
  const durationMs = Date.now() - startTs;

  if (!apiRes.ok || apiData.error) {
    const errMsg = apiData.error ? (apiData.error.message || JSON.stringify(apiData.error)) : `HTTP ${apiRes.status}`;
    console.error('[Triage]', ticket.code, 'API error:', errMsg);
    return { ok: false, error: 'Error de Anthropic API: ' + errMsg, errorCode: 502 };
  }

  // Extraer texto del primer bloque
  const textBlock = (apiData.content || []).find(b => b.type === 'text');
  if (!textBlock || !textBlock.text) {
    return { ok: false, error: 'Respuesta de Claude sin texto', errorCode: 502 };
  }

  // Parsear JSON (defensivo: a veces viene con fences markdown aunque pidamos lo contrario)
  let analysis;
  try {
    const cleaned = textBlock.text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();
    analysis = JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('[Triage]', ticket.code, 'parse error:', parseErr.message, '— raw:', textBlock.text.slice(0, 200));
    return { ok: false, error: 'Respuesta de Claude no es JSON válido: ' + parseErr.message, errorCode: 502 };
  }

  // Calcular costo aproximado (Sonnet 4: $3/MTok input, $15/MTok output)
  const usage = apiData.usage || {};
  const inputTokens = usage.input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  const costUsd = (inputTokens * 3 / 1_000_000) + (outputTokens * 15 / 1_000_000);

  const meta = {
    model: ANTHROPIC_MODEL,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: Math.round(costUsd * 10000) / 10000,
    duration_ms: durationMs
  };

  // Asignar en el ticket (caller decide cuándo persistir)
  ticket.ai_analysis = analysis;
  ticket.ai_analyzed_at = new Date().toISOString();
  ticket.ai_analysis_meta = meta;
  ticket.updated_at = new Date().toISOString();

  console.log('[Triage]', ticket.code, 'OK · ' + analysis.category + '/' + analysis.severity +
    ' · ' + inputTokens + 'in/' + outputTokens + 'out · $' + costUsd.toFixed(4) + ' · ' + durationMs + 'ms');

  return { ok: true, analysis: analysis, meta: meta };
}

app.post('/api/admin/support-ticket/:id/analyze', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) return res.status(404).json({ error: 'ticket no encontrado' });
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return res.status(404).json({ error: 'ticket no encontrado' });

    const result = await _runTriageAnalysis(ticket);
    if (!result.ok) {
      return res.status(result.errorCode || 502).json({ error: result.error });
    }

    await setTable('global', 'support_tickets', tickets);
    res.json({ ok: true, analysis: result.analysis, meta: result.meta });
  } catch (e) {
    console.error('[Triage]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/admin/support-ticket/:id: borrado físico (solo para limpieza)
app.delete('/api/admin/support-ticket/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) tickets = [];
    const before = tickets.length;
    tickets = tickets.filter(t => t.id !== id);
    if (tickets.length === before) return res.status(404).json({ error: 'ticket no encontrado' });
    await setTable('global', 'support_tickets', tickets);
    // Borrar también attachments asociados
    let attachments = await getTable('global', 'support_attachments');
    if (Array.isArray(attachments)) {
      attachments = attachments.filter(a => a.ticket_id !== id);
      await setTable('global', 'support_attachments', attachments);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Hook: cuando el usuario manda un mensaje y tiene pending_notification, enviar el mensaje pendiente.
// Esto se invoca desde el bot, NO directamente. El bot detecta la sesión, hace check de pending tickets
// del user_phone, y si hay alguno marcado pending_notification=true, llama a este endpoint.
app.post('/api/support-ticket/flush-pending/:phone', auth, async (req, res) => {
  try {
    const { phone } = req.params;
    let tickets = await getTable('global', 'support_tickets');
    if (!Array.isArray(tickets)) return res.json({ ok: true, sent: 0 });

    const pendingForPhone = tickets.filter(t => t.user_phone === phone && t.pending_notification === true && t.pending_notification_text);
    if (!pendingForPhone.length) return res.json({ ok: true, sent: 0 });

    const phoneId = process.env.META_PHONE_ID || '1124983387355546';
    const token = process.env.META_TOKEN;
    if (!token) return res.json({ ok: false, error: 'META_TOKEN no disponible' });

    let sent = 0;
    for (const ticket of pendingForPhone) {
      try {
        const sendRes = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: '🎫 *Ticket ' + ticket.code + '*\n\n' + ticket.pending_notification_text }
          })
        });
        const sendData = await sendRes.json();
        if (!sendData.error) {
          ticket.pending_notification = false;
          ticket.pending_notification_text = null;
          ticket.notified_at = new Date().toISOString();
          sent++;
        }
      } catch (e) {}
    }
    if (sent) await setTable('global', 'support_tickets', tickets);
    res.json({ ok: true, sent: sent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Bot Sessions ──────────────────────────────────────────────
app.get('/api/bot-session/:phone', auth, async (req, res) => {
  try {
    const { phone } = req.params;
    const session = await getTable(req.tenantId, 'bot_session_' + phone);
    res.json(session || { history: [], pending_transaction: null, pending_image_for: null, pending_image_type: null, pending_support_ticket: null, onboarding: null });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bot-session/:phone', auth, async (req, res) => {
  try {
    const { phone } = req.params;
    const sessionData = {
      history: req.body.history || [],
      pending_transaction: req.body.pending_transaction || null,
      pending_image_for: req.body.pending_image_for || null,
      pending_image_type: req.body.pending_image_type || null,
      purchase_state: req.body.purchase_state || null,
      pending_purchase: req.body.pending_purchase || null,
      support_mode: req.body.support_mode === true,
      support_attempts: parseInt(req.body.support_attempts || 0, 10),
      pending_support_ticket: req.body.pending_support_ticket || null, // ← v4.4.0: ticket abierto en modo soporte
      onboarding: req.body.onboarding || null, // ← v4.4.0: estado del wizard de onboarding por WhatsApp
      updated_at: new Date().toISOString()
    };
    await setTable(req.tenantId, 'bot_session_' + phone, sessionData);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Animal Queries ──────────────────────────────────────────
app.post('/api/animals/query', auth, async (req, res) => {
  try {
    const { min_weight, max_weight, lot_code, breed } = req.body;
    const animals = await getTable(req.tenantId, 'animals');
    const lots = await getTable(req.tenantId, 'lots');
    const lotsMap = {};
    (Array.isArray(lots) ? lots : []).forEach(l => { lotsMap[l.code] = l; });

    const results = [];
    const animalsObj = (animals && typeof animals === 'object' && !Array.isArray(animals)) ? animals : {};

    Object.keys(animalsObj).forEach(lotCode => {
      if (lot_code && lotCode !== lot_code) return;
      const lot = lotsMap[lotCode] || {};
      (animalsObj[lotCode] || []).forEach(a => {
        const lastPeso = (a.pesajes && a.pesajes.length) ? a.pesajes[a.pesajes.length - 1].peso : 0;
        const firstPeso = (a.pesajes && a.pesajes.length) ? a.pesajes[0].peso : 0;
        const animalBreed = a.breed || a.raza || lot.breed || '';
        if (breed && animalBreed.toLowerCase().indexOf(breed.toLowerCase()) === -1) return;
        if (min_weight && lastPeso < min_weight) return;
        if (max_weight && lastPeso > max_weight) return;

        const pesajes = (a.pesajes || []).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
        let gmd = 0;
        if (pesajes.length >= 2) {
          const first = pesajes[0];
          const last = pesajes[pesajes.length - 1];
          const days = Math.max(1, (new Date(last.fecha) - new Date(first.fecha)) / 86400000);
          gmd = Math.round(((last.peso - first.peso) / days) * 100) / 100;
        }

        results.push({
          animal_id: a.animal_id || a.id || '',
          lot_code: lotCode,
          category: lot.category || '',
          breed: animalBreed,
          last_weight: lastPeso,
          first_weight: firstPeso,
          pesajes_count: pesajes.length,
          gmd: gmd,
          last_pesaje_date: pesajes.length ? pesajes[pesajes.length - 1].fecha : '',
          paddock: lot.paddock || ''
        });
      });
    });

    results.sort((a, b) => b.last_weight - a.last_weight);

    // Summary by lot
    const byLot = {};
    results.forEach(r => {
      if (!byLot[r.lot_code]) byLot[r.lot_code] = { lot_code: r.lot_code, category: r.category, paddock: r.paddock, count: 0, total_kg: 0, animals: [] };
      byLot[r.lot_code].count++;
      byLot[r.lot_code].total_kg += r.last_weight;
      byLot[r.lot_code].animals.push(r);
    });

    const summary = Object.values(byLot).map(g => ({
      ...g,
      avg_weight: g.count ? Math.round(g.total_kg / g.count) : 0,
      animals: g.animals.slice(0, 50) // limit per lot
    }));

    res.json({
      total: results.length,
      total_kg: Math.round(results.reduce((s, r) => s + r.last_weight, 0)),
      avg_weight: results.length ? Math.round(results.reduce((s, r) => s + r.last_weight, 0) / results.length) : 0,
      filters: { min_weight, max_weight, lot_code, breed },
      by_lot: summary,
      animals: results.slice(0, 200)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/animal/:animalId', auth, async (req, res) => {
  try {
    const animals = await getTable(req.tenantId, 'animals');
    const lots = await getTable(req.tenantId, 'lots');
    const treatments = await getTable(req.tenantId, 'treatments');
    const animalsObj = (animals && typeof animals === 'object' && !Array.isArray(animals)) ? animals : {};
    const targetId = req.params.animalId;

    let found = null;
    let foundLot = null;
    Object.keys(animalsObj).forEach(lotCode => {
      (animalsObj[lotCode] || []).forEach(a => {
        const aid = String(a.animal_id || a.id || '');
        if (aid === targetId || aid.toLowerCase() === targetId.toLowerCase()) {
          found = a;
          foundLot = lotCode;
        }
      });
    });

    if (!found) return res.status(404).json({ error: 'Animal no encontrado' });

    const lot = (Array.isArray(lots) ? lots : []).find(l => l.code === foundLot) || {};
    const pesajes = (found.pesajes || []).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    const animalTreatments = (Array.isArray(treatments) ? treatments : []).filter(t =>
      t.animal_id === targetId || (t.scope === 'lot' && t.lot_code === foundLot)
    );

    let gmd = 0;
    if (pesajes.length >= 2) {
      const days = Math.max(1, (new Date(pesajes[pesajes.length-1].fecha) - new Date(pesajes[0].fecha)) / 86400000);
      gmd = Math.round(((pesajes[pesajes.length-1].peso - pesajes[0].peso) / days) * 100) / 100;
    }

    res.json({
      animal_id: found.animal_id || found.id,
      lot_code: foundLot,
      breed: found.breed || found.raza || lot.breed || '',
      category: lot.category || '',
      paddock: lot.paddock || '',
      last_weight: pesajes.length ? pesajes[pesajes.length-1].peso : 0,
      first_weight: pesajes.length ? pesajes[0].peso : 0,
      gmd: gmd,
      pesajes: pesajes,
      treatments: animalTreatments.slice(0, 20),
      days_in_estancia: pesajes.length ? Math.round((Date.now() - new Date(pesajes[0].fecha).getTime()) / 86400000) : 0
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GMD Check ────────────────────────────────────────────────
// v4.3.4: endpoint para que el bot verifique si un lote tiene GMD calculable
// antes de ofrecer la opción de proyectar peso. Devuelve:
//   { available: true, gmd: 0.65, animals_used: 245, total_animals: 280 }
//   { available: false, reason: 'lot_not_found' | 'insufficient_pesajes', total_animals: 5 }
app.post('/api/lot-gmd-check', auth, async (req, res) => {
  try {
    const { scope, lot_code, min_weight, max_weight } = req.body || {};
    const allAnimalsByLot = await getTable(req.tenantId, 'animals');

    // Resolver candidatos según scope (misma lógica que proforma_simple)
    let candidatos = [];
    if (scope === 'weight_range') {
      Object.keys(allAnimalsByLot || {}).forEach(k => {
        if (lot_code && String(k).trim().toLowerCase() !== String(lot_code).trim().toLowerCase()) return;
        (allAnimalsByLot[k] || []).forEach(a => candidatos.push(a));
      });
      // Filtrar por rango usando peso último
      candidatos = candidatos.filter(a => {
        const list = (a?.pesajes || []).slice().sort((x, y) => String(x.fecha || '').localeCompare(String(y.fecha || '')));
        if (!list.length) return false;
        const peso = Number(list[list.length - 1]?.peso || 0);
        if (peso <= 0) return false;
        if (min_weight != null && peso < Number(min_weight)) return false;
        if (max_weight != null && peso > Number(max_weight)) return false;
        return true;
      });
    } else {
      // scope='lot' o default
      if (!lot_code) return res.status(400).json({ error: 'lot_code requerido para scope=lot' });
      const lotNorm = String(lot_code).trim().toLowerCase();
      const keys = Object.keys(allAnimalsByLot || {});
      const matchKey = keys.find(k => String(k).trim().toLowerCase() === lotNorm);
      if (!matchKey) {
        return res.json({ available: false, reason: 'lot_not_found', total_animals: 0 });
      }
      candidatos = allAnimalsByLot[matchKey] || [];
    }

    const totalAnimals = candidatos.length;

    // Calcular GMD del subset
    let sumGmd = 0;
    let animalsWithGmd = 0;
    candidatos.forEach(a => {
      const list = (a?.pesajes || []).slice().sort((x, y) => String(x.fecha || '').localeCompare(String(y.fecha || '')));
      if (list.length < 2) return;
      const first = list[0];
      const last = list[list.length - 1];
      const w1 = Number(first?.peso || 0);
      const w2 = Number(last?.peso || 0);
      if (!w1 || !w2) return;
      const d1 = new Date(first.fecha || '').getTime();
      const d2 = new Date(last.fecha || '').getTime();
      const days = (d2 - d1) / 86400000;
      if (days < 7) return;
      const gmd = (w2 - w1) / days;
      if (gmd > -2 && gmd < 5) {
        sumGmd += gmd;
        animalsWithGmd++;
      }
    });

    if (animalsWithGmd === 0) {
      return res.json({ available: false, reason: 'insufficient_pesajes', total_animals: totalAnimals });
    }
    const gmdLote = sumGmd / animalsWithGmd;
    return res.json({
      available: true,
      gmd: Math.round(gmdLote * 100) / 100,
      animals_used: animalsWithGmd,
      total_animals: totalAnimals
    });
  } catch (e) {
    console.error('[lot-gmd-check] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// v4.4.5: Helpers para WhatsApp — separación y rotación de lotes
// ════════════════════════════════════════════════════════════════

// v4.4.7: helper centralizado para filtrar "lotes operables" (rotación, separación, etc.)
// Excluye lotes en cuarentena, marcado, vendido, inactivo, vacíos (0 cab),
// y también los que estén en el potrero "Cuarentena" (aunque no tengan status formal).
function isLotOperable(l) {
  if (!l || !l.code) return false;
  // Excluir por status
  const st = (l.status || '').toLowerCase();
  if (st && st !== 'activo' && st !== 'active') return false;
  // Excluir por potrero de cuarentena
  const pad = (l.paddock || '').toLowerCase();
  if (pad === 'cuarentena' || pad.indexOf('cuarentena') === 0) return false;
  // Excluir lotes vacíos
  if (!l.animal_count || l.animal_count <= 0) return false;
  // Excluir lotes cuyo code empieza con CUAR- (heurística: convención de compra-ganado)
  if (l.code.toUpperCase().indexOf('CUAR-') === 0 || l.code.toUpperCase().indexOf('CUAR ') === 0) return false;
  return true;
}

// ── Sugerencia de separación de un lote en sub-lotes ──
// Análisis: calcula CV del lote, sugiere rangos de peso para sub-lotes.
// Si CV es bajo (<5%) avisa que el lote es uniforme pero igual sugiere.
// Si CV es alto (>10%) sugiere 2-3 sub-lotes con rangos balanceados.
app.post('/api/bot/lot-split-suggestion', auth, async (req, res) => {
  try {
    const { lot_code } = req.body || {};
    const allLots = await getTable(req.tenantId, 'lots') || [];

    // v4.5.0: helper para calcular CV de un lote (necesario para mostrar en la lista)
    const animalsTableForCV = await getTable(req.tenantId, 'animals') || {};
    function computeCV(lotCode) {
      const arr = animalsTableForCV[lotCode] || [];
      const pesos = arr.map(a => {
        const ps = (a.pesajes || []).slice().sort((x,y) => String(x.fecha||'').localeCompare(String(y.fecha||'')));
        return ps.length ? Number(ps[ps.length-1].peso || 0) : 0;
      }).filter(w => w > 0);
      if (pesos.length < 2) return null;
      const avg = pesos.reduce((s,w)=>s+w,0) / pesos.length;
      if (avg <= 0) return null;
      const variance = pesos.reduce((s,w)=>s+Math.pow(w-avg, 2), 0) / pesos.length;
      const stdev = Math.sqrt(variance);
      return Math.round((stdev / avg) * 1000) / 10;
    }

    // v4.4.6: si no especifica lot_code, devolver lista de lotes con suficientes animales para separar
    if (!lot_code) {
      const activos = allLots.filter(isLotOperable);
      const candidatos = activos.filter(l => (l.animal_count || 0) >= 4);
      if (!candidatos.length) {
        return res.json({
          ok: false,
          step: 'list_lots',
          message: 'No hay lotes con suficientes animales para separar (mínimo 4 cab).'
        });
      }
      // Ordenar: mayor CV primero (los que más se beneficiarían de separar)
      const conCV = candidatos.map(l => ({ lot: l, cv: computeCV(l.code) }));
      conCV.sort((a, b) => {
        const aCv = a.cv == null ? -1 : a.cv;
        const bCv = b.cv == null ? -1 : b.cv;
        return bCv - aCv;
      });
      let msg = '*¿Qué lote querés separar en sub-lotes?*\n\n';
      conCV.forEach((entry, i) => {
        const l = entry.lot;
        const cv = entry.cv;
        msg += (i + 1) + '. *' + l.code + '* — ' + (l.animal_count || 0) + ' cab · ' + (l.paddock || 'sin potrero');
        if (l.avg_weight) msg += ' · prom ' + l.avg_weight + ' kg';
        if (cv != null) {
          // Etiquetar uniformidad para guiar la decisión del usuario
          const label = cv < 5 ? 'uniforme' : cv < 10 ? 'moderado' : 'disperso';
          const emoji = cv < 5 ? '🟢' : cv < 10 ? '🟡' : '🔴';
          msg += ' · CV *' + cv.toFixed(1) + '%* ' + emoji + ' _' + label + '_';
        } else {
          msg += ' · _sin datos de CV_';
        }
        msg += '\n';
      });
      msg += '\n_Respondé con el código del lote (ej "' + conCV[0].lot.code + '")._';
      msg += '\n_💡 CV alto = más dispersión = más beneficio de separar._';
      return res.json({
        ok: true,
        step: 'list_lots',
        lots: conCV.map(e => ({ code: e.lot.code, paddock: e.lot.paddock, animal_count: e.lot.animal_count || 0, avg_weight: e.lot.avg_weight || 0, cv_pct: e.cv })),
        message: msg
      });
    }

    const lotNorm = String(lot_code).trim().toLowerCase();
    const matchedLot = allLots.find(l => l && l.code && l.code.toLowerCase() === lotNorm);
    if (!matchedLot) {
      const activos = allLots.filter(isLotOperable);
      const candidatos = activos.filter(l => (l.animal_count || 0) >= 4);
      let msg = '⚠ No encontré el lote *' + lot_code + '*.\n\n*Lotes disponibles para separar:*\n';
      candidatos.forEach((l, i) => {
        const cv = computeCV(l.code);
        msg += (i + 1) + '. *' + l.code + '* — ' + (l.animal_count || 0) + ' cab';
        if (cv != null) msg += ' · CV ' + cv.toFixed(1) + '%';
        msg += '\n';
      });
      return res.status(400).json({
        ok: false,
        error: 'Lote "' + lot_code + '" no encontrado',
        message: msg,
        available_lots: candidatos.map(l => l.code)
      });
    }

    // v4.4.7: si el lote NO es operable, rechazar con mensaje claro
    if (!isLotOperable(matchedLot)) {
      const motivo = matchedLot.status === 'cuarentena' ? 'está en cuarentena' :
                     matchedLot.status === 'vendido' || matchedLot.status === 'sold' ? 'fue vendido' :
                     (matchedLot.paddock || '').toLowerCase().indexOf('cuarentena') === 0 ? 'está en el potrero de cuarentena' :
                     !matchedLot.animal_count || matchedLot.animal_count === 0 ? 'no tiene animales' :
                     'no es operable';
      return res.status(400).json({
        ok: false,
        error: 'Lote "' + matchedLot.code + '" ' + motivo,
        message: '⚠ El lote *' + matchedLot.code + '* ' + motivo + ', no se puede separar.'
      });
    }

    const animalsByLot = await getTable(req.tenantId, 'animals') || {};
    const lotAnimals = animalsByLot[matchedLot.code] || [];

    if (lotAnimals.length < 4) {
      return res.json({
        ok: false,
        reason: 'too_few',
        message: 'El lote ' + matchedLot.code + ' tiene solo ' + lotAnimals.length + ' animales. No se puede separar (mínimo 4).'
      });
    }

    // Recolectar pesos (último pesaje de cada animal)
    const animalsWithWeight = lotAnimals.map(a => {
      const ps = (a.pesajes || []).slice().sort((x,y) => String(x.fecha||'').localeCompare(String(y.fecha||'')));
      const lastWeight = ps.length ? Number(ps[ps.length-1].peso || 0) : 0;
      return { id: a.animal_id || a.id, peso: lastWeight, raza: a.raza || a.breed || '' };
    }).filter(a => a.peso > 0);

    if (animalsWithWeight.length < 4) {
      return res.json({
        ok: false,
        reason: 'no_weights',
        message: 'No hay suficientes pesajes en el lote ' + matchedLot.code + '. Pesá primero.'
      });
    }

    // Estadísticas
    const pesos = animalsWithWeight.map(a => a.peso).sort((a,b)=>a-b);
    const n = pesos.length;
    const min = pesos[0];
    const max = pesos[n-1];
    const avg = pesos.reduce((s,w)=>s+w,0) / n;
    const variance = pesos.reduce((s,w)=>s+Math.pow(w-avg, 2), 0) / n;
    const stdev = Math.sqrt(variance);
    const cv = (stdev / avg) * 100;
    const range = max - min;

    // Determinar cuántos sub-lotes sugerir
    // CV<5% = uniforme, sugerir 2 si lote grande (>20)
    // CV 5-10% = moderado, sugerir 2-3
    // CV >10% = disperso, sugerir 3
    let numSubLotes;
    let uniformityLevel;
    if (cv < 5) {
      numSubLotes = (n >= 30) ? 2 : 2;  // siempre 2 si CV bajo
      uniformityLevel = 'uniforme';
    } else if (cv < 10) {
      numSubLotes = (n >= 20) ? 3 : 2;
      uniformityLevel = 'moderado';
    } else {
      numSubLotes = (n >= 15) ? 3 : 2;
      uniformityLevel = 'disperso';
    }

    // Estrategia: dividir por cuantiles (split balanceado por nº de animales)
    // Esto da sub-lotes con cantidades similares de cabezas
    const subLotes = [];
    for (let i = 0; i < numSubLotes; i++) {
      const startIdx = Math.floor((i * n) / numSubLotes);
      const endIdx = Math.floor(((i + 1) * n) / numSubLotes);
      const slice = pesos.slice(startIdx, endIdx);
      if (!slice.length) continue;
      const sMin = slice[0];
      const sMax = slice[slice.length - 1];
      const sAvg = slice.reduce((s,w)=>s+w,0) / slice.length;
      // Letra A, B, C
      const letra = String.fromCharCode(65 + i);
      subLotes.push({
        suggested_code: matchedLot.code + '-' + letra,
        min_weight: Math.floor(sMin),
        max_weight: Math.ceil(sMax),
        animal_count: slice.length,
        avg_weight: Math.round(sAvg * 10) / 10
      });
    }

    // v4.4.9: además del split balanceado, calcular un split por cuartiles
    // para el modo "extract" (sacar solo los más pesados o los más livianos)
    // Tercil superior e inferior — útil para extraer "los más pesados (listos venta)"
    // o "los más livianos (necesitan engorde)".
    const q33 = pesos[Math.floor(n / 3)];
    const q66 = pesos[Math.floor((2 * n) / 3)];
    const extractTop = pesos.filter(p => p > q66);
    const extractBottom = pesos.filter(p => p < q33);
    const avgTop = extractTop.length ? extractTop.reduce((s,w)=>s+w,0) / extractTop.length : 0;
    const avgBottom = extractBottom.length ? extractBottom.reduce((s,w)=>s+w,0) / extractBottom.length : 0;

    // Mensaje resumen para el bot
    let message = '*Análisis del lote ' + matchedLot.code + '*\n' +
      '• Animales con peso: ' + n + ' / ' + lotAnimals.length + '\n' +
      '• Promedio: ' + Math.round(avg) + ' kg · σ ' + Math.round(stdev) + ' kg\n' +
      '• Min/Max: ' + Math.floor(min) + ' / ' + Math.ceil(max) + ' kg (rango ' + Math.round(range) + ' kg)\n' +
      '• CV: *' + cv.toFixed(1) + '%* (' + uniformityLevel + ')\n\n';

    if (uniformityLevel === 'uniforme') {
      message += '✓ _Lote bastante uniforme. La separación es opcional._\n\n';
    } else if (uniformityLevel === 'disperso') {
      message += '⚠ _Lote disperso. Separar mejora el manejo y la GMD._\n\n';
    }

    // Opción A: partition (dividir TODO el lote en N sub-lotes)
    message += '*Opción A — Dividir todo el lote en ' + numSubLotes + ' sub-lotes:*\n';
    subLotes.forEach(sl => {
      message += '• ' + sl.suggested_code + ': ' + sl.min_weight + '-' + sl.max_weight + ' kg · ' + sl.animal_count + ' cab · prom ' + sl.avg_weight + ' kg\n';
    });

    // Opción B: extract (sacar solo un sub-grupo, el resto queda en el lote original)
    message += '\n*Opción B — Sacar solo un sub-grupo (el resto queda en ' + matchedLot.code + '):*\n';
    if (extractTop.length >= 4) {
      message += '• Los más pesados → ' + matchedLot.code + '-A: ' + Math.floor(q66) + '-' + Math.ceil(max) + ' kg · ' + extractTop.length + ' cab · prom ' + Math.round(avgTop) + ' kg\n';
    }
    if (extractBottom.length >= 4) {
      message += '• Los más livianos → ' + matchedLot.code + '-B: ' + Math.floor(min) + '-' + Math.ceil(q33) + ' kg · ' + extractBottom.length + ' cab · prom ' + Math.round(avgBottom) + ' kg\n';
    }
    message += '\n_También podés indicar un rango personalizado (ej "sacar los animales entre 380 y 385 kg como SSD3-X")._';

    return res.json({
      ok: true,
      lot_code: matchedLot.code,
      paddock: matchedLot.paddock || '',
      stats: {
        animal_count: n,
        total_animal_count: lotAnimals.length,
        avg_weight: Math.round(avg * 10) / 10,
        stdev: Math.round(stdev * 10) / 10,
        cv_pct: Math.round(cv * 10) / 10,
        min_weight: Math.floor(min),
        max_weight: Math.ceil(max),
        uniformity: uniformityLevel
      },
      suggested_sublots: subLotes,
      extract_options: {
        top: extractTop.length >= 4 ? { code: matchedLot.code + '-A', min_weight: Math.floor(q66), max_weight: Math.ceil(max), count: extractTop.length, avg: Math.round(avgTop) } : null,
        bottom: extractBottom.length >= 4 ? { code: matchedLot.code + '-B', min_weight: Math.floor(min), max_weight: Math.ceil(q33), count: extractBottom.length, avg: Math.round(avgBottom) } : null
      },
      message: message
    });
  } catch (e) {
    console.error('[lot-split-suggestion] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Lista de potreros disponibles (para asignar a un sub-lote nuevo o rotar) ──
// v4.4.9: usado por el bot cuando crea un sub-lote y necesita preguntar a qué potrero va
app.post('/api/bot/paddocks-list', auth, async (req, res) => {
  try {
    const { exclude_paddock } = req.body || {};
    const allLots = await getTable(req.tenantId, 'lots') || [];

    // Cargar params para capacidades
    let params = {};
    try {
      const paramsTable = await getTable(req.tenantId, 'params');
      params = Array.isArray(paramsTable) ? (paramsTable[0] || {}) : (paramsTable || {});
    } catch(e) { params = {}; }
    const potrerosCfg = {};
    (params.potreros || []).forEach(p => {
      if (typeof p !== 'object') return;
      const nombre = p.name || p.nombre || '';
      if (nombre) potrerosCfg[nombre] = p.capacidad || p.cap_max || 0;
    });

    // Ocupación actual
    const ocupacion = {};
    allLots.forEach(l => {
      if (!l || !l.paddock) return;
      if (l.status && l.status !== 'activo' && l.status !== 'active') return;
      const pad = l.paddock;
      if (!ocupacion[pad]) ocupacion[pad] = { cab: 0, lotes: [] };
      ocupacion[pad].cab += (l.animal_count || 0);
      ocupacion[pad].lotes.push(l.code);
    });

    // Lista unificada (cfg + ocupación + historial)
    // v4.5.6: incluir potreros vistos en rotation_history (descansando, recientes).
    // Antes la lista solo tenía configurados + actualmente ocupados, dejando afuera
    // los potreros conocidos del cliente pero sin lote activo en este momento.
    const todos = new Set();
    Object.keys(potrerosCfg).forEach(p => todos.add(p));
    Object.keys(ocupacion).forEach(p => todos.add(p));
    try {
      const rotHist = await getTable(req.tenantId, 'rotation_history');
      if (Array.isArray(rotHist)) {
        rotHist.forEach(r => {
          if (r && r.potrero) todos.add(r.potrero);
        });
      }
    } catch(e) {}

    // v4.5.6: calcular cuántos días lleva descansando cada potrero (desde el último exit)
    // Útil para que el capataz vea cuánto descanso lleva acumulado el potrero
    const ultimoExitPorPotrero = {};
    try {
      const rotHist = await getTable(req.tenantId, 'rotation_history');
      if (Array.isArray(rotHist)) {
        rotHist.forEach(r => {
          if (!r || !r.potrero || !r.exit_date) return;
          const prev = ultimoExitPorPotrero[r.potrero];
          if (!prev || String(r.exit_date) > String(prev)) {
            ultimoExitPorPotrero[r.potrero] = r.exit_date;
          }
        });
      }
    } catch(e) {}

    const lista = [];
    todos.forEach(p => {
      // Filtros: excluir cuarentena y los excluidos por param
      const pLow = p.toLowerCase();
      if (pLow === 'cuarentena' || pLow.indexOf('cuarentena') === 0) return;
      if (exclude_paddock && p === exclude_paddock) return;
      const cap = potrerosCfg[p] || 0;
      const ocup = ocupacion[p] || { cab: 0, lotes: [] };
      // Días descansando (solo si está libre y tiene historial)
      let diasDescansando = null;
      if (ocup.cab === 0 && ultimoExitPorPotrero[p]) {
        const exitMs = new Date(ultimoExitPorPotrero[p] + 'T00:00:00Z').getTime();
        const ahora = Date.now();
        diasDescansando = Math.floor((ahora - exitMs) / (24 * 60 * 60 * 1000));
        if (diasDescansando < 0) diasDescansando = 0;
      }
      lista.push({
        paddock: p,
        capacidad: cap,
        cab_actuales: ocup.cab,
        lotes_actuales: ocup.lotes,
        pct: cap > 0 ? Math.round((ocup.cab / cap) * 100) : null,
        dias_descansando: diasDescansando
      });
    });

    // Ordenar: vacíos primero, después por % de ocupación ascendente
    lista.sort((a, b) => {
      const aVacio = a.cab_actuales === 0 ? 0 : 1;
      const bVacio = b.cab_actuales === 0 ? 0 : 1;
      if (aVacio !== bVacio) return aVacio - bVacio;
      const aPct = a.pct == null ? 999 : a.pct;
      const bPct = b.pct == null ? 999 : b.pct;
      return aPct - bPct;
    });

    // Mensaje
    let message = '*Potreros disponibles:*\n';
    lista.forEach((p, i) => {
      let line = (i + 1) + '. *' + p.paddock + '*';
      if (p.capacidad > 0) {
        line += ' — ' + p.cab_actuales + '/' + p.capacidad + ' cab (' + p.pct + '%)';
      } else {
        line += ' — ' + p.cab_actuales + ' cab' + (p.capacidad === 0 ? ' (capacidad sin config)' : '');
      }
      if (p.lotes_actuales.length > 0) {
        line += ' · ' + p.lotes_actuales.join(', ');
      } else if (p.dias_descansando !== null) {
        line += ' · _libre, ' + p.dias_descansando + 'd descansando_';
      } else {
        line += ' · _libre_';
      }
      message += line + '\n';
    });
    message += '\n_Respondé con el nombre exacto del potrero._';

    return res.json({
      ok: true,
      paddocks: lista,
      message: message
    });
  } catch (e) {
    console.error('[paddocks-list] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Sugerencia de rotación de un lote a otro potrero ──
// Devuelve: días en potrero actual + lista de potreros candidatos con ocupación
// + recomendación AI (heurística simple basada en ocupación y disponibilidad)
app.post('/api/bot/rotation-suggestion', auth, async (req, res) => {
  try {
    const { lot_code } = req.body || {};
    const allLots = await getTable(req.tenantId, 'lots') || [];

    // v4.4.6: si no especifica lot_code, devolver lista de lotes activos para que el usuario elija
    if (!lot_code) {
      const activos = allLots.filter(isLotOperable);
      if (!activos.length) {
        return res.json({
          ok: false,
          step: 'list_lots',
          message: 'No hay lotes activos para rotar.'
        });
      }
      let msg = '*¿Qué lote querés rotar?*\n\n';
      activos.forEach((l, i) => {
        msg += (i + 1) + '. *' + l.code + '* — ' + (l.animal_count || 0) + ' cab · ' + (l.paddock || 'sin potrero') + '\n';
      });
      msg += '\n_Respondé con el código del lote (ej "SSD3")._';
      return res.json({
        ok: true,
        step: 'list_lots',
        lots: activos.map(l => ({ code: l.code, paddock: l.paddock, animal_count: l.animal_count || 0 })),
        message: msg
      });
    }

    const lotNorm = String(lot_code).trim().toLowerCase();
    const matchedLot = allLots.find(l => l && l.code && l.code.toLowerCase() === lotNorm);
    if (!matchedLot) {
      // No fue match: devolver lista de lotes activos
      const activos = allLots.filter(isLotOperable);
      let msg = '⚠ No encontré el lote *' + lot_code + '*.\n\n*Lotes disponibles:*\n';
      activos.forEach((l, i) => {
        msg += (i + 1) + '. *' + l.code + '* — ' + (l.animal_count || 0) + ' cab · ' + (l.paddock || 'sin potrero') + '\n';
      });
      return res.status(400).json({
        ok: false,
        error: 'Lote "' + lot_code + '" no encontrado',
        message: msg,
        available_lots: activos.map(l => l.code)
      });
    }

    // v4.4.7: si el lote NO es operable (cuarentena, vacío, etc.), rechazar con mensaje claro
    if (!isLotOperable(matchedLot)) {
      const motivo = matchedLot.status === 'cuarentena' ? 'está en cuarentena' :
                     matchedLot.status === 'vendido' || matchedLot.status === 'sold' ? 'fue vendido' :
                     (matchedLot.paddock || '').toLowerCase().indexOf('cuarentena') === 0 ? 'está en el potrero de cuarentena' :
                     !matchedLot.animal_count || matchedLot.animal_count === 0 ? 'no tiene animales' :
                     'no es operable';
      const activos = allLots.filter(isLotOperable);
      let msg = '⚠ El lote *' + matchedLot.code + '* ' + motivo + ', no se puede rotar.\n\n';
      msg += motivo === 'está en cuarentena' || motivo === 'está en el potrero de cuarentena'
        ? '_Para sacar un lote de cuarentena, marcalo y separalo desde el Desktop primero._\n\n'
        : '';
      msg += '*Lotes disponibles para rotar:*\n';
      activos.forEach((l, i) => {
        msg += (i + 1) + '. *' + l.code + '* — ' + (l.animal_count || 0) + ' cab · ' + (l.paddock || 'sin potrero') + '\n';
      });
      return res.status(400).json({
        ok: false,
        error: 'Lote "' + matchedLot.code + '" ' + motivo,
        message: msg,
        available_lots: activos.map(l => l.code)
      });
    }

    // Días en el potrero actual
    // Estimación: usar last_paddock_change si existe, sino entry_date, sino created_at
    const fechaRef = matchedLot.last_paddock_change || matchedLot.entry_date || matchedLot.created_at || matchedLot.server_updated_at;
    let diasEnPotrero = null;
    if (fechaRef) {
      const ahora = Date.now();
      const diff = ahora - new Date(fechaRef).getTime();
      diasEnPotrero = Math.floor(diff / (24 * 60 * 60 * 1000));
    }

    // Recolectar configuración de potreros (capacidades)
    let params = {};
    try {
      const paramsTable = await getTable(req.tenantId, 'params');
      params = Array.isArray(paramsTable) ? (paramsTable[0] || {}) : (paramsTable || {});
    } catch(e) { params = {}; }

    const potrerosCfg = {};
    (params.potreros || []).forEach(p => {
      if (typeof p !== 'object') return;
      const nombre = p.name || p.nombre || '';
      if (nombre) potrerosCfg[nombre] = p.capacidad || p.cap_max || 0;
    });

    // Calcular ocupación actual de TODOS los potreros (sumar cab de lotes activos)
    const ocupacion = {};
    allLots.forEach(l => {
      if (!l || !l.paddock) return;
      if (l.status && l.status !== 'activo' && l.status !== 'active') return;
      if (!ocupacion[l.paddock]) ocupacion[l.paddock] = { cab: 0, lotes: [] };
      ocupacion[l.paddock].cab += (l.animal_count || 0);
      ocupacion[l.paddock].lotes.push(l.code);
    });

    // Lista de TODOS los potreros conocidos (cfg + ocupación + historial)
    // v4.5.4: incluir potreros vistos en rotation_history. Antes solo incluíamos los configurados
    // en params.potreros + los actualmente ocupados, pero si el cliente NUNCA configuró los
    // potreros (caso común), la lista de candidatos quedaba vacía y el bot mostraba solo el
    // header "Potreros disponibles:" sin opciones.
    const todosPotreros = new Set();
    Object.keys(potrerosCfg).forEach(p => todosPotreros.add(p));
    Object.keys(ocupacion).forEach(p => todosPotreros.add(p));
    if (matchedLot.paddock) todosPotreros.add(matchedLot.paddock);
    // Agregar potreros vistos en rotation_history (descansando, recientes)
    try {
      const rotHist = await getTable(req.tenantId, 'rotation_history');
      if (Array.isArray(rotHist)) {
        rotHist.forEach(r => {
          if (r && r.potrero) todosPotreros.add(r.potrero);
        });
      }
    } catch(e) {}
    // Excluir "Cuarentena" como destino de rotación normal (es un paddock especial)
    todosPotreros.delete('Cuarentena');
    todosPotreros.delete('cuarentena');

    // Construir candidatos (excluir potrero actual)
    const cabLote = matchedLot.animal_count || 0;
    const candidatos = [];
    todosPotreros.forEach(potrero => {
      if (potrero === matchedLot.paddock) return;  // no rotar al mismo
      const cap = potrerosCfg[potrero] || 0;
      const ocup = (ocupacion[potrero] || { cab: 0, lotes: [] });
      const ocupCab = ocup.cab;
      const otrosLotes = ocup.lotes;
      // Estado del potrero
      const totalSiRoto = ocupCab + cabLote;
      const pctSiRoto = cap > 0 ? Math.round((totalSiRoto / cap) * 100) : null;
      let estado = 'libre';
      if (otrosLotes.length > 0) estado = 'ocupado';
      let warning = null;
      if (cap > 0 && totalSiRoto > cap) {
        warning = 'sobrepoblaria_' + pctSiRoto + 'pct';
      }
      candidatos.push({
        paddock: potrero,
        capacidad: cap,
        cab_actuales: ocupCab,
        otros_lotes: otrosLotes,
        cab_si_roto: totalSiRoto,
        pct_si_roto: pctSiRoto,
        estado: estado,
        warning: warning
      });
    });

    // Heurística de "recomendación AI":
    // 1. Preferir potreros LIBRES (sin lotes activos)
    // 2. Entre los libres, los de mayor capacidad
    // 3. Si no hay libres, los de menor % ocupación post-rotación
    // 4. Descartar los que sobrepoblarían >130%
    candidatos.sort((a, b) => {
      // Primero: penalizar sobrepoblación severa
      const aSevera = a.pct_si_roto && a.pct_si_roto > 130 ? 1 : 0;
      const bSevera = b.pct_si_roto && b.pct_si_roto > 130 ? 1 : 0;
      if (aSevera !== bSevera) return aSevera - bSevera;
      // Segundo: preferir libres
      if (a.estado !== b.estado) return a.estado === 'libre' ? -1 : 1;
      // Tercero: menor % ocupación post-rotación (más espacio)
      const aPct = a.pct_si_roto == null ? 999 : a.pct_si_roto;
      const bPct = b.pct_si_roto == null ? 999 : b.pct_si_roto;
      if (aPct !== bPct) return aPct - bPct;
      // Cuarto: mayor capacidad
      return (b.capacidad || 0) - (a.capacidad || 0);
    });

    const topRecomendado = candidatos.length ? candidatos[0] : null;

    // v4.5.4: defensa — si no hay candidatos, devolver mensaje claro en lugar de lista vacía
    if (candidatos.length === 0) {
      const noOptionsMsg = '*Rotación del lote ' + matchedLot.code + '*\n' +
        '• Potrero actual: *' + (matchedLot.paddock || '?') + '*\n' +
        '• ' + cabLote + ' cabezas\n\n' +
        '⚠ No hay otros potreros conocidos para rotar.\n' +
        'Tu estancia tiene los siguientes potreros en uso historico:\n' +
        Array.from(todosPotreros).map(p => '  • ' + p).join('\n') +
        '\n\nSi queres rotar a un potrero distinto, configurá los potreros en la app Desktop' +
        ' (Configuracion → Parametros → Potreros) o respondé con el nombre exacto de otro potrero.';
      return res.json({
        ok: true,
        lot_code: matchedLot.code,
        current_paddock: matchedLot.paddock || '',
        days_in_paddock: diasEnPotrero,
        animal_count: cabLote,
        candidates: [],
        recommended: null,
        message: noOptionsMsg
      });
    }

    // Mensaje resumen para el bot
    let message = '*Rotación del lote ' + matchedLot.code + '*\n' +
      '• Potrero actual: *' + (matchedLot.paddock || '?') + '*\n' +
      '• ' + cabLote + ' cabezas';
    if (diasEnPotrero != null) {
      message += '\n• Tiempo en potrero: *' + diasEnPotrero + ' días*';
      if (diasEnPotrero >= 45) message += ' ⚠ _conviene rotar_';
      else if (diasEnPotrero >= 30) message += ' _puede rotarse_';
      else message += ' _aún temprano para rotar_';
    }
    message += '\n\n*Potreros disponibles:*\n';

    candidatos.slice(0, 6).forEach((c, i) => {
      const tag = (topRecomendado && c.paddock === topRecomendado.paddock) ? ' ⭐ _recomendado_' : '';
      let line = (i+1) + '. *' + c.paddock + '*' + tag + '\n';
      if (c.capacidad > 0) {
        line += '   ' + c.cab_si_roto + ' / ' + c.capacidad + ' cab post-rotación (' + c.pct_si_roto + '%)';
      } else {
        line += '   ' + c.cab_si_roto + ' cab si se rota (capacidad sin config)';
      }
      if (c.otros_lotes.length > 0) line += ' · comparte con ' + c.otros_lotes.join(', ');
      if (c.warning) line += '\n   ⚠ _sobrepoblaría_';
      message += line + '\n';
    });

    return res.json({
      ok: true,
      lot_code: matchedLot.code,
      current_paddock: matchedLot.paddock || '',
      days_in_paddock: diasEnPotrero,
      animal_count: cabLote,
      candidates: candidatos,
      recommended: topRecomendado ? topRecomendado.paddock : null,
      message: message
    });
  } catch (e) {
    console.error('[rotation-suggestion] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── PDF Generation ──────────────────────────────────────────
app.post('/api/generate-pdf', auth, async (req, res) => {
  try {
    const { type, data } = req.body;
    if (!type) return res.status(400).json({ error: 'type requerido' });
    
    console.log('[PDF] Generating:', type, 'animals:', (data?.animals||[]).length, 'buyer:', data?.buyer);

    const lots = await getTable(req.tenantId, 'lots');
    const branding = await getTable(req.tenantId, 'branding');
    const brand = (branding && !Array.isArray(branding)) ? branding : {};
    // v4.14.1: usar el nombre de estancia configurado por cada tenant.
    // El Desktop lo guarda en report_params.nombre_estancia (Identidad de la Estancia);
    // estancia_params queda como respaldo. Solo cae a 'EstanciaPro' si no hay nada configurado.
    const _reportParams = await getTable(req.tenantId, 'report_params');
    const _rp = (_reportParams && !Array.isArray(_reportParams)) ? _reportParams : {};
    const _estanciaParams = await getTable(req.tenantId, 'estancia_params');
    const _ep = (_estanciaParams && !Array.isArray(_estanciaParams)) ? _estanciaParams : {};
    const estanciaName = brand.nombre || _rp.nombre_estancia || _ep.nombre_estancia || data?.estancia_name || 'EstanciaPro';
    const propietario = brand.propietario || _rp.propietario || _ep.propietario || data?.propietario || '';

    const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));

    const promise = new Promise((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    // Colors
    const amber = '#D4860B';
    const dark = '#1a1a2e';
    const gray = '#666';

    // Header helper
    function pdfHeader(title, subtitle) {
      doc.rect(0, 0, doc.page.width, 80).fill(dark);
      doc.fill('#fff').fontSize(20).font('Helvetica-Bold').text(estanciaName, 50, 20);
      doc.fontSize(12).font('Helvetica').fill('#ccc').text(title, 50, 45);
      if (subtitle) doc.fontSize(9).fill('#999').text(subtitle, 50, 62);
      doc.fill('#000').font('Helvetica');
      doc.moveDown(3);
    }

    function tableHeader(headers, widths, y) {
      let x = 50;
      doc.rect(50, y - 3, doc.page.width - 100, 18).fill('#f0f0f0');
      doc.fill('#333').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => { doc.text(h, x, y, { width: widths[i], align: i > 1 ? 'right' : 'left' }); x += widths[i]; });
      doc.font('Helvetica').fill('#000');
      return y + 20;
    }

    function tableRow(cells, widths, y) {
      if (y > doc.page.height - 60) { doc.addPage(); y = 50; }
      let x = 50;
      doc.fontSize(8).fill('#333');
      cells.forEach((c, i) => { doc.text(String(c), x, y, { width: widths[i], align: i > 1 ? 'right' : 'left' }); x += widths[i]; });
      return y + 14;
    }

    function footer() {
      const y = doc.page.height - 30;
      doc.fontSize(7).fill('#999').text('Generado por EstanciaPro · SG Bolivia · ' + new Date().toLocaleString('es-BO'), 50, y, { align: 'center', width: doc.page.width - 100 });
    }

    if (type === 'proforma_simple') {
      // ═══ PROFORMA SIMPLE — v2 (resumen agregado, 1 página) ═══
      // Modos:
      //  - scope='lot'           → todo el lote (lot_code)
      //  - scope='weight_range'  → animales en rango de peso (min_weight, max_weight, lot_code opcional)
      // Datos calculados server-side: animal_count, total_kg, weight_neto, total_bs.
      // Datos opcionales del usuario:
      //  - weight_discount_pct (descuento de peso %)
      //  - total_kg_override (peso del camión)
      //  - project_to_today (true/false): proyectar peso con GMD del lote hasta HOY
      const scope = data?.scope || 'lot';
      const lotCode = data?.lot_code || '';
      const minWeight = data?.min_weight != null ? Number(data.min_weight) : null;
      const maxWeight = data?.max_weight != null ? Number(data.max_weight) : null;
      const buyer = data?.buyer || '';
      const priceKg = Number(data?.price_per_kg || 0);
      const discountPct = Number(data?.weight_discount_pct || 0);
      const overrideKg = data?.total_kg_override != null ? Number(data.total_kg_override) : null;
      const notes = data?.notes || '';
      const projectToToday = !!data?.project_to_today;   // v4.3.4: opcional, default false

      console.log('[PDF Proforma Simple]', 'scope:', scope, 'lot:', lotCode, 'range:', minWeight, '-', maxWeight, 'buyer:', buyer, 'price:', priceKg, 'discount:', discountPct, 'project:', projectToToday);

      // Cargar animales del tenant para calcular agregados
      const allAnimalsByLot = await getTable(req.tenantId, 'animals');
      let candidatos = [];

      if (scope === 'lot') {
        if (!lotCode) throw new Error('Modo lote requiere lot_code');
        // Comparación case-insensitive y trim para tolerar TROPA 1 vs Tropa 1
        const lotNorm = String(lotCode).trim().toLowerCase();
        const keys = Object.keys(allAnimalsByLot || {});
        const matchKey = keys.find(k => String(k).trim().toLowerCase() === lotNorm);
        if (matchKey) candidatos = allAnimalsByLot[matchKey] || [];
      } else if (scope === 'weight_range') {
        // Pasar por todos los lotes y filtrar por peso
        Object.keys(allAnimalsByLot || {}).forEach(k => {
          if (lotCode && String(k).trim().toLowerCase() !== String(lotCode).trim().toLowerCase()) return;
          (allAnimalsByLot[k] || []).forEach(a => candidatos.push(a));
        });
      }

      // Calcular peso último y fecha del último pesaje
      function lastPesoOf(animal) {
        const list = animal?.pesajes || [];
        if (!list.length) return { peso: 0, fecha: null };
        const sorted = list.slice().sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));
        const last = sorted[sorted.length - 1];
        return { peso: Number(last?.peso || 0), fecha: last?.fecha || null };
      }

      // v4.3.4: Calcular GMD del lote (promedio de animales con 2+ pesajes válidos).
      // Solo se calcula si projectToToday=true para no gastar CPU innecesario.
      let gmdLote = 0;           // kg/día
      let animalsWithGmd = 0;
      if (projectToToday) {
        // Para weight_range con varios lotes, el GMD se calcula sobre los animales candidatos.
        // Para scope='lot', son todos del lote.
        let sumGmd = 0;
        candidatos.forEach(a => {
          const list = (a?.pesajes || []).slice().sort((x, y) => String(x.fecha || '').localeCompare(String(y.fecha || '')));
          if (list.length < 2) return;
          const first = list[0];
          const last = list[list.length - 1];
          const w1 = Number(first?.peso || 0);
          const w2 = Number(last?.peso || 0);
          if (!w1 || !w2) return;
          const d1 = new Date(first.fecha || '').getTime();
          const d2 = new Date(last.fecha || '').getTime();
          const days = (d2 - d1) / 86400000;
          if (days < 7) return;   // mínimo 7 días para que el GMD sea creíble
          const gmd = (w2 - w1) / days;
          if (gmd > -2 && gmd < 5) {   // sanity check: -2 a +5 kg/día (descartar outliers)
            sumGmd += gmd;
            animalsWithGmd++;
          }
        });
        gmdLote = animalsWithGmd > 0 ? sumGmd / animalsWithGmd : 0;
      }

      // Calcular agregados, aplicando proyección si corresponde
      let totalAnimals = 0;
      let totalKg = 0;             // peso base (último pesaje)
      let totalKgProjected = 0;    // peso proyectado a hoy (sumamos día a día por animal)
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);

      candidatos.forEach(a => {
        const { peso, fecha } = lastPesoOf(a);
        if (scope === 'weight_range') {
          if (minWeight != null && peso < minWeight) return;
          if (maxWeight != null && peso > maxWeight) return;
          if (peso <= 0) return; // sin pesaje, no incluir en rango
        }
        totalAnimals++;
        totalKg += peso;
        // Proyección individual con GMD del lote
        if (projectToToday && gmdLote > 0 && fecha && peso > 0) {
          const dLast = new Date(fecha);
          dLast.setHours(0, 0, 0, 0);
          const diasTrans = Math.max(0, Math.floor((hoy.getTime() - dLast.getTime()) / 86400000));
          totalKgProjected += peso + (gmdLote * diasTrans);
        } else {
          totalKgProjected += peso;
        }
      });

      // Si projectToToday=true y hay GMD válido, usar el proyectado como base
      const usarProyeccion = projectToToday && gmdLote > 0 && totalAnimals > 0;
      const pesoBase = usarProyeccion ? Math.round(totalKgProjected) : Math.round(totalKg);
      // Override de peso total si el usuario lo dio (ej: peso de báscula)
      const pesoBruto = overrideKg != null && overrideKg > 0 ? overrideKg : pesoBase;
      const descuentoKg = Math.round(pesoBruto * (discountPct / 100));
      const pesoNeto = pesoBruto - descuentoKg;
      const totalBs = Math.round(pesoNeto * priceKg);

      // ─── Render PDF ───
      const titulo = scope === 'lot'
        ? 'PROFORMA DE VENTA — Lote ' + lotCode
        : 'PROFORMA DE VENTA — Rango ' + (minWeight != null ? minWeight + 'kg' : '0kg') + '–' + (maxWeight != null ? maxWeight + 'kg' : '∞') + (lotCode ? ' (' + lotCode + ')' : '');
      pdfHeader('PROFORMA DE VENTA', 'Fecha: ' + new Date().toLocaleDateString('es-BO'));

      let yCursor = 110;
      if (buyer) {
        doc.fontSize(12).font('Helvetica-Bold').text('Comprador: ', 50, yCursor, { continued: true }).font('Helvetica').text(buyer);
        yCursor += 22;
      }
      doc.fontSize(10).font('Helvetica-Bold').text('Detalle:', 50, yCursor, { continued: true }).font('Helvetica').text(' ' + titulo.replace('PROFORMA DE VENTA — ', ''));
      yCursor += 30;

      // Box de detalle agregado
      const boxX = 50;
      const boxW = doc.page.width - 100;
      const lineH = 22;
      const rows = [['Cabezas', totalAnimals.toLocaleString()]];

      // v4.3.4: si se proyectó, mostrar el peso base + GMD + peso proyectado para transparencia
      if (usarProyeccion && !overrideKg) {
        rows.push(['Peso último (sistema)', Math.round(totalKg).toLocaleString() + ' kg']);
        rows.push(['GMD aplicado (lote)', '+ ' + gmdLote.toFixed(2) + ' kg/día (' + animalsWithGmd + ' animales)']);
        rows.push(['Peso estimado a hoy', pesoBruto.toLocaleString() + ' kg']);
      } else {
        rows.push(['Peso bruto', pesoBruto.toLocaleString() + ' kg' + (overrideKg ? ' (ingresado)' : ' (último pesaje)')]);
      }
      if (discountPct > 0) {
        rows.push(['Descuento ' + discountPct + '%', '− ' + descuentoKg.toLocaleString() + ' kg']);
        rows.push(['Peso neto', pesoNeto.toLocaleString() + ' kg']);
      }
      rows.push(['Precio por kg', 'Bs. ' + priceKg.toLocaleString()]);

      doc.rect(boxX, yCursor, boxW, rows.length * lineH + 12).lineWidth(1).stroke(amber);
      rows.forEach((r, i) => {
        const ry = yCursor + 8 + i * lineH;
        doc.fontSize(10).fill('#333').font('Helvetica-Bold').text(r[0] + ':', boxX + 15, ry);
        doc.fontSize(11).fill('#000').font('Helvetica').text(r[1], boxX + 200, ry);
      });
      yCursor += rows.length * lineH + 24;

      // Box de TOTAL destacado
      doc.rect(boxX, yCursor, boxW, 50).fill(amber);
      doc.fill('#fff').fontSize(11).font('Helvetica-Bold').text('TOTAL ESTIMADO', boxX + 20, yCursor + 12);
      doc.fontSize(22).text('Bs. ' + totalBs.toLocaleString(), boxX + 20, yCursor + 24);
      doc.fill('#000').font('Helvetica');
      yCursor += 70;

      if (notes) {
        doc.fontSize(9).fill('#333').text('Notas: ' + notes, 50, yCursor);
        yCursor += 30;
      }

      doc.fontSize(8).fill(gray).text('* Precios sujetos a pesaje definitivo. Validez 7 días. Esta proforma es estimativa.', 50, yCursor);
      yCursor += 12;
      if (usarProyeccion && !overrideKg) {
        doc.fontSize(8).fill(gray).text('* Peso estimado considera el crecimiento del lote (GMD promedio) desde el último pesaje hasta hoy.', 50, yCursor);
        yCursor += 12;
      } else if (projectToToday && gmdLote === 0) {
        doc.fontSize(8).fill(gray).text('* No fue posible proyectar el peso: el lote no tiene suficientes pesajes para calcular un GMD.', 50, yCursor);
        yCursor += 12;
      }
      yCursor += 28;

      doc.fontSize(9).fill('#000').text('_______________________________', 50, yCursor);
      doc.text(propietario || estanciaName, 50, yCursor + 14);
      doc.text('Propietario / Administrador', 50, yCursor + 28);

      footer();

    } else if (type === 'animal_report') {
      // ═══ INFORME DE ANIMAL INDIVIDUAL ═══
      const animal = data?.animal || {};
      pdfHeader('INFORME DE ANIMAL', 'ID: ' + (animal.animal_id || ''));

      doc.fontSize(11).font('Helvetica-Bold').text('Datos del Animal', 50, 100);
      doc.moveDown(0.3);
      const fields = [
        ['ID', animal.animal_id], ['Lote', animal.lot_code], ['Raza', animal.breed],
        ['Categoría', animal.category], ['Potrero', animal.paddock],
        ['Peso actual', (animal.last_weight || 0) + ' kg'], ['Peso inicial', (animal.first_weight || 0) + ' kg'],
        ['GMD', (animal.gmd || 0) + ' kg/día'], ['Días en estancia', animal.days_in_estancia || 0]
      ];
      fields.forEach(([l, v]) => {
        doc.fontSize(9).font('Helvetica-Bold').text(l + ': ', 50, doc.y, { continued: true }).font('Helvetica').text(String(v || '-'));
      });

      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica-Bold').text('Historial de Pesajes');
      doc.moveDown(0.5);
      if (animal.pesajes && animal.pesajes.length) {
        const w2 = [120, 100, 100];
        let y2 = tableHeader(['FECHA', 'PESO (KG)', 'VARIACIÓN'], w2, doc.y);
        let prevPeso = 0;
        animal.pesajes.forEach(p => {
          const diff = prevPeso ? (p.peso - prevPeso) : 0;
          y2 = tableRow([p.fecha || '-', p.peso || 0, prevPeso ? (diff > 0 ? '+' : '') + diff + ' kg' : '-'], w2, y2);
          prevPeso = p.peso;
        });
      } else { doc.fontSize(9).text('Sin pesajes registrados'); }

      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica-Bold').text('Curaciones Recibidas');
      doc.moveDown(0.5);
      if (animal.treatments && animal.treatments.length) {
        const w3 = [120, 100, 80, 80, 120];
        let y3 = tableHeader(['FECHA', 'PRODUCTO', 'DOSIS', 'TOTAL', 'DIAGNÓSTICO'], w3, doc.y);
        animal.treatments.forEach(t => {
          y3 = tableRow([t.applied_at || t.date || '-', t.product_name || '-', t.dose || '-', t.total || '-', t.diagnosis || '-'], w3, y3);
        });
      } else { doc.fontSize(9).text('Sin curaciones registradas'); }

      footer();

    } else if (type === 'lot_report') {
      // ═══ INFORME DE LOTE ═══
      const { lot_code, animals, summary } = data || {};
      const lot = (Array.isArray(lots) ? lots : []).find(l => l.code === lot_code) || {};
      pdfHeader('INFORME DE LOTE ' + (lot_code || ''), lot.category + ' · ' + lot.breed + ' · ' + lot.paddock);

      doc.fontSize(11).font('Helvetica-Bold').text('Resumen del Lote', 50, 100);
      doc.moveDown(0.3);
      [['Código', lot_code], ['Categoría', lot.category], ['Raza', lot.breed], ['Potrero', lot.paddock],
       ['Cabezas', summary?.count || lot.animal_count], ['Peso promedio', (summary?.avg_weight || lot.avg_weight || 0) + ' kg'],
       ['Peso total', (summary?.total_kg || 0).toLocaleString() + ' kg']
      ].forEach(([l, v]) => {
        doc.fontSize(9).font('Helvetica-Bold').text(l + ': ', 50, doc.y, { continued: true }).font('Helvetica').text(String(v || '-'));
      });

      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica-Bold').text('Detalle de Animales');
      doc.moveDown(0.5);
      const w4 = [70, 80, 80, 60, 70, 70, 80];
      let y4 = tableHeader(['ID', 'RAZA', 'PESO KG', 'GMD', 'PESAJES', 'ÚLT.PESAJE', 'POTRERO'], w4, doc.y);
      (animals || []).forEach(a => {
        y4 = tableRow([a.animal_id, a.breed || '-', a.last_weight || 0, a.gmd || '-', a.pesajes_count || 0, a.last_pesaje_date || '-', a.paddock || '-'], w4, y4);
      });

      footer();

    } else if (type === 'weight_report') {
      // ═══ INFORME POR RANGO DE PESO ═══
      const { animals, filters, total, total_kg, avg_weight, by_lot } = data || {};
      const rangeStr = (filters?.min_weight ? 'desde ' + filters.min_weight + 'kg' : '') + (filters?.max_weight ? ' hasta ' + filters.max_weight + 'kg' : '') || 'Todos';
      pdfHeader('INFORME POR PESO', 'Rango: ' + rangeStr + ' · ' + new Date().toLocaleDateString('es-BO'));

      doc.fontSize(11).font('Helvetica-Bold').text('Resumen', 50, 100);
      doc.moveDown(0.3);
      [['Total animales', total], ['Peso total', (total_kg || 0).toLocaleString() + ' kg'], ['Peso promedio', (avg_weight || 0) + ' kg'],
       ['Filtro lote', filters?.lot_code || 'Todos'], ['Filtro raza', filters?.breed || 'Todas']
      ].forEach(([l, v]) => {
        doc.fontSize(9).font('Helvetica-Bold').text(l + ': ', 50, doc.y, { continued: true }).font('Helvetica').text(String(v || '-'));
      });

      // By lot summary
      doc.moveDown(1);
      (by_lot || []).forEach(g => {
        doc.fontSize(10).font('Helvetica-Bold').text('Lote ' + g.lot_code + ' — ' + g.category + ' (' + g.count + ' cab, prom. ' + g.avg_weight + ' kg)');
        doc.moveDown(0.3);
        const w5 = [70, 80, 80, 60, 70, 80];
        let y5 = tableHeader(['ID', 'RAZA', 'PESO KG', 'GMD', 'PESAJES', 'ÚLT.PESAJE'], w5, doc.y);
        (g.animals || []).forEach(a => {
          y5 = tableRow([a.animal_id, a.breed || '-', a.last_weight, a.gmd || '-', a.pesajes_count, a.last_pesaje_date || '-'], w5, y5);
        });
        doc.moveDown(1);
      });

      footer();

    } else {
      doc.fontSize(14).text('Tipo de informe no reconocido: ' + type);
    }

    doc.end();
    const pdfBuffer = await promise;
    const base64 = pdfBuffer.toString('base64');
    console.log('[PDF]', req.tenantId, type, Math.round(base64.length / 1024) + 'KB');
    res.json({ ok: true, base64: base64, size_kb: Math.round(base64.length / 1024), type: type });
  } catch (e) {
    console.error('[PDF Error]', e.message, e.stack);
    res.status(500).json({ error: e.message, stack: e.stack?.split('\n').slice(0,3) });
  }
});

// ── Tenant branding ──────────────────────────────────────────
app.get('/api/tenant/branding', auth, async (req, res) => {
  try {
    const branding = await getTable(req.tenantId, 'branding');
    res.json(Array.isArray(branding) ? {} : branding);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/tenant/branding', auth, async (req, res) => {
  try {
    const { name, logo } = req.body;
    const current = await getTable(req.tenantId, 'branding');
    const updated = { ...(Array.isArray(current) ? {} : current), ...(name !== undefined ? { name } : {}), ...(logo !== undefined ? { logo } : {}), updated_at: new Date().toISOString() };
    await setTable(req.tenantId, 'branding', updated);
    res.json({ ok: true, branding: updated });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Full DB push ──────────────────────────────────────────────
app.post('/api/sync-push', auth, async (req, res) => {
  try {
    const { db, source, preserve_lots } = req.body;
    if (!db) return res.status(400).json({ error: 'db required' });
    const tenantId = req.tenantId;
    const isField  = source === 'field';
    const pushed   = {};

    // ── Cargar deleted_ids del tenant para filtrar antes de merge ──
    // Esto previene que clientes con cache vieja re-suban registros que el Desktop borró.
    const deletedIdsRaw = await getTable(tenantId, '_deleted_ids');
    const deletedMap = (deletedIdsRaw && typeof deletedIdsRaw === 'object' && !Array.isArray(deletedIdsRaw)) ? deletedIdsRaw : {};
    function isDeleted(table, id) {
      return !!deletedMap[table + ':' + String(id)];
    }
    function filterNotDeleted(arr, table) {
      if (!Array.isArray(arr)) return arr;
      const before = arr.length;
      const filtered = arr.filter(r => !isDeleted(table, r && r.id));
      if (filtered.length !== before) {
        console.log(`[sync-push] ${tenantId}: filtrados ${before - filtered.length} ${table} borrados de ${source||'desktop'}`);
      }
      return filtered;
    }

    // ── LOTS
    if (Array.isArray(db.lots) && db.lots.length > 0) {
      // Filtrar lotes borrados ANTES del merge
      const incomingLots = filterNotDeleted(db.lots, 'lots');
      const existingLots = await getTable(tenantId, 'lots');
      // FIX BAJAS (v1.4.26): animals[code].length es la ÚNICA fuente de verdad.
      // Antes usaba Math.max(animal_count, realCount), pero eso bloqueaba bajas:
      // si animal_count llegaba decrementado pero animals aún no había sido actualizado
      // (race condition entre bulk-push de animals y sync-push de lots), el max se
      // quedaba con el valor viejo. Ahora si hay animals registrados, animals manda.
      const serverAnimals = await getTable(tenantId, 'animals') || {};
      function reconcileCount(lot) {
        if (!lot || !lot.code) return lot.animal_count || 0;
        if (lot.status === 'vendido' || lot.status === 'sold') return 0;
        const realCount = (serverAnimals[lot.code] || []).length;
        // Si hay animals registrados, animals[code].length manda (incluye 0 = todos dados de baja).
        // Si no hay animals registrados (lote nuevo o sin kardex), respetar animal_count del incoming.
        if ((serverAnimals[lot.code] || []).length > 0 || serverAnimals[lot.code] !== undefined) {
          return realCount;
        }
        return lot.animal_count || 0;
      }
      if (isField) {
        // Field (PWA/bot) pushea: solo aceptar paddock si el incoming tiene timestamp más reciente
        // que el server, o si el server no tiene timestamp (legacy data).
        const updatedLots = existingLots.map(existing => {
          const incoming = incomingLots.find(l => l.id == existing.id);
          if (!incoming) return { ...existing, animal_count: reconcileCount(existing) };
          // ¿El incoming tiene un timestamp de cuando se cambió el paddock?
          const incomingPaddockTs = incoming.paddock_updated_at || incoming.updated_at || '';
          const existingPaddockTs = existing.paddock_updated_at || existing.server_updated_at || '';
          // Solo aceptar paddock del field si:
          //  1) El incoming trae un paddock distinto al del server, AND
          //  2) El timestamp del incoming es >= al del server, OR el server no tiene timestamp
          let newPaddock = existing.paddock;
          let newPaddockTs = existingPaddockTs;
          if (incoming.paddock && incoming.paddock !== existing.paddock) {
            if (!existingPaddockTs || (incomingPaddockTs && incomingPaddockTs >= existingPaddockTs)) {
              newPaddock = incoming.paddock;
              newPaddockTs = incomingPaddockTs || new Date().toISOString();
            }
            // Si el incoming es más viejo, ignorar (preserva el cambio de Desktop)
          }
          const proposedCount = incoming.animal_count !== undefined ? incoming.animal_count : existing.animal_count;
          return {
            ...existing,
            paddock: newPaddock,
            paddock_updated_at: newPaddockTs,
            animal_count: reconcileCount({ ...existing, animal_count: proposedCount, code: existing.code, status: existing.status }),
            avg_weight: incoming.avg_weight || existing.avg_weight,
            server_updated_at: new Date().toISOString()
          };
        });
        incomingLots.forEach(l => { if (!existingLots.find(e => e.id == l.id)) updatedLots.push({ ...l, animal_count: reconcileCount(l) }); });
        await setTable(tenantId, 'lots', updatedLots);
        pushed.lots = updatedLots.length;

        // v4.5.1: sincronizar rotation_history para cada lote actualizado
        for (const upd of updatedLots) {
          const prev = existingLots.find(e => e.code === upd.code) || null;
          try {
            await syncRotationOnLotChange(tenantId, upd, prev, { reason: 'sync-push-field', source: 'field' });
          } catch(e) { console.error('[sync-push field rotation_history]', upd.code, e.message); }
        }
      } else if (!preserve_lots) {
        // Desktop pushea: gana Desktop SIEMPRE. Marca timestamp.
        const updatedLots = existingLots.map(existing => {
          const incoming = incomingLots.find(l => l.id == existing.id);
          if (!incoming) return { ...existing, animal_count: reconcileCount(existing) };
          const paddockChanged = incoming.paddock && incoming.paddock !== existing.paddock;
          // FIX continuidad: usar animal_count del incoming si difiere, reconciliado contra animals real
          const proposedCount = incoming.animal_count !== undefined ? incoming.animal_count : existing.animal_count;
          return {
            ...incoming,
            // animal_count: el mayor entre lo que dice el incoming y los animales reales en server
            animal_count: reconcileCount({ ...incoming, animal_count: proposedCount }),
            avg_weight: incoming.avg_weight || existing.avg_weight,
            // Si cambió paddock, marcar nuevo timestamp
            paddock_updated_at: paddockChanged ? new Date().toISOString() : (existing.paddock_updated_at || ''),
            server_updated_at: new Date().toISOString()
          };
        });
        incomingLots.forEach(l => { if (!existingLots.find(e => e.id == l.id)) updatedLots.push({...l, animal_count: reconcileCount(l), paddock_updated_at: new Date().toISOString()}); });
        await setTable(tenantId, 'lots', updatedLots);
        pushed.lots = updatedLots.length;

        // v4.5.1: sincronizar rotation_history para cada lote actualizado
        for (const upd of updatedLots) {
          const prev = existingLots.find(e => e.code === upd.code) || null;
          try {
            await syncRotationOnLotChange(tenantId, upd, prev, { reason: 'sync-push-desktop', source: 'desktop' });
          } catch(e) { console.error('[sync-push desktop rotation_history]', upd.code, e.message); }
        }
      }
    }

    // ── DESKTOP ONLY (replace) — proteger contra push del field con cache vieja
    if (Array.isArray(db.sales) && !isField)     { await setTable(tenantId, 'sales', filterNotDeleted(db.sales, 'sales')); pushed.sales = db.sales.length; }
    if (Array.isArray(db.employees) && !isField) { await setTable(tenantId, 'employees', filterNotDeleted(db.employees, 'employees')); pushed.employees = db.employees.length; }
    if (Array.isArray(db.alerts) && !isField)    { await setTable(tenantId, 'health_alerts', filterNotDeleted(db.alerts, 'health_alerts')); pushed.alerts = db.alerts.length; }

    // ── PRODUCTS
    if (Array.isArray(db.products) && db.products.length > 0) {
      const incomingProducts = filterNotDeleted(db.products, 'products');
      const existingProducts = await getTable(tenantId, 'vet_products');
      const updatedProducts = existingProducts.map(existing => {
        const incoming = incomingProducts.find(p => p.id == existing.id);
        if (!incoming) return existing;
        const stockWins = (incoming.stock_updated_at || '') >= (existing.stock_updated_at || '') || incoming.stock_qty !== undefined;
        // FIX bug expiry_date no persiste al borrarse:
        // Antes usaba `incoming.X || existing.X` para todos los campos editables, lo cual
        // tratava null/""/0 como "no enviado" y mantenía el valor viejo del server.
        // Ahora distinguimos undefined (campo no enviado por el cliente) vs null/"" (borrado intencional).
        // Aplica a: stock_min, unit_cost, supplier, expiry_date — todos pueden ser legítimamente
        // null/vacío. Para name/type/unit mantenemos `||` porque un producto debe tener esos siempre.
        const editableFields = isField ? {} : {
          name: incoming.name || existing.name,
          type: incoming.type || existing.type,
          unit: incoming.unit || existing.unit,
          stock_min: incoming.stock_min !== undefined ? incoming.stock_min : existing.stock_min,
          unit_cost: incoming.unit_cost !== undefined ? incoming.unit_cost : existing.unit_cost,
          supplier: incoming.supplier !== undefined ? incoming.supplier : existing.supplier,
          expiry_date: incoming.expiry_date !== undefined ? incoming.expiry_date : existing.expiry_date
        };
        return { ...existing, stock_qty: stockWins && incoming.stock_qty !== undefined ? incoming.stock_qty : existing.stock_qty, stock_updated_at: stockWins ? new Date().toISOString() : existing.stock_updated_at, ...editableFields, server_updated_at: new Date().toISOString() };
      });
      if (!isField) { incomingProducts.forEach(p => { if (!existingProducts.find(e => e.id == p.id)) updatedProducts.push(p); }); }
      await setTable(tenantId, 'vet_products', updatedProducts);
      pushed.vet_products = updatedProducts.length;
    }

    // ── PURCHASES
    if (Array.isArray(db.purchases) && db.purchases.length > 0) {
      const incomingPurchases = filterNotDeleted(db.purchases, 'purchases');
      const existing = await getTable(tenantId, 'purchases');
      const existingMap = {};
      existing.forEach(r => { existingMap[r.id] = r; });
      const merged = existing.map(r => { const inc = incomingPurchases.find(p => p.id == r.id); return inc ? { ...r, ...inc } : r; });
      incomingPurchases.forEach(p => { if (!existingMap[p.id]) merged.push(p); });
      // Filtrar el resultado por si quedaban registros viejos en server que ya fueron borrados
      const finalMerged = filterNotDeleted(merged, 'purchases');
      await setTable(tenantId, 'purchases', finalMerged);
      pushed.purchases = finalMerged.length;
    }

    // ── FIELD TABLES (merge por ID, filtrando borrados primero)
    const FIELD_TABLES = {
      treatments:'treatments', pesajes:'pesajes', maintenance:'maintenance',
      agua:'agua', sal:'sal', conteo:'conteo', partos:'partos', alimento:'alimento',
      lluvias:'lluvias', diesel:'diesel', aceite:'aceite',
      cuentas:'cuentas', kardex:'kardex', historial_sueldos:'historial_sueldos',
      compras_ganado:'compras_ganado', bajas:'bajas', maquinaria:'maquinaria', pasture_evals:'pasture_evals',
      rotation_history:'rotation_history',
    };
    for (const [dbKey, tableKey] of Object.entries(FIELD_TABLES)) {
      if (Array.isArray(db[dbKey]) && db[dbKey].length > 0) {
        const incoming = filterNotDeleted(db[dbKey], tableKey);
        const existing = await getTable(tenantId, tableKey);

        // ── FIX BAJAS (v1.4.26): procesar bajas nuevas que llegan por sync-push
        // Cuando la PWA da de baja un animal, manda el registro vía sync-push.
        // Antes de mergear, detectamos las bajas nuevas (no existían en server) y
        // aplicamos el efecto colateral: eliminar del kardex de animales.
        // El recálculo de lot.animal_count se delega al fix de "animals como fuente
        // de verdad" más abajo en el bloque de LOTS (reconcileCount usa length).
        if (tableKey === 'bajas' && isField) {
          const existingIds = new Set(existing.map(b => String(b.id)));
          const newBajas = incoming.filter(b => !existingIds.has(String(b.id)) && b.animal_id && b.lot_code);
          if (newBajas.length > 0) {
            try {
              const animals = await getTable(tenantId, 'animals') || {};
              let animalsChanged = false;
              for (const baja of newBajas) {
                const lotAnimals = animals[baja.lot_code] || [];
                const before = lotAnimals.length;
                animals[baja.lot_code] = lotAnimals.filter(a =>
                  String(a.id || a.animal_id || '') !== String(baja.animal_id)
                );
                if (animals[baja.lot_code].length !== before) {
                  animalsChanged = true;
                  console.log(`[sync-push bajas] ${tenantId}: Animal #${baja.animal_id} eliminado de animals[${baja.lot_code}] (${before} → ${animals[baja.lot_code].length})`);
                }
              }
              if (animalsChanged) {
                await setTable(tenantId, 'animals', animals);
              }
            } catch(e) { console.error('[sync-push bajas] Error:', e.message); }
          }
        }

        // FIX v1.4.32 (14-may-2026): aplicar descuento/recarga al diesel_tank cuando llegan
        // movimientos NUEVOS de diesel desde la PWA vía sync-push.
        // Antes esta lógica solo existía en /api/bot-transaction, por lo que despachos
        // registrados desde la PWA quedaban en db.diesel pero el tanque nunca se actualizaba.
        // IMPORTANTE: solo procesar transacciones de la PWA (source==='field'). El Desktop
        // ya actualiza el diesel_tank localmente vía replaceTableInRailway('diesel_tank',...)
        // antes de pushear el registro, así que aplicar acá causaría doble descuento.
        if (tableKey === 'diesel' && isField) {
          const existingIds = new Set(existing.map(d => String(d.id)));
          const newDieselTx = incoming.filter(d =>
            !existingIds.has(String(d.id)) &&
            d.source === 'field'  // solo PWA — el Desktop maneja tanque por su cuenta
          );
          if (newDieselTx.length > 0) {
            try {
              let tanks = await getTable(tenantId, 'diesel_tank');
              if (!Array.isArray(tanks)) {
                tanks = [{ id: 'tank_1', name: 'Cisterna Principal', capacity: 1000, current_level: 0 }];
              }
              let tanksChanged = false;
              for (const tx of newDieselTx) {
                const litros = parseFloat(tx.litros) || 0;
                if (litros <= 0) continue;
                // Inferir tipo si no viene explícito (saveDieselPwa omite el campo)
                const txType = tx.type || (tx.proveedor ? 'recarga' : (tx.vehiculo ? 'despacho' : null));
                if (!txType) continue;
                // Resolver tanque destino
                const tank = tx.tank_id ? (tanks.find(t => t.id === tx.tank_id) || tanks[0]) : tanks[0];
                if (!tank) continue;
                if (txType === 'recarga') {
                  const newLevel = (tank.current_level || 0) + litros;
                  tank.current_level = Math.round(Math.min(newLevel, tank.capacity || newLevel) * 10) / 10;
                  tanksChanged = true;
                  console.log(`[sync-push diesel] ${tenantId}: RECARGA(PWA) +${litros}L en ${tank.name} → ${tank.current_level}L`);
                } else if (txType === 'despacho') {
                  const newLevel = (tank.current_level || 0) - litros;
                  tank.current_level = Math.round(Math.max(0, newLevel) * 10) / 10;
                  tanksChanged = true;
                  console.log(`[sync-push diesel] ${tenantId}: DESPACHO(PWA) -${litros}L de ${tank.name} → vehiculo=${tx.vehiculo||'?'} → ${tank.current_level}L`);
                }
              }
              if (tanksChanged) {
                await setTable(tenantId, 'diesel_tank', tanks);
                console.log(`[sync-push diesel] ${tenantId}: ${newDieselTx.length} tx PWA procesadas`);
              }
            } catch(e) { console.error('[sync-push diesel] Error:', e.message); }
          }
        }

        // FIX v1.4.30 (12-may-2026): para rotation_history, hay que respetar las actualizaciones
        // de exit_date que mande el field (PWA). Sin esto, las rotaciones que la PWA cierra
        // localmente nunca se cierran en el server, generando huérfanas crónicas que después
        // confunden el render del Desktop ("SS1 OCUPADO en varios potreros").
        let merged;
        if (tableKey === 'rotation_history' && isField) {
          // Merge especial: el incoming puede actualizar exit_date/exit_at/days_occupied
          // de entradas existentes. Solo permitimos cerrar (setear exit_date), nunca reabrir.
          const existingMap = {};
          existing.forEach(r => { existingMap[r.id] = r; });
          merged = existing.map(r => {
            const inc = incoming.find(i => String(i.id) === String(r.id));
            if (!inc) return r;
            // Solo aplicar cambios de cierre: si server lo tenía abierto y incoming lo cierra
            if (!r.exit_date && inc.exit_date) {
              return {
                ...r,
                exit_date: inc.exit_date,
                exit_at: inc.exit_at || new Date().toISOString(),
                days_occupied: inc.days_occupied || r.days_occupied || 0,
                exit_eval: inc.exit_eval || r.exit_eval || '',
                has_exit_photo: inc.has_exit_photo || r.has_exit_photo || false,
                exit_reason_auto: inc.exit_reason_auto || r.exit_reason_auto || ''
              };
            }
            // Si ya tenía exit_date, mantener server (no permitir reabrir desde PWA)
            return r;
          });
          // Agregar las nuevas que no existían
          incoming.forEach(r => { if (!existingMap[r.id]) merged.push(r); });
        } else {
          merged = mergeById(existing, incoming);
        }
        // Filtrar de nuevo el resultado por si había registros viejos en server que ya fueron borrados
        const finalMergedRaw = filterNotDeleted(merged, tableKey);

        // v4.5.15: inferir paddock para tablas de actividad por lote (sync-push)
        // El Desktop empuja sal/agua/alimento/conteo/partos vía /sync-push (no /bulk-push ni /api/sal),
        // por lo que el middleware _inferPaddockMiddleware no se activa aquí.
        // Replicamos la lógica directamente sobre finalMerged solo para tablas de actividad.
        // v4.6.0: agregado reproductive_services para que sync-push masivo infiera paddock.
        const ACTIVITY_TABLES_SYNCPUSH = ['sal', 'agua', 'alimento', 'conteo', 'partos', 'reproductive_services'];
        let finalMerged = finalMergedRaw;
        if (ACTIVITY_TABLES_SYNCPUSH.indexOf(tableKey) >= 0 && Array.isArray(finalMergedRaw)) {
          const lotsForSP = await getTable(tenantId, 'lots') || [];
          const lotPaddockMapSP = {};
          lotsForSP.forEach(l => { if (l && l.code && l.paddock) lotPaddockMapSP[l.code] = l.paddock; });
          let infCount = 0;
          let tipoDefCount = 0;
          finalMerged = finalMergedRaw.map(r => {
            if (!r) return r;
            let out = r;
            // Paddock inference
            if (!(r.paddock && String(r.paddock).trim()) && r.lot_code) {
              const padd = lotPaddockMapSP[r.lot_code];
              if (padd) {
                infCount++;
                out = { ...out, paddock: padd };
              }
            }
            // v4.5.16: default tipo='mineral' para sal sin tipo
            if (tableKey === 'sal' && (!out.tipo || !String(out.tipo).trim())) {
              tipoDefCount++;
              out = { ...out, tipo: 'mineral' };
            }
            return out;
          });
          if (infCount > 0) console.log(`[sync-push infer-paddock] tenant=${tenantId} table=${tableKey} inferred=${infCount}/${finalMerged.length}`);
          if (tipoDefCount > 0) console.log(`[sync-push default-tipo] tenant=${tenantId} table=sal applied=${tipoDefCount}/${finalMerged.length}`);
        }

        await setTable(tenantId, tableKey, finalMerged);
        pushed[tableKey] = finalMerged.length;
      }
    }

    // ── FIX BAJAS (v1.4.26): después de procesar bajas (que pueden haber editado animals),
    // reconciliar animal_count de TODOS los lotes contra animals[code].length.
    // Esto garantiza que aunque el orden de llegada de pushes sea raro (sync-push antes
    // que bulk-push de animals, o viceversa), el animal_count siempre refleja la realidad.
    // Solo se ejecuta si hubo bajas nuevas o si el field pusheó lotes.
    if (isField && (Array.isArray(db.bajas) && db.bajas.length > 0 || Array.isArray(db.lots) && db.lots.length > 0)) {
      try {
        const allLots = await getTable(tenantId, 'lots');
        const animals = await getTable(tenantId, 'animals') || {};
        let reconciled = 0;
        const updated = allLots.map(l => {
          if (!l || !l.code) return l;
          if (l.status === 'vendido' || l.status === 'sold') return l;
          const realCount = (animals[l.code] || []).length;
          // Solo reconciliar si hay animals registrados (>0) y difiere del animal_count
          if (realCount > 0 && (l.animal_count || 0) !== realCount) {
            reconciled++;
            console.log(`[sync-push reconcile] ${tenantId}: Lote ${l.code} animal_count ${l.animal_count||0} → ${realCount}`);
            return { ...l, animal_count: realCount, server_updated_at: new Date().toISOString() };
          }
          return l;
        });
        if (reconciled > 0) {
          await setTable(tenantId, 'lots', updated);
        }
      } catch(e) { console.error('[sync-push reconcile] Error:', e.message); }
    }

    // ── ACTIVIDADES Y ADELANTOS
    // Aceptar tanto db.activities como db.field_activities (Desktop y PWA usan este último)
    const _activities = (Array.isArray(db.activities) && db.activities.length > 0)
      ? db.activities
      : (Array.isArray(db.field_activities) && db.field_activities.length > 0 ? db.field_activities : null);
    if (_activities && _activities.length > 0) {
      const incoming = filterNotDeleted(_activities, 'field_activities');
      const existing = await getTable(tenantId, 'field_activities');
      const finalMerged = filterNotDeleted(mergeById(existing, incoming), 'field_activities');
      await setTable(tenantId, 'field_activities', finalMerged);
      pushed.field_activities = finalMerged.length;
    }
    if (Array.isArray(db.advances) && db.advances.length > 0) {
      const incoming = filterNotDeleted(db.advances, 'advances');
      const existing = await getTable(tenantId, 'advances');
      const finalMerged = filterNotDeleted(mergeById(existing, incoming), 'advances');
      await setTable(tenantId, 'advances', finalMerged);
      pushed.advances = finalMerged.length;
    }

    // ── TASKS
    if (db.tasks_list && Array.isArray(db.tasks_list)) {
      if (req.body.tasks_replace) {
        await setTable(tenantId, 'tasks', db.tasks_list);
        pushed.tasks = db.tasks_list.length;
      } else {
        const existing = await getTable(tenantId, 'tasks');
        const mergedTasks = existing.map(t => {
          const incoming = db.tasks_list.find(x => x.id === t.id);
          if (!incoming) return t;
          const wins = (incoming.updated_at || '') >= (t.updated_at || '');
          return { ...t, title: incoming.title || t.title, desc: incoming.desc || t.desc, assignee: incoming.assignee || t.assignee, priority: incoming.priority || t.priority, due: incoming.due || t.due, lot: incoming.lot || t.lot, status: wins ? incoming.status : t.status, completed_at: wins ? incoming.completed_at : t.completed_at, updated_at: wins ? incoming.updated_at : t.updated_at, comment: wins ? (incoming.comment || t.comment) : (t.comment || incoming.comment), comment_by: wins ? (incoming.comment_by || t.comment_by) : (t.comment_by || incoming.comment_by), comment_at: wins ? (incoming.comment_at || t.comment_at) : (t.comment_at || incoming.comment_at) };
        });
        db.tasks_list.forEach(t => { if (!existing.find(e => e.id === t.id)) mergedTasks.push(t); });
        await setTable(tenantId, 'tasks', mergedTasks);
        pushed.tasks = mergedTasks.length;
      }
    }

    // ── ANIMALS
    if (db.animals && !isField && typeof db.animals === 'object' && Object.keys(db.animals).length > 0) {
      await setTable(tenantId, 'animals', db.animals);
      pushed.animals = 'ok';
    }

    // Report params and diesel tank config (desktop only)
    if (db.report_params && !isField && typeof db.report_params === 'object') {
      await setTable(tenantId, 'report_params', db.report_params);
      pushed.report_params = 'ok';
    }
    if (db.estancia_params && typeof db.estancia_params === 'object' && Object.keys(db.estancia_params).length) {
      await setTable(tenantId, 'estancia_params', db.estancia_params);
      pushed.estancia_params = 'ok';
    }
    if (db.maquinaria && !isField) {
      await setTable(tenantId, 'maquinaria', db.maquinaria);
      pushed.maquinaria = 'ok';
    }
    if (db.pluvios_config && !isField) {
      await setTable(tenantId, 'pluvios_config', db.pluvios_config);
      pushed.pluvios_config = 'ok';
    }
    if (db.diesel_tank && !isField && typeof db.diesel_tank === 'object') {
      await setTable(tenantId, 'diesel_tank', db.diesel_tank);
      pushed.diesel_tank = 'ok';
    }

    res.json({ ok: true, pushed, tenant: req.tenant.name, timestamp: new Date().toISOString() });

    // Backup silencioso cada 6 horas
    setImmediate(async () => {
      try {
        const allTables = BACKUP_TABLES_FULL;  // v4.10.0: lista completa (antes omitía report_params y 8 tablas más)
        const snapshots = await getTable(tenantId, 'backup_snapshots');
        const last = snapshots[0];
        const hrs = last ? (Date.now() - new Date(last.created_at).getTime()) / 3600000 : 999;
        if (hrs > 6) {
          const snapshot = { timestamp: new Date().toISOString(), tenant: req.tenant.name, tables: {} };
          for (const t of allTables) { snapshot.tables[t] = await getTable(tenantId, t); }
          snapshots.unshift({ id: Date.now().toString(), created_at: new Date().toISOString(), size_kb: Math.round(JSON.stringify(snapshot).length / 1024), triggered_by: 'auto-push', data: snapshot });
          await setTable(tenantId, 'backup_snapshots', snapshots.slice(0, 30));
        }
      } catch(e) { console.error('[Backup] Error:', e.message); }
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Versions endpoint (público, sin auth) ─────────────────────
// Cualquier cliente puede chequear si su versión está obsoleta sin necesitar token válido.
app.get('/api/versions', (req, res) => {
  res.json({
    pwa_latest: PWA_VERSION,
    desktop_min: DESKTOP_MIN_VERSION,
    desktop_latest: DESKTOP_LATEST_VERSION,
    server_now: new Date().toISOString()
  });
});

// ── Last modified timestamp del tenant (para optimistic concurrency) ──
// Devuelve el timestamp del último cambio en cualquier tabla del tenant.
// Lo usa el cliente para saber si el server tiene cambios más nuevos que su última sync.
app.get('/api/last-modified', auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    // Excluir tablas de meta/log que no representan cambios "reales" del usuario
    const result = await pool.query(
      `SELECT MAX(updated_at) AS last_modified, COUNT(*) AS table_count
       FROM store
       WHERE tenant_id = $1
         AND key NOT IN ('audit_logs', 'backup_snapshots', 'transaction_images', 'bot_session', 'sync_metadata')`,
      [tenantId]
    );
    const row = result.rows[0] || {};
    res.json({
      last_modified: row.last_modified ? new Date(row.last_modified).toISOString() : null,
      tables_count: parseInt(row.table_count || 0),
      server_now: new Date().toISOString()
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Full DB pull ──────────────────────────────────────────────
app.get('/api/sync-pull', auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const [lots, products, treatments, health_alerts, sales, purchases,
           employees, field_activities, tasks, pesajes, advances, maintenance,
           agua, sal, conteo, partos, alimento, animals, animal_movements,
           lluvias, diesel, aceite, cuentas, kardex, historial_sueldos, compras_ganado,
           bajas, maquinaria, rotation_history, pasture_evals, reproductive_services] = await Promise.all([
      getTable(tenantId,'lots'), getTable(tenantId,'vet_products'), getTable(tenantId,'treatments'),
      getTable(tenantId,'health_alerts'), getTable(tenantId,'sales'), getTable(tenantId,'purchases'),
      getTable(tenantId,'employees'), getTable(tenantId,'field_activities'), getTable(tenantId,'tasks'),
      getTable(tenantId,'pesajes'), getTable(tenantId,'advances'), getTable(tenantId,'maintenance'),
      getTable(tenantId,'agua'), getTable(tenantId,'sal'), getTable(tenantId,'conteo'),
      getTable(tenantId,'partos'), getTable(tenantId,'alimento'), getTable(tenantId,'animals'),
      getTable(tenantId,'animal_movements'), getTable(tenantId,'lluvias'), getTable(tenantId,'diesel'),
      getTable(tenantId,'aceite'), getTable(tenantId,'cuentas'), getTable(tenantId,'kardex'),
      getTable(tenantId,'historial_sueldos'), getTable(tenantId,'compras_ganado'),
      getTable(tenantId,'bajas'), getTable(tenantId,'maquinaria'),
      getTable(tenantId,'rotation_history'),
      getTable(tenantId,'pasture_evals'),
      getTable(tenantId,'reproductive_services'),
    ]);

    // _deleted_ids: lista de "table:id" borrados, sincronizada entre Desktop/PWA/bot
    const _deletedIdsForFilter = await getTable(tenantId, '_deleted_ids');
    const _deletedMapForFilter = (_deletedIdsForFilter && typeof _deletedIdsForFilter === 'object' && !Array.isArray(_deletedIdsForFilter)) ? _deletedIdsForFilter : {};

    // v4.3.9: query param ?include_sold=true permite recibir lotes vendidos
    // (default false para retrocompatibilidad con clientes existentes)
    const includeSold = req.query.include_sold === 'true' || req.query.include_sold === '1';

    const validLots = lots.filter(l => {
      const status = (l.status || '').toLowerCase();
      if ((status === 'sold' || status === 'vendido') && !includeSold) return false;
      if (status === 'active' && (!l.animal_count || l.animal_count === 0)) return false;
      // FIX: respetar deleted_ids — no devolver lotes marcados como borrados
      if (l && l.id != null && _deletedMapForFilter['lots:' + String(l.id)]) return false;
      return true;
    }).map(l => {
      // FIX continuidad: reconciliar animal_count desde animals[code] al servir.
      // Si el contador es menor que la cantidad real de animales, devolver el real.
      // Esto sana datos viejos sin requerir migración explícita.
      const status = (l.status || '').toLowerCase();
      if (status === 'sold' || status === 'vendido') return l;
      const realCount = (animals && animals[l.code]) ? animals[l.code].length : 0;
      if (realCount > 0 && (l.animal_count || 0) < realCount) {
        return { ...l, animal_count: realCount };
      }
      return l;
    });

    const branding = await getTable(tenantId, 'branding');
    const report_params = await getTable(tenantId, 'report_params');
    const diesel_tank = await getTable(tenantId, 'diesel_tank');
    const pluvios_config = await getTable(tenantId, 'pluvios_config');
    const estancia_params = await getTable(tenantId, 'estancia_params');
    const inventory_counts = await getTable(tenantId, 'inventory_counts');
    // _deleted_ids: lista de "table:id" borrados, sincronizada entre Desktop/PWA/bot
    const deletedIdsRaw = await getTable(tenantId, '_deleted_ids');
    const deleted_ids = (deletedIdsRaw && typeof deletedIdsRaw === 'object' && !Array.isArray(deletedIdsRaw)) ? deletedIdsRaw : {};

    // FIX: filtrar pasture_evals borradas (igual que se hace con lots)
    const filteredPastureEvals = (pasture_evals || []).filter(ev => {
      if (!ev || ev.id == null) return true;
      if (deleted_ids['pasture_evals:' + String(ev.id)]) return false;
      return true;
    });

    // Calcular last_modified del tenant para optimistic concurrency
    let lastModified = null;
    try {
      const lmResult = await pool.query(
        `SELECT MAX(updated_at) AS last_modified FROM store
         WHERE tenant_id = $1
           AND key NOT IN ('audit_logs', 'backup_snapshots', 'transaction_images', 'bot_session', 'sync_metadata')`,
        [tenantId]
      );
      if (lmResult.rows[0] && lmResult.rows[0].last_modified) {
        lastModified = new Date(lmResult.rows[0].last_modified).toISOString();
      }
    } catch(e) { /* no romper sync-pull si falla */ }

    res.json({
      lots: validLots, products, treatments, health_alerts, sales, purchases,
      employees, field_activities, tasks, pesajes, advances, maintenance,
      agua, sal, conteo, partos, alimento, animals, animal_movements,
      lluvias, diesel, aceite, cuentas, kardex, historial_sueldos, compras_ganado, bajas, maquinaria,
      rotation_history: rotation_history || [],
      pasture_evals: filteredPastureEvals,
      reproductive_services: Array.isArray(reproductive_services) ? reproductive_services : [],
      inventory_counts: Array.isArray(inventory_counts) ? inventory_counts : [],
      branding: Array.isArray(branding) ? {} : (branding || {}),
      report_params: Array.isArray(report_params) ? {} : (report_params || {}),
      diesel_tank: diesel_tank || [],
      estancia_params: estancia_params || {},
      pluvios_config: Array.isArray(pluvios_config) ? pluvios_config : [],
      deleted_ids: deleted_ids,
      pwa_latest_version: PWA_VERSION,
      desktop_min_version: DESKTOP_MIN_VERSION,
      desktop_latest_version: DESKTOP_LATEST_VERSION,
      last_modified: lastModified,
      timestamp: new Date().toISOString(),
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});


// ── Market prices search (Gemini + Google Search) ─────────────
app.post('/api/market-prices-search', auth, async (req, res) => {
  try {
    const rp_config = await getTable(req.tenantId, 'report_params') || {};
    const GEMINI_KEY = SG_GEMINI_KEY;
    const prompt = 'Busca los precios ACTUALES de ganado bovino en Santa Cruz, Bolivia. ' +
      'Incluye: 1) Precio de ganado en pie (Bs/kg) para novillo, vaca y ternero, ' +
      '2) Precio de carne de gancho en frigorifico (Bs/kg), ' +
      '3) Precio al consumidor de carne bovina (Bs/kg) en mercados de Santa Cruz. ' +
      'Fuentes: FEGASACRUZ remates El Marucho y FERCOGAN, SIIP (siip.produccion.gob.bo), frigorifico Guaracachi, SOFRAPIG, FEGABENI. ' +
      'Menciona la tendencia (subiendo/bajando/estable) y factores relevantes (escasez, exportacion, sequia, dolar). ' +
      'Responde en espanol, formato conciso con numeros claros. Maximo 250 palabras.';

    let text = 'No se encontraron resultados.';
    let sources = [];

    // Try with google_search first
    let geminiData = null;
    try {
      const res1 = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          contents: [{parts:[{text: prompt}]}],
          generationConfig: {maxOutputTokens: 1024, temperature: 0.3},
          tools: [{google_search: {}}]
        })
      });
      geminiData = await res1.json();
      console.log('[Prices] Gemini+Search status:', res1.status);
      if (geminiData.error) {
        console.log('[Prices] Gemini+Search error:', geminiData.error.message);
        geminiData = null;
      }
    } catch(e) {
      console.log('[Prices] Gemini+Search failed:', e.message);
    }

    // Fallback: without google_search
    if (!geminiData || !geminiData.candidates) {
      try {
        const res2 = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({
            contents: [{parts:[{text: prompt}]}],
            generationConfig: {maxOutputTokens: 1024, temperature: 0.3}
          })
        });
        geminiData = await res2.json();
        console.log('[Prices] Gemini fallback status:', res2.status);
      } catch(e) {
        console.log('[Prices] Gemini fallback failed:', e.message);
      }
    }

    // Extract text from all parts
    if (geminiData && geminiData.candidates && geminiData.candidates[0]) {
      const parts = geminiData.candidates[0].content.parts || [];
      text = parts.filter(p => p.text).map(p => p.text).join('\n');
    }
    // Extract grounding sources
    try {
      const ground = geminiData.candidates[0].groundingMetadata;
      if (ground && ground.groundingChunks) {
        sources = ground.groundingChunks.filter(c => c.web).map(c => ({title: c.web.title || '', url: c.web.uri || ''}));
      }
    } catch(e) {}

    // Cache
    await setTable(req.tenantId, 'market_prices_cache', { text, sources, timestamp: new Date().toISOString() });
    res.json({ok: true, text, sources, timestamp: new Date().toISOString()});
  } catch(e) {
    // Try cache
    try {
      const cached = await getTable(req.tenantId, 'market_prices_cache');
      if (cached && cached.text) {
        return res.json({ok: true, text: cached.text + '\n\n(Cache de ' + (cached.timestamp || '?') + ')', sources: cached.sources || [], cached: true});
      }
    } catch(e2) {}
    res.status(500).json({error: e.message});
  }
});


// ── Reproducción: Asistente IA conversacional (Gemini) ────────
// v4.7.0: el cliente envía una pregunta + un dump compacto del estado reproductivo del rebaño.
// El server arma el prompt, llama a Gemini y devuelve la respuesta en español.
//
// Body: {
//   question: string,
//   context: {
//     servicios: [{date, animal_id, tipo_servicio, semen_lote, toro_id, technician, lot_code,
//                  result, diagnosis_method, diagnosis_date}],
//     partos:    [{date, madre_id, padre_id, sexo, peso, estado, cria_id, lot_code, servicio_id}],
//     lots:      [{code, paddock, animal_count, status}],
//     objetivos: {prenez_pct, iep_dias, sc_max, paricion_pct},
//     resumen:   {prenez_pct, iep, sc, paricion_pct, total_servicios, total_partos, vacas_prenadas}
//   }
// }
// Returns: { answer: string, model: string, ms: number }
app.post('/api/repro-asistente', auth, async (req, res) => {
  const t0 = Date.now();
  try {
    if (!SG_GEMINI_KEY) {
      return res.status(503).json({ error: 'Gemini no configurado en el server (SG_GEMINI_KEY ausente)' });
    }
    const { question, context } = req.body || {};
    if (!question || typeof question !== 'string' || question.trim().length < 3) {
      return res.status(400).json({ error: 'Falta pregunta o es muy corta' });
    }
    if (question.length > 2000) {
      return res.status(400).json({ error: 'Pregunta demasiado larga (máx 2000 caracteres)' });
    }
    if (!context || typeof context !== 'object') {
      return res.status(400).json({ error: 'Falta context con servicios/partos/lots' });
    }

    // Tamaños sanos: si vienen MUY grandes, recortar para no explotar tokens
    const servicios = Array.isArray(context.servicios) ? context.servicios.slice(-400) : [];
    const partos = Array.isArray(context.partos) ? context.partos.slice(-400) : [];
    const lots = Array.isArray(context.lots) ? context.lots.slice(0, 50) : [];
    const objetivos = context.objetivos || {};
    const resumen = context.resumen || {};

    // Sanitización ligera del input del usuario (defensa básica contra prompt injection)
    const cleanQ = String(question).replace(/```/g, "'''").trim();

    const systemPrompt =
      'Sos un asistente experto en reproducción bovina para EstanciaPro, un sistema de gestión ganadera en Bolivia. ' +
      'Respondé SIEMPRE en español rioplatense, conciso (máximo 300 palabras), con bullets si hay más de 3 puntos. ' +
      'Usá SOLO los datos provistos en el contexto JSON. Si la respuesta requiere datos que NO están en el contexto, decilo explícitamente — NO inventés.\n\n' +
      'Convenciones del sistema:\n' +
      '- tipo_servicio: "IA" (inseminación artificial) o "monta" (toro suelto).\n' +
      '- result: "preñada", "vacia", o "pendiente" (sin diagnóstico aún).\n' +
      '- diagnosis_method: "tacto" (rectal), "eco" (ecografía), o "retorno_celo".\n' +
      '- estado parto: "sano", "debil", "muerto" (mortinato).\n' +
      '- Gestación bovina ≈ 280 días desde el servicio efectivo.\n' +
      '- IEP = intervalo entre partos consecutivos de la misma vaca, objetivo típico ≤ 380d.\n' +
      '- S/C = servicios totales / vacas únicas preñadas (objetivo ≤ 1.5 en cabaña, ≤ 2 en cría extensiva).\n' +
      '- Tasa de preñez en Bolivia cría extensiva típica: 55-70%.\n\n' +
      'Estilo de respuestas:\n' +
      '- Empezá con la respuesta directa, no con preámbulos.\n' +
      '- Si detectás un patrón problemático (ej. un toro/pajuela con tasa <40%), señalalo.\n' +
      '- Cuando recomendés acción (descarte, re-servicio, IATF), justificá con los números del contexto.\n' +
      '- Fechas siempre en formato YYYY-MM-DD.\n' +
      '- No uses emojis salvo que el usuario los use primero.\n\n' +
      'Hoy es: ' + new Date().toISOString().slice(0, 10) + '\n\n' +
      'CONTEXTO REPRODUCTIVO ACTUAL (JSON):\n' +
      JSON.stringify({
        resumen: resumen,
        objetivos: objetivos,
        servicios_recientes: servicios,
        partos_recientes: partos,
        lotes_activos: lots
      });

    const userPrompt = 'Pregunta del ganadero: ' + cleanQ;

    let geminiResp = null;
    let lastError = null;
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + SG_GEMINI_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.2 }
        })
      });
      geminiResp = await r.json();
      if (geminiResp && geminiResp.error) {
        lastError = geminiResp.error.message || 'Gemini error';
        console.warn('[repro-asistente] Gemini error:', lastError);
        geminiResp = null;
      }
    } catch(e) {
      lastError = e.message;
      console.error('[repro-asistente] fetch fail:', e.message);
    }

    let answer = '';
    if (geminiResp && geminiResp.candidates && geminiResp.candidates[0]) {
      const cand = geminiResp.candidates[0];
      if (cand.content && Array.isArray(cand.content.parts)) {
        answer = cand.content.parts.map(p => p.text || '').join('').trim();
      }
    }

    if (!answer) {
      return res.status(502).json({
        error: 'El asistente no devolvió respuesta',
        detail: lastError || 'sin texto en la respuesta de Gemini'
      });
    }

    return res.json({
      answer: answer,
      model: 'gemini-2.5-flash',
      ms: Date.now() - t0,
      context_size: {
        servicios: servicios.length,
        partos: partos.length,
        lots: lots.length
      }
    });
  } catch(e) {
    console.error('[repro-asistente] error:', e.message);
    return res.status(500).json({ error: e.message, ms: Date.now() - t0 });
  }
});


// ── SESIONES SIMULTÁNEAS (ping / presencia) v4.8.0 ────────────────
// Detecta cuántos dispositivos están activos por tenant, para alertar
// cuando hay más de una sesión editando al mismo tiempo.
// Modelo: store key '_sessions' = { device_id: { label, platform, last_seen } }
// "Activo" = last_seen dentro de los últimos SESSION_TTL_MS.
const SESSION_TTL_MS = 2 * 60 * 1000; // 2 minutos

// POST /api/ping — el dispositivo reporta que sigue activo
// Body: { device_id, label, platform }
app.post('/api/ping', auth, async (req, res) => {
  try {
    const { device_id, label, platform } = req.body || {};
    if (!device_id || typeof device_id !== 'string') {
      return res.status(400).json({ error: 'device_id requerido' });
    }
    // Leer sesiones actuales (objeto, no array)
    let sessions = await getTable(req.tenantId, '_sessions');
    if (Array.isArray(sessions) || !sessions || typeof sessions !== 'object') sessions = {};

    const nowIso = new Date().toISOString();
    sessions[device_id] = {
      label: (label || 'Dispositivo').toString().slice(0, 80),
      platform: (platform || '').toString().slice(0, 20),
      last_seen: nowIso
    };

    // Limpieza: descartar sesiones viejas (más de 10 min) para que no crezca infinito
    const cutoff = Date.now() - 10 * 60 * 1000;
    Object.keys(sessions).forEach(function(did) {
      const ls = new Date(sessions[did].last_seen || 0).getTime();
      if (ls < cutoff) delete sessions[did];
    });

    await setTable(req.tenantId, '_sessions', sessions);

    // Devolver las sesiones activas (sin la propia) para que el cliente decida si alertar
    const activeCutoff = Date.now() - SESSION_TTL_MS;
    const others = Object.keys(sessions)
      .filter(function(did) { return did !== device_id; })
      .map(function(did) { return { device_id: did, label: sessions[did].label, platform: sessions[did].platform, last_seen: sessions[did].last_seen }; })
      .filter(function(s) { return new Date(s.last_seen).getTime() >= activeCutoff; });

    return res.json({ ok: true, others: others, others_count: others.length });
  } catch (e) {
    console.error('[ping] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/active-sessions — lista de dispositivos activos del tenant
app.get('/api/active-sessions', auth, async (req, res) => {
  try {
    let sessions = await getTable(req.tenantId, '_sessions');
    if (Array.isArray(sessions) || !sessions || typeof sessions !== 'object') sessions = {};
    const activeCutoff = Date.now() - SESSION_TTL_MS;
    const active = Object.keys(sessions)
      .map(function(did) { return { device_id: did, label: sessions[did].label, platform: sessions[did].platform, last_seen: sessions[did].last_seen }; })
      .filter(function(s) { return new Date(s.last_seen).getTime() >= activeCutoff; });
    return res.json({ sessions: active, count: active.length });
  } catch (e) {
    console.error('[active-sessions] error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});


// Permite al bot WhatsApp responder preguntas sobre los datos del tenant.
// Body: { question: string }
// Returns: { answer: string, data: object }
app.post('/api/bot/context-query', auth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question || typeof question !== 'string') {
      return res.status(400).json({ error: 'question requerido' });
    }
    // Tenant viene del auth middleware (req.tenantId)
    const tenantId = req.tenantId;

    // 1) Cargar todos los datos relevantes del tenant en paralelo
    const [
      lots, sales, purchases, products, employees, treatments,
      pesajes, maintenance, aceite, diesel, sal, alimento, agua,
      partos, conteo, bajas, lluvias, pasture_evals, compras_ganado,
      cuentas, advances, kardex, maquinaria
    ] = await Promise.all([
      getTable(tenantId, 'lots'),
      getTable(tenantId, 'sales'),
      getTable(tenantId, 'purchases'),
      getTable(tenantId, 'vet_products'),
      getTable(tenantId, 'employees'),
      getTable(tenantId, 'treatments'),
      getTable(tenantId, 'pesajes'),
      getTable(tenantId, 'maintenance'),
      getTable(tenantId, 'aceite'),
      getTable(tenantId, 'diesel'),
      getTable(tenantId, 'sal'),
      getTable(tenantId, 'alimento'),
      getTable(tenantId, 'agua'),
      getTable(tenantId, 'partos'),
      getTable(tenantId, 'conteo'),
      getTable(tenantId, 'bajas'),
      getTable(tenantId, 'lluvias'),
      getTable(tenantId, 'pasture_evals'),
      getTable(tenantId, 'compras_ganado'),
      getTable(tenantId, 'cuentas'),
      getTable(tenantId, 'advances'),
      getTable(tenantId, 'kardex'),
      getTable(tenantId, 'maquinaria'),
    ]);

    // 2) Construir un resumen compacto del estado actual de la estancia
    // (mantener bajo 30K tokens — Gemini 2.5 Flash maneja 1M pero queremos eficiencia)
    const summary = _buildEstanciaContext({
      lots: lots || [],
      sales: sales || [],
      purchases: purchases || [],
      products: products || [],
      employees: employees || [],
      treatments: treatments || [],
      pesajes: pesajes || [],
      maintenance: maintenance || [],
      aceite: aceite || [],
      diesel: diesel || [],
      sal: sal || [],
      alimento: alimento || [],
      agua: agua || [],
      partos: partos || [],
      conteo: conteo || [],
      bajas: bajas || [],
      lluvias: lluvias || [],
      pasture_evals: pasture_evals || [],
      compras_ganado: compras_ganado || [],
      cuentas: cuentas || [],
      advances: advances || [],
      kardex: kardex || [],
      maquinaria: maquinaria || [],
    });

    // 3) Llamar Gemini con el contexto + pregunta
    const rp_config = await getTable(tenantId, 'report_params') || {};
    const GEMINI_KEY = SG_GEMINI_KEY;
    if (!GEMINI_KEY) {
      return res.status(500).json({ error: 'Gemini key no configurada' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const prompt = `Sos un asistente de gestión ganadera para una estancia en Beni, Bolivia.
Hoy es ${today}. La moneda es Boliviano (Bs).

CONTEXTO DE LA ESTANCIA:
${summary}

PREGUNTA DEL USUARIO:
${question}

INSTRUCCIONES:
- Respondé en español boliviano, conciso (máximo 4 oraciones para WhatsApp).
- Si la pregunta tiene respuesta clara en los datos, dala con números concretos.
- Si la pregunta requiere cálculos, hacelos con los datos disponibles.
- Si no hay datos suficientes, decilo honestamente. NO INVENTES datos.
- Si te piden algo fuera del alcance ganadero, redirigí amablemente.
- Usá emojis ocasionalmente (🐄 🌿 💰 ⚠️).
- NO uses markdown como **negrita** o tablas — WhatsApp no lo renderiza bien.
- Para listas, usá guiones simples.
- Respondé directamente, sin preámbulos como "Claro" o "Por supuesto".`;

    const geminiResp = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.3,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );
    const geminiData = await geminiResp.json();

    let answer = '';
    let finishReason = '';
    try {
      const cand = geminiData.candidates && geminiData.candidates[0];
      if (cand) {
        finishReason = cand.finishReason || '';
        if (cand.content && cand.content.parts) {
          answer = cand.content.parts.map(p => p.text || '').join('');
        }
      }
    } catch (e) {}

    if (!answer) {
      console.log('[BotQuery] Sin respuesta. finishReason:', finishReason, 'data:', JSON.stringify(geminiData).slice(0, 500));
      return res.json({
        answer: 'No pude procesar la pregunta en este momento. Intentá de nuevo en unos segundos.',
        error: finishReason || 'no_response'
      });
    }

    res.json({
      answer: answer.trim(),
      tenant: tenantId,
      timestamp: new Date().toISOString()
    });
  } catch (e) {
    console.error('[BotQuery] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Construye un resumen ejecutivo compacto del estado de la estancia
// para inyectar como contexto en Gemini
function _buildEstanciaContext(d) {
  const lines = [];
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthAgoStr = monthAgo.toISOString().slice(0, 10);

  // ── LOTES Y RODEO ──
  const activeLots = (d.lots || []).filter(l => {
    const s = (l.status || '').toLowerCase();
    return s !== 'sold' && s !== 'vendido' && (l.animal_count || 0) > 0;
  });
  const totalAnimales = activeLots.reduce((s, l) => s + (l.animal_count || 0), 0);
  lines.push(`=== RODEO ===`);
  lines.push(`Total cabezas: ${totalAnimales}`);
  lines.push(`Lotes activos: ${activeLots.length}`);
  activeLots.forEach(l => {
    lines.push(`  - ${l.code}: ${l.animal_count} cab, ${l.category || '?'}, raza ${l.breed || '?'}, potrero ${l.paddock || '-'}, peso prom ${l.avg_weight || '?'} kg`);
  });

  // ── STOCK ──
  const stock = (d.products || []).filter(p => (p.stock_qty || 0) > 0);
  if (stock.length) {
    lines.push(`\n=== STOCK / INVENTARIO ===`);
    stock.slice(0, 30).forEach(p => {
      const lowStock = (p.stock_qty || 0) <= (p.stock_min || 0) ? ' ⚠️BAJO' : '';
      lines.push(`  - ${p.name}: ${p.stock_qty} ${p.unit || ''} (mín: ${p.stock_min || 0})${lowStock}`);
    });
  }

  // ── PERSONAL ──
  const empActivos = (d.employees || []).filter(e => e.active !== false);
  if (empActivos.length) {
    lines.push(`\n=== PERSONAL ACTIVO ===`);
    empActivos.forEach(e => {
      lines.push(`  - ${e.name}${e.role ? ' (' + e.role + ')' : ''}${e.salary ? ', sueldo Bs ' + e.salary : ''}`);
    });
  }

  // ── VENTAS ÚLTIMOS 30 DÍAS ──
  const recentSales = (d.sales || []).filter(s => (s.date || '') >= monthAgoStr);
  if (recentSales.length) {
    lines.push(`\n=== VENTAS ÚLTIMOS 30 DÍAS ===`);
    const totalVentas = recentSales.reduce((s, v) => s + (v.total || 0), 0);
    const totalKg = recentSales.reduce((s, v) => s + (v.kg || 0), 0);
    const totalCab = recentSales.reduce((s, v) => s + (v.animals || 0), 0);
    lines.push(`Total: ${recentSales.length} ventas, ${totalCab} cabezas, ${totalKg} kg, Bs ${Math.round(totalVentas).toLocaleString()}`);
    recentSales.slice(0, 5).forEach(v => {
      const lots = v.lot_codes && v.lot_codes.length > 1 ? v.lot_codes.join(',') : (v.lot_code || '?');
      lines.push(`  - ${v.date}: Lote ${lots}, ${v.animals || 0} cab, Bs ${(v.total || 0).toLocaleString()} (${v.buyer || '?'})`);
    });
  }

  // ── COMPRAS ÚLTIMOS 30 DÍAS ──
  const recentPur = (d.purchases || []).filter(p => (p.date || p.created_at || '').slice(0, 10) >= monthAgoStr);
  if (recentPur.length) {
    lines.push(`\n=== COMPRAS ÚLTIMOS 30 DÍAS ===`);
    const totalGastos = recentPur.reduce((s, p) => s + (p.total || 0), 0);
    lines.push(`Total: ${recentPur.length} compras, Bs ${Math.round(totalGastos).toLocaleString()}`);
    recentPur.slice(0, 8).forEach(p => {
      lines.push(`  - ${(p.date || '').slice(0, 10)}: ${p.desc || '?'} Bs ${(p.total || 0).toLocaleString()}${p.supplier ? ' (' + p.supplier + ')' : ''}`);
    });
  }

  // ── COMPRAS DE GANADO ÚLTIMOS 30 DÍAS ──
  const recentCG = (d.compras_ganado || []).filter(c => (c.fecha || '') >= monthAgoStr);
  if (recentCG.length) {
    lines.push(`\n=== COMPRAS DE GANADO ÚLTIMOS 30 DÍAS ===`);
    recentCG.slice(0, 5).forEach(c => {
      lines.push(`  - ${c.fecha}: ${c.animal_count || 0} cab de ${c.proveedor || '?'} → Lote ${c.lot_code || '?'}, Bs ${(c.total || 0).toLocaleString()}`);
    });
  }

  // ── SANIDAD ÚLTIMOS 30 DÍAS ──
  const recentTreat = (d.treatments || []).filter(t => (t.applied_at || t.date || '') >= monthAgoStr);
  if (recentTreat.length) {
    lines.push(`\n=== CURACIONES ÚLTIMOS 30 DÍAS (${recentTreat.length}) ===`);
    recentTreat.slice(0, 5).forEach(t => {
      lines.push(`  - ${(t.applied_at || '').slice(0, 10)}: ${t.product_name || '?'} en Lote ${t.lot_code || '?'} (${t.count || 0} animales)${t.diagnosis ? ' - ' + t.diagnosis : ''}`);
    });
  }

  // ── BAJAS ÚLTIMOS 30 DÍAS ──
  const recentBajas = (d.bajas || []).filter(b => (b.fecha || '') >= monthAgoStr);
  if (recentBajas.length) {
    lines.push(`\n=== BAJAS ÚLTIMOS 30 DÍAS ===`);
    recentBajas.forEach(b => {
      lines.push(`  - ${b.fecha}: Animal ${b.animal_id || '?'} (Lote ${b.lot_code || '?'}) - ${b.causa || '?'}`);
    });
  }

  // ── PARTOS ÚLTIMOS 30 DÍAS ──
  const recentPart = (d.partos || []).filter(p => (p.date || p.fecha || '') >= monthAgoStr);
  if (recentPart.length) {
    lines.push(`\n=== PARTOS ÚLTIMOS 30 DÍAS (${recentPart.length}) ===`);
    const machos = recentPart.filter(p => p.sexo === 'macho').length;
    const hembras = recentPart.filter(p => p.sexo === 'hembra').length;
    const muertos = recentPart.filter(p => p.estado === 'muerto').length;
    lines.push(`  Machos: ${machos}, Hembras: ${hembras}, Mortinatos: ${muertos}`);
  }

  // ── PESAJES RECIENTES (último por lote) ──
  if ((d.pesajes || []).length) {
    lines.push(`\n=== ÚLTIMO PESAJE POR LOTE ===`);
    const lastByLot = {};
    (d.pesajes || []).forEach(p => {
      const lc = p.lot_code;
      if (!lc) return;
      if (!lastByLot[lc] || (p.date || '') > (lastByLot[lc].date || '')) {
        lastByLot[lc] = p;
      }
    });
    Object.keys(lastByLot).slice(0, 10).forEach(lc => {
      const p = lastByLot[lc];
      lines.push(`  - ${lc}: ${p.date} - ${p.avg_weight || p.peso || '?'} kg promedio (${p.animal_count || 1} animales)`);
    });
  }

  // ── EVALUACIONES DE PASTO RECIENTES ──
  const recentEval = (d.pasture_evals || []).filter(e => (e.evaluated_at || e.date || '') >= monthAgoStr);
  if (recentEval.length) {
    lines.push(`\n=== EVALUACIONES DE PASTO ÚLTIMOS 30 DÍAS ===`);
    recentEval.slice(0, 5).forEach(e => {
      const r = String(e.result || '').match(/ESTADO[:\s]+([^\n]{1,40})/i);
      const estado = r ? r[1].trim() : '?';
      lines.push(`  - ${(e.evaluated_at || e.date || '').slice(0, 10)}: ${e.potrero || '?'}${e.lot_code ? ' (Lote ' + e.lot_code + ')' : ''} - ${estado}`);
    });
  }

  // ── COMBUSTIBLE ÚLTIMOS 30 DÍAS ──
  const recentDiesel = (d.diesel || []).filter(x => (x.fecha || '') >= monthAgoStr);
  if (recentDiesel.length) {
    const recargas = recentDiesel.filter(x => x.type === 'recarga');
    const despachos = recentDiesel.filter(x => x.type === 'despacho');
    const ajustes = recentDiesel.filter(x => x.type === 'ajuste');
    const litrosDespacho = despachos.reduce((s, x) => s + (parseFloat(x.litros) || 0), 0);
    const litrosRecarga = recargas.reduce((s, x) => s + (parseFloat(x.litros) || 0), 0);
    lines.push(`\n=== COMBUSTIBLE ÚLTIMOS 30 DÍAS ===`);
    lines.push(`  Recargas: ${litrosRecarga.toFixed(0)} L | Despachos: ${litrosDespacho.toFixed(0)} L | Ajustes: ${ajustes.length}`);
  }

  // ── LLUVIAS ÚLTIMOS 30 DÍAS ──
  const recentRain = (d.lluvias || []).filter(l => (l.fecha || '') >= monthAgoStr);
  if (recentRain.length) {
    const totalMm = recentRain.reduce((s, l) => s + (parseFloat(l.campamento_mm || l.mm || 0)), 0);
    lines.push(`\n=== LLUVIAS ÚLTIMOS 30 DÍAS ===`);
    lines.push(`  Total: ${totalMm.toFixed(0)} mm en ${recentRain.length} días`);
  }

  // ── MANTENIMIENTO PENDIENTE ──
  const mntPendientes = (d.maintenance || []).filter(m => (m.status || '').toLowerCase() === 'pendiente');
  if (mntPendientes.length) {
    lines.push(`\n=== MANTENIMIENTO PENDIENTE (${mntPendientes.length}) ===`);
    mntPendientes.slice(0, 5).forEach(m => {
      lines.push(`  - ${m.desc || '?'}${m.equipo ? ' (' + m.equipo + ')' : ''}${m.cost ? ' ~Bs ' + m.cost : ''}`);
    });
  }

  // ── ROTACIÓN: días en potrero actual por lote ──
  if (activeLots.length && (d.pasture_evals || []).length) {
    lines.push(`\n=== ROTACIÓN ===`);
    activeLots.forEach(l => {
      if (!l.paddock) return;
      // Última evaluación del potrero del lote
      const lastEval = (d.pasture_evals || [])
        .filter(e => e.potrero === l.paddock)
        .sort((a, b) => (b.evaluated_at || '').localeCompare(a.evaluated_at || ''))[0];
      if (lastEval) {
        const days = Math.floor((today - new Date(lastEval.evaluated_at || lastEval.date)) / (24 * 60 * 60 * 1000));
        lines.push(`  - ${l.code} en ${l.paddock}: hace ~${days} días`);
      }
    });
  }

  return lines.join('\n');
}


// ── Pasture evaluation (Gemini Vision) ─────────────
app.post('/api/pasture-eval', auth, async (req, res) => {
  try {
    const { potrero, lot_code, base64, date, by } = req.body;
    if (!base64) return res.status(400).json({error: 'base64 image required'});
    
    const rp_config = await getTable(req.tenantId, 'report_params') || {};
    const GEMINI_KEY = SG_GEMINI_KEY;
    
    // Get lot info for context
    let context = '';
    try {
      const lots = await getTable(req.tenantId, 'lots');
      const lot = lots.find(l => l.code === lot_code);
      if (lot) context = 'Lote: '+lot.code+', Potrero: '+(lot.paddock||potrero||'?')+', Cabezas: '+(lot.animal_count||0)+'. ';
    } catch(e) {}

    // Prompt diseñado para maximizar saltos de línea (Gemini a veces los omite)
    // y aplanar respuesta en una sola línea — usar bullets y demarcadores claros.
    const prompt = 'Eres un agronomo/zootecnista experto en pasturas tropicales del oriente boliviano (Chiquitania). ' +
      'Analiza esta foto de un potrero/pastizal y responde EXACTAMENTE en este formato. ' +
      'Cada campo en su PROPIA LÍNEA, separadas por saltos de línea reales. ' +
      'NO concatenes los campos en una sola línea. NO uses tablas. NO uses código markdown.\n\n' +
      'ESPECIE: <nombre de la especie>\n' +
      'ALTURA: <altura en cm>\n' +
      'COBERTURA: <porcentaje 0-100>\n' +
      'ESTADO: <Excelente|Bueno|Regular|Degradado|Critico>\n' +
      'NDVI_EST: <0.0-1.0>\n' +
      'CARGA: <UA/ha>\n' +
      'APTO: <Si|No>\n' +
      'DESCANSO: <dias necesarios o No>\n' +
      'ROTAR: <Si|No>\n' +
      'ALERTA: <texto breve o Ninguna>\n' +
      'RESUMEN: <una linea de recomendacion>\n\n' +
      context;

    const geminiRes = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        contents: [{parts: [
          {inline_data: {mime_type: 'image/jpeg', data: base64}},
          {text: prompt}
        ]}],
        generationConfig: {maxOutputTokens: 2048, temperature: 0.2, topP: 0.8}
      })
    });
    const geminiData = await geminiRes.json();

    let evalText = '';
    try { evalText = geminiData.candidates[0].content.parts[0].text; } catch(e) {
      return res.status(500).json({error: 'Gemini no pudo analizar la imagen', details: geminiData?.error || null});
    }

    // ── NORMALIZACIÓN: si Gemini devolvió todo en una línea, reinsertar saltos ──
    // Detecta KEYs conocidas y agrega \n antes de cada una
    const KEY_PATTERN = /\b(ESPECIE|ALTURA|COBERTURA|ESTADO|NDVI_EST|NDVI|CARGA|APTO|DESCANSO|ROTAR|ALERTA|RESUMEN)(?=\s*:)/g;
    if (!evalText.includes('\n') || (evalText.match(KEY_PATTERN) || []).length > evalText.split('\n').length) {
      evalText = evalText.replace(KEY_PATTERN, '\n$1').replace(/^\n+/, '').trim();
    }

    // Parse structured response
    const parsed = {};
    const fieldMap = {ESPECIE:'especie',ALTURA:'altura',COBERTURA:'cobertura',ESTADO:'estado',NDVI_EST:'ndvi',NDVI:'ndvi',CARGA:'carga',APTO:'apto',DESCANSO:'descanso',ROTAR:'rotar',ALERTA:'alerta',RESUMEN:'resumen'};
    evalText.split('\n').forEach(line => {
      const idx = line.indexOf(':');
      if (idx < 0) return;
      const k = line.substring(0, idx).trim().toUpperCase().replace(/^\*+|\*+$/g,'').trim();
      const v = line.substring(idx + 1).trim().replace(/^\*+|\*+$/g,'').trim();
      if (fieldMap[k] && v) parsed[fieldMap[k]] = v;
    });

    const evalRecord = {
      id: 'eval_' + Date.now(),
      date: date || new Date().toISOString().slice(0,10),
      created_at: new Date().toISOString(),
      potrero: potrero || '',
      lot_code: lot_code || '',
      by: by || 'Campo',
      raw_text: evalText,
      ...parsed,
      has_photo: true
    };

    // Save to pasture_evals table
    const evals = await getTable(req.tenantId, 'pasture_evals');
    const evalList = Array.isArray(evals) ? evals : [];
    evalList.push(evalRecord);
    await setTable(req.tenantId, 'pasture_evals', evalList);

    // Save photo
    const imgList = await getTable(req.tenantId, 'transaction_images');
    const images = Array.isArray(imgList) ? imgList : [];
    images.push({
      id: 'img_' + Date.now(), transaction_id: evalRecord.id, transaction_type: 'pasture_eval',
      base64, mime_type: 'image/jpeg', size_kb: Math.round(base64.length / 1024),
      created_at: new Date().toISOString(), uploaded_by: by || 'Campo'
    });
    await setTable(req.tenantId, 'transaction_images', images);

    res.json({ok: true, eval: evalRecord});
  } catch(e) { res.status(500).json({error: e.message}); }
});

// ── DELETE pasture-eval por ID ────────────────────────────────
// La PWA llama a este endpoint cuando se borra una evaluación.
// Borra del array pasture_evals + agrega a _deleted_ids para que
// otros clientes (Desktop, otra PWA) respeten el delete en el próximo pull.
app.delete('/api/pasture-eval/:id', auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({error: 'id requerido'});

    // Borrar del array
    const evals = await getTable(tenantId, 'pasture_evals');
    const list = Array.isArray(evals) ? evals : [];
    const before = list.length;
    const filtered = list.filter(e => String(e && e.id) !== id && String(e && e.server_id || '') !== id);
    if (before === filtered.length) {
      // No estaba en el array (puede ser que ya se borró antes), pero igual marcamos en _deleted_ids
      console.log('[DELETE pasture-eval] No encontrado en array (id=' + id + '), marcando solo en _deleted_ids');
    }
    await setTable(tenantId, 'pasture_evals', filtered);

    // Agregar a _deleted_ids para que otros clientes lo respeten
    try {
      const delResult = await pool.query('SELECT value FROM store WHERE tenant_id=$1 AND key=$2', [tenantId, '_deleted_ids']);
      let delMap = (delResult.rows.length && delResult.rows[0].value) ? delResult.rows[0].value : {};
      if (!delMap || typeof delMap !== 'object' || Array.isArray(delMap)) delMap = {};
      delMap['pasture_evals:' + id] = Date.now();
      // Cap a 500 entries
      const keys = Object.keys(delMap);
      if (keys.length > 500) {
        keys.sort((a,b) => delMap[a] - delMap[b]);
        for (let i = 0; i < keys.length - 500; i++) delete delMap[keys[i]];
      }
      await pool.query(
        `INSERT INTO store(tenant_id, key, value, updated_at) VALUES($1, $2, $3, NOW())
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
        [tenantId, '_deleted_ids', JSON.stringify(delMap)]
      );
    } catch(e) { console.warn('[DELETE pasture-eval] No pude actualizar _deleted_ids:', e.message); }

    // Audit log
    try {
      await appendAuditLog(tenantId, {
        action: 'delete',
        table: 'pasture_evals',
        record_id: id,
        record_summary: 'Eval pasto borrada (id=' + id + ')',
        user: req.headers['x-user'] || 'PWA',
        source: req.headers['x-app-type'] || 'pwa',
        ip: getClientIp(req),
        device_os: '',
        device_browser: '',
        app_version: req.headers['x-app-version'] || '',
      });
    } catch(e) {}

    res.json({ok: true, id, before, after: filtered.length});
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

// ── Delete lot by code ────────────────────────────────────────
app.delete('/api/lots/by-code/:code', auth, async (req, res) => {
  try {
    const existing = await getTable(req.tenantId, 'lots');
    const filtered = existing.filter(l => l.code !== req.params.code);
    await setTable(req.tenantId, 'lots', filtered);
    res.json({ ok: true, deleted: req.params.code });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Animal move ───────────────────────────────────────────────
app.post('/api/animal-move', auth, async (req, res) => {
  try {
    const { animal_id, from_lot, to_lot, date, by, source } = req.body;
    if (!animal_id || !to_lot) return res.status(400).json({ error: 'animal_id and to_lot required' });
    const tenantId = req.tenantId;
    const movements = await getTable(tenantId, 'animal_movements');
    const newMove = { id: Date.now().toString(), animal_id: animal_id.toString(), from_lot: from_lot || '', to_lot, date: date || new Date().toISOString().slice(0,10), by: by || 'Sistema', source: source || 'desktop', created_at: new Date().toISOString() };
    movements.push(newMove);
    await setTable(tenantId, 'animal_movements', movements);
    const animals = await getTable(tenantId, 'animals');
    if (typeof animals === 'object' && !Array.isArray(animals)) {
      let animalData = null;
      Object.keys(animals).forEach(lot => {
        const found = (animals[lot] || []).find(a => (a.animal_id || a.id || '').toString() === animal_id.toString());
        if (found) { animalData = found; animals[lot] = animals[lot].filter(a => a !== found); }
      });
      if (!animals[to_lot]) animals[to_lot] = [];
      animals[to_lot].push(animalData || { animal_id: animal_id.toString(), breed: '', pesajes: [] });
      await setTable(tenantId, 'animals', animals);
    }
    res.json({ ok: true, movement: newMove });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── ANIMAL MOVEMENTS BULK (v4.4.1) ────────────────────────────
// Mover N animales del mismo lote origen → mismo destino en una operación atómica.
// Si created_new_lot=true y new_lot_data viene, también crea el lote destino.
// Persiste:
//   - Resumen en tabla `animal_movements` (1 registro por batch)
//   - Movimiento físico de los animales (lot[from] → lot[to])
//   - Si created_new_lot=true: registra el nuevo lot en `lots` con animal_count correcto
//   - Actualiza animal_count de lote origen
//   - Stamp granular `_movements[]` en cada animal afectado
app.post('/api/animal-movements/bulk', auth, async (req, res) => {
  try {
    const {
      batch_id,
      from_lot,
      to_lot,
      animal_ids,
      animals_payload,  // v4.4.2: datos completos de los animales del cliente (fallback si server no los tiene)
      date,
      motivo,
      created_new_lot,
      new_lot_data,
      by,
      source
    } = req.body;

    // ── Validaciones de entrada ──
    if (!batch_id) return res.status(400).json({ error: 'batch_id required' });
    if (!from_lot) return res.status(400).json({ error: 'from_lot required' });
    if (!to_lot) return res.status(400).json({ error: 'to_lot required' });
    if (from_lot === to_lot) return res.status(400).json({ error: 'from_lot and to_lot must differ' });
    if (!Array.isArray(animal_ids) || animal_ids.length === 0) {
      return res.status(400).json({ error: 'animal_ids must be non-empty array' });
    }
    if (created_new_lot && !new_lot_data) {
      return res.status(400).json({ error: 'created_new_lot=true requires new_lot_data' });
    }
    if (created_new_lot && new_lot_data && (!new_lot_data.code || new_lot_data.code !== to_lot)) {
      return res.status(400).json({ error: 'new_lot_data.code must equal to_lot' });
    }

    const tenantId = req.tenantId;
    const moveDate = date || new Date().toISOString().slice(0, 10);

    // ── Idempotencia: si ya existe un movimiento con el mismo batch_id, devolver OK ──
    const movements = await getTable(tenantId, 'animal_movements');
    const existingBatch = (Array.isArray(movements) ? movements : [])
      .find(m => m && m.id === batch_id);
    if (existingBatch) {
      return res.json({
        ok: true,
        idempotent: true,
        movement: existingBatch,
        message: 'Batch already processed, no-op'
      });
    }

    // ── Cargar tablas con las que vamos a trabajar ──
    // getTable retorna [] por default. Para animals (que es objeto), si retorna []
    // significa "tabla vacía", la tratamos como objeto vacío.
    let animals = await getTable(tenantId, 'animals');
    if (!animals || Array.isArray(animals)) animals = {};
    const lots = await getTable(tenantId, 'lots') || [];

    // v4.4.2: el server es tolerante con desincronización de animals.
    // Si el server no tiene animales en from_lot, aceptamos animals_payload del cliente.
    // Este es el caso típico cuando:
    //   1) El usuario hizo bulk move antes de que terminara el push de animals
    //   2) Los animales se crearon offline y aún no llegaron
    //   3) El server tuvo reset y faltan datos
    if (!animals[from_lot] || animals[from_lot].length === 0) {
      if (Array.isArray(animals_payload) && animals_payload.length > 0) {
        // Usar el payload del cliente como fuente; el cliente conoce el estado real
        animals[from_lot] = animals_payload.map(a => ({
          animal_id: String(a.animal_id || a.id || ''),
          breed: a.breed || a.raza || '',
          pesajes: a.pesajes || [],
          _movements: a._movements || []
        }));
        console.log('[animal-movements/bulk] Usando animals_payload (server sin datos para ' + from_lot + ')');
      } else {
        return res.status(400).json({
          error: 'from_lot has no animals on server and no animals_payload provided',
          from_lot: from_lot,
          hint: 'cliente debe enviar animals_payload con los datos completos'
        });
      }
    }

    // ── Si se va a crear lote nuevo, validar que no exista ya ──
    if (created_new_lot) {
      const codeExists = lots.some(l => l && l.code === to_lot);
      if (codeExists) {
        return res.status(409).json({
          error: 'new lot code already exists on server',
          code: to_lot
        });
      }
    } else {
      // Si NO es lote nuevo, debe existir
      const destExists = lots.some(l => l && l.code === to_lot);
      if (!destExists) {
        return res.status(400).json({
          error: 'to_lot does not exist on server',
          to_lot: to_lot
        });
      }
    }

    // ── Localizar animales y armar moved/missing ──
    // Convertir IDs a strings para comparar consistentemente
    const targetIds = animal_ids.map(id => String(id));
    const sourceArr = animals[from_lot] || [];
    const moved = [];
    const missing = [];

    targetIds.forEach(id => {
      const idx = sourceArr.findIndex(a => {
        const aid = String(a && (a.animal_id || a.id) || '');
        return aid === id;
      });
      if (idx >= 0) {
        moved.push({ animal: sourceArr[idx], origIdx: idx, id, fromServer: true });
      } else {
        missing.push(id);
      }
    });

    // v4.4.2: si hay missing pero el cliente nos pasó animals_payload, completar con esos datos
    // Solo aplicable si animals_payload está disponible. Útil cuando los animales locales del cliente
    // tienen pesajes/datos más nuevos que los del server (race condition con bulk-push de animales).
    if (missing.length > 0 && Array.isArray(animals_payload) && animals_payload.length > 0) {
      const payloadMap = {};
      animals_payload.forEach(a => {
        const aid = String(a.animal_id || a.id || '');
        if (aid) payloadMap[aid] = a;
      });
      const stillMissing = [];
      missing.forEach(id => {
        const fromPayload = payloadMap[id];
        if (fromPayload) {
          // Crear el animal usando los datos del cliente, NO lo agregamos al sourceArr
          // (no era miembro real del server). Solo lo pasamos a moved para el destino.
          const newAnimal = {
            animal_id: id,
            breed: fromPayload.breed || fromPayload.raza || '',
            pesajes: fromPayload.pesajes || [],
            _movements: fromPayload._movements || []
          };
          moved.push({ animal: newAnimal, origIdx: -1, id, fromServer: false });
          console.log('[animal-movements/bulk] ID ' + id + ' completado desde payload');
        } else {
          stillMissing.push(id);
        }
      });
      // Reasignar missing solo con los realmente faltantes
      missing.length = 0;
      stillMissing.forEach(id => missing.push(id));
    }

    // Si todos los animales están missing, abortar con info diagnóstica
    if (moved.length === 0) {
      // Muestra del server para que el cliente diagnostique mismatch de IDs
      const sampleServerIds = sourceArr.slice(0, 10).map(a =>
        String(a && (a.animal_id || a.id) || '<sin_id>')
      );
      return res.status(400).json({
        error: 'no animals found in from_lot',
        from_lot: from_lot,
        requested_ids: targetIds.slice(0, 10),
        server_has_count: sourceArr.length,
        server_sample_ids: sampleServerIds,
        hint: 'IDs en server no matchean con los pedidos. Posible: animales sin syncar o IDs renombrados.'
      });
    }

    // ── Aplicar el movimiento (in-memory) ──
    // 1) Quitar del lote origen — solo los que VENÍAN del server (no los recién agregados desde payload)
    const indicesToRemove = new Set(
      moved.filter(m => m.fromServer).map(m => m.origIdx)
    );
    animals[from_lot] = sourceArr.filter((_, i) => !indicesToRemove.has(i));
    // 2) Inicializar destino si no existe
    if (!animals[to_lot]) animals[to_lot] = [];
    // 3) Stamp granular en cada animal y agregar al destino
    const weights = [];
    moved.forEach(m => {
      const animal = m.animal;
      if (!animal._movements) animal._movements = [];
      const pesajes = animal.pesajes || [];
      const lastWeight = pesajes.length ? pesajes[pesajes.length - 1].peso : 0;
      if (lastWeight > 0) weights.push(lastWeight);
      animal._movements.push({
        date: moveDate,
        from_lot: from_lot,
        to_lot: to_lot,
        weight_at_move: lastWeight,
        batch_id: batch_id,
        reason: motivo || ''
      });
      animals[to_lot].push(animal);
    });

    // ── Si created_new_lot, agregar el nuevo lote a lots[] ──
    if (created_new_lot && new_lot_data) {
      const newLot = Object.assign({}, new_lot_data, {
        animal_count: moved.length,
        // Recalcular avg_weight con los pesos reales del server
        avg_weight: weights.length
          ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10
          : (new_lot_data.avg_weight || 0),
        status: new_lot_data.status || 'activo',
        entry_date: new_lot_data.entry_date || moveDate,
        // Asegurar que tiene un id único si no vino
        id: new_lot_data.id || ('lot_' + Date.now())
      });
      lots.push(newLot);
    }

    // ── Actualizar animal_count del lote origen ──
    const fromLotObj = lots.find(l => l && l.code === from_lot);
    if (fromLotObj) {
      fromLotObj.animal_count = (animals[from_lot] || []).length;
    }

    // ── Si NO es lote nuevo, actualizar animal_count del destino existente ──
    if (!created_new_lot) {
      const toLotObj = lots.find(l => l && l.code === to_lot);
      if (toLotObj) {
        toLotObj.animal_count = (animals[to_lot] || []).length;
        // Recalcular avg_weight del destino con todos sus animales
        const allDestWeights = animals[to_lot]
          .map(a => {
            const ps = a.pesajes || [];
            return ps.length ? ps[ps.length - 1].peso : 0;
          })
          .filter(w => w > 0);
        if (allDestWeights.length > 0) {
          toLotObj.avg_weight = Math.round(
            (allDestWeights.reduce((a, b) => a + b, 0) / allDestWeights.length) * 10
          ) / 10;
        }
      }
    }

    // ── Construir registro de batch para `animal_movements` ──
    const avgWeight = weights.length
      ? Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 10) / 10
      : 0;
    const totalKg = Math.round(weights.reduce((a, b) => a + b, 0));

    const batchRecord = {
      id: batch_id,
      date: moveDate,
      from_lot: from_lot,
      to_lot: to_lot,
      animal_ids: moved.map(m => m.id),  // IDs realmente movidos (omite missing)
      count: moved.length,
      avg_weight: avgWeight,
      total_kg: totalKg,
      reason: motivo || '',
      created_new_lot: !!created_new_lot,
      by: by || 'Sistema',
      source: source || 'desktop',
      created_at: new Date().toISOString(),
      missing_ids: missing  // Auditoría: qué IDs no encontramos
    };

    // ── Persistir las 3 tablas afectadas ──
    const updatedMovements = Array.isArray(movements) ? movements : [];
    updatedMovements.push(batchRecord);
    await setTable(tenantId, 'animal_movements', updatedMovements);
    await setTable(tenantId, 'animals', animals);
    await setTable(tenantId, 'lots', lots);

    // ── Audit log (best-effort, no rompe la operación si falla) ──
    try {
      if (typeof appendAuditLog === 'function') {
        await appendAuditLog(tenantId, {
          action: 'create',
          table: 'animal_movements',
          record_id: batch_id,
          record_summary:
            'Bulk move: ' + moved.length + ' animales de ' + from_lot + ' → ' + to_lot +
            (created_new_lot ? ' (lote nuevo)' : '') +
            (motivo ? ' · ' + String(motivo).slice(0, 80) : ''),
          user: by || 'Sistema',
          source: source || 'desktop',
          ip: getClientIp(req) || '',
          app_version: req.headers['x-app-version'] || ''
        });
      }
    } catch (auditErr) {
      console.warn('[animal-movements/bulk] audit log failed:', auditErr.message);
    }

    res.json({
      ok: true,
      batch: batchRecord,
      moved_count: moved.length,
      missing_ids: missing,
      created_lot: created_new_lot ? to_lot : null
    });
  } catch (e) {
    console.error('[animal-movements/bulk] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Tasks bulk ────────────────────────────────────────────────
app.post('/api/tasks/bulk', auth, async (req, res) => {
  try {
    const { tasks, replace_all } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ error: 'tasks must be array' });
    if (replace_all) { await setTable(req.tenantId, 'tasks', tasks); return res.json({ ok: true, count: tasks.length }); }
    const existing = await getTable(req.tenantId, 'tasks');
    const merged = existing.map(t => {
      const inc = tasks.find(x => x.id === t.id);
      if (!inc) return t;
      const wins = (inc.updated_at || '') >= (t.updated_at || '');
      return { ...t, title: inc.title || t.title, desc: inc.desc || t.desc, assignee: inc.assignee || t.assignee, priority: inc.priority || t.priority, due: inc.due || t.due, lot: inc.lot || t.lot, status: wins ? inc.status : t.status, completed_at: wins ? inc.completed_at : t.completed_at, updated_at: wins ? inc.updated_at : t.updated_at, comment: wins ? (inc.comment || t.comment) : (t.comment || inc.comment) };
    });
    tasks.forEach(t => { if (!existing.find(e => e.id === t.id)) merged.push(t); });
    await setTable(req.tenantId, 'tasks', merged);
    res.json({ ok: true, count: merged.length });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// v4.15.0: saca de un objeto de inventario {lote:[animales]} los animales cuyo id está en deadSet.
// Un animal con baja no puede estar en el rodeo. Puro (sin DB).
function _scrubDeadFromAnimals(animalsObj, deadSet) {
  if (!animalsObj || typeof animalsObj !== 'object' || Array.isArray(animalsObj) || !deadSet || !deadSet.size) {
    return { obj: animalsObj, removed: 0 };
  }
  let removed = 0;
  const out = {};
  Object.keys(animalsObj).forEach(lot => {
    const arr = animalsObj[lot];
    if (!Array.isArray(arr)) { out[lot] = arr; return; }
    out[lot] = arr.filter(a => {
      const id = String((a && (a.animal_id != null ? a.animal_id : a.id)) || '');
      if (id && deadSet.has(id)) { removed++; return false; }
      return true;
    });
  });
  return { obj: out, removed };
}

// v4.15.0: inventario de animales liviano (para el "pull antes de push" de la PWA).
// Devuelve el objeto {lote:[animales]} actual del server, sin geo ni telemetría.
app.get('/api/animals', botLightAuth, async (req, res) => {
  try {
    const animals = await getTable(req.tenantId, 'animals');
    res.json({ animals: (animals && typeof animals === 'object' && !Array.isArray(animals)) ? animals : {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Bulk push single table (replace) ──────────────────────────
app.post('/api/bulk-push', auth, async (req, res) => {
  try {
    const { table, records } = req.body;
    if (!table) return res.status(400).json({ error: 'table required' });
    // Accept both arrays and objects (for report_params, diesel_tank, branding)
    if (records === undefined || records === null) return res.status(400).json({ error: 'records required' });

    // v4.9.0: salvaguardas — evitar wipes accidentales de tablas con datos valiosos.
    const _bulkOverride = String(req.headers['x-bulk-override'] || '').toLowerCase() === 'yes';
    const _safety = await evaluateBulkSafety(req.tenantId, table, records, _bulkOverride);
    if (!_safety.ok) {
      console.warn(`[bulk-push BLOCKED] tenant=${req.tenantId} table=${table} code=${_safety.code} — ${_safety.reason}`);
      return res.status(409).json({ error: _safety.reason, code: _safety.code, blocked: true });
    }

    // Si es un array, aplicar filtro de deleted_ids para evitar reactivar borrados
    let finalRecords = records;
    if (Array.isArray(records) && table !== '_deleted_ids') {
      const deletedIdsRaw = await getTable(req.tenantId, '_deleted_ids');
      const deletedMap = (deletedIdsRaw && typeof deletedIdsRaw === 'object' && !Array.isArray(deletedIdsRaw)) ? deletedIdsRaw : {};
      finalRecords = records.filter(r => !deletedMap[table + ':' + String(r && r.id)]);

      // FIX v1.4.31 (12-may-2026): bulk-push de rotation_history hacía REPLACE total,
      // borrando los cierres que la PWA había aplicado. Ahora hace merge inteligente:
      // por cada entry, si el server tenía exit_date pero incoming no, mantener el cierre.
      // Esto pasa cuando el Desktop hace bulk-push con datos que no incluyen los cierres
      // hechos desde la PWA (que aún no llegaron al Desktop vía pull).
      if (table === 'rotation_history') {
        const existing = await getTable(req.tenantId, 'rotation_history') || [];
        const incomingMap = {};
        finalRecords.forEach(r => { incomingMap[String(r.id)] = r; });
        const existingMap = {};
        existing.forEach(r => { existingMap[String(r.id)] = r; });

        // Tomamos la unión de IDs
        const allIds = new Set([...Object.keys(existingMap), ...Object.keys(incomingMap)]);
        const merged = [];
        let preservedCierres = 0;
        for (const id of allIds) {
          const ex = existingMap[id];
          const inc = incomingMap[id];
          if (ex && inc) {
            // Ambos lados tienen este id — preservar exit_date del lado que lo tenga seteado
            if (ex.exit_date && !inc.exit_date) {
              // Server cerró pero incoming aún no — mantener server (preservar cierre)
              merged.push(ex);
              preservedCierres++;
            } else if (!ex.exit_date && inc.exit_date) {
              // Incoming cierra — aceptar
              merged.push(inc);
            } else {
              // Ambos cerrados o ambos abiertos — usar incoming (es el push)
              merged.push(inc);
            }
          } else if (ex) {
            // Solo en server — preservar (ejemplo: cierre de PWA que el Desktop aún no vio)
            merged.push(ex);
          } else {
            // Solo en incoming — agregar (entrada nueva)
            merged.push(inc);
          }
        }
        if (preservedCierres > 0) {
          console.log(`[bulk-push rotation_history] ${req.tenantId}: preservados ${preservedCierres} cierres del server que el incoming no tenía`);
        }
        finalRecords = merged;
      }

      // Tracking especial para lots: detectar cambios de paddock y stamp timestamp
      if (table === 'lots') {
        // v4.5.7: defensa contra lotes sin id. Si el bot WhatsApp creó sub-lotes sin id
        // (handleLotSplit pre-v4.5.7) y el Desktop hace bulk-push, los muchos undefined
        // colapsaban a un único key en existingMap. Asignamos id aquí también.
        finalRecords = finalRecords.map(r => {
          if (r && !r.id) {
            return { ...r, id: 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) };
          }
          return r;
        });
        const existing = await getTable(req.tenantId, table) || [];
        const existingMap = {};
        existing.forEach(e => { if (e && e.id) existingMap[e.id] = e; });
        // FIX BAJAS (v1.4.26): animals[code].length es la ÚNICA fuente de verdad de animal_count.
        // Antes solo reconciliaba si el incoming era MENOR (asumiendo "no perder animales").
        // Pero eso bloqueaba bajas legítimas: si la PWA pushea animal_count=145 pero server.animals
        // aún tiene 146 (race condition), el lote queda atascado. Ahora si hay animals registrados,
        // siempre usamos animals.length, sin importar qué diga el incoming.
        const serverAnimals = await getTable(req.tenantId, 'animals') || {};
        finalRecords = finalRecords.map(r => {
          const prev = existingMap[r.id];
          let reconciledRecord = r;
          if (r && r.code && r.status !== 'vendido' && r.status !== 'sold') {
            const lotAnimals = serverAnimals[r.code];
            // Si el lote tiene un kardex de animals registrado (incluso vacío), usar su length.
            // Si el lote NO tiene kardex (lote nuevo o sin animals registrados), respetar el incoming.
            if (lotAnimals !== undefined) {
              const realCount = lotAnimals.length;
              if ((r.animal_count || 0) !== realCount) {
                console.log(`[bulk-push lots] Reconciliando ${r.code}: animal_count entrante=${r.animal_count||0} → real=${realCount}`);
                reconciledRecord = { ...r, animal_count: realCount };
              }
            }
          }
          if (!prev) return { ...reconciledRecord, paddock_updated_at: reconciledRecord.paddock_updated_at || new Date().toISOString() };
          // Si el paddock cambió, marcar timestamp nuevo
          if (reconciledRecord.paddock && prev.paddock && reconciledRecord.paddock !== prev.paddock) {
            return { ...reconciledRecord, paddock_updated_at: new Date().toISOString() };
          }
          // Si no cambió, mantener el timestamp existente del server
          return { ...reconciledRecord, paddock_updated_at: prev.paddock_updated_at || reconciledRecord.paddock_updated_at || '' };
        });

        // v4.5.1: tras reconciliar, sincronizar rotation_history para cada lote
        // Hacemos esto ANTES de setTable(lots) porque el helper persiste rotation_history
        // por su cuenta. Pasamos el existingMap como prev para detectar cambios reales.
        await saveBulkPresafe(req.tenantId, table, existing); // v4.9.0 snapshot pre-replace
        await setTable(req.tenantId, table, finalRecords);
        for (const upd of finalRecords) {
          const prev = existingMap[upd.id] || null;
          try {
            await syncRotationOnLotChange(req.tenantId, upd, prev, { reason: 'bulk-push', source: 'desktop' });
          } catch(e) { console.error('[bulk-push rotation_history]', upd.code, e.message); }
        }
        _autoAuditTable(req.tenantId, table, existing, finalRecords, req).catch(() => {});
        res.json({ ok: true, table, count: finalRecords.length });
        return;
      }
    }

    // v4.5.11-fix2: inferir paddock para tablas de actividad por lote (sal, agua, alimento, conteo, partos)
    // El Desktop empuja arrays completos vía /bulk-push (no /api/sal), por lo que el middleware
    // _inferPaddockMiddleware no se activa aquí. Replicamos la lógica directamente sobre finalRecords.
    // v4.5.16: además, default tipo='mineral' para registros de sal sin tipo explícito.
    const ACTIVITY_TABLES_WITH_PADDOCK = ['sal', 'agua', 'alimento', 'conteo', 'partos'];
    console.log(`[bulk-push DEBUG] table=${table} isArray=${Array.isArray(finalRecords)} activityMatch=${ACTIVITY_TABLES_WITH_PADDOCK.indexOf(table) >= 0} count=${Array.isArray(finalRecords) ? finalRecords.length : 'n/a'}`);
    if (Array.isArray(finalRecords) && ACTIVITY_TABLES_WITH_PADDOCK.indexOf(table) >= 0) {
      const lotsForPaddock = await getTable(req.tenantId, 'lots') || [];
      const lotPaddockMap = {};
      lotsForPaddock.forEach(l => { if (l && l.code && l.paddock) lotPaddockMap[l.code] = l.paddock; });
      console.log(`[bulk-push DEBUG] lots in map: ${Object.keys(lotPaddockMap).length}, sample: ${JSON.stringify(Object.entries(lotPaddockMap).slice(0,3))}`);
      let inferredCount = 0;
      let skippedExisting = 0;
      let skippedNoLot = 0;
      let skippedNoLotInMap = 0;
      let tipoDefaultCount = 0;
      finalRecords = finalRecords.map(r => {
        if (!r) return r;
        let out = r;
        // Paddock inference
        if (out.paddock && String(out.paddock).trim()) {
          skippedExisting++;
        } else if (!out.lot_code) {
          skippedNoLot++;
        } else {
          const padd = lotPaddockMap[out.lot_code];
          if (padd) {
            inferredCount++;
            out = { ...out, paddock: padd };
          } else {
            skippedNoLotInMap++;
            console.log(`[bulk-push DEBUG] lot_code "${out.lot_code}" NOT in lotPaddockMap. Available codes: ${Object.keys(lotPaddockMap).slice(0,10).join(',')}`);
          }
        }
        // v4.5.16: default tipo='mineral' para sal sin tipo
        if (table === 'sal' && (!out.tipo || !String(out.tipo).trim())) {
          tipoDefaultCount++;
          out = { ...out, tipo: 'mineral' };
        }
        return out;
      });
      console.log(`[bulk-push infer-paddock] tenant=${req.tenantId} table=${table} inferred=${inferredCount} skippedExisting=${skippedExisting} skippedNoLot=${skippedNoLot} skippedNoLotInMap=${skippedNoLotInMap} total=${finalRecords.length}`);
      if (tipoDefaultCount > 0) console.log(`[bulk-push default-tipo] tenant=${req.tenantId} table=sal applied=${tipoDefaultCount}/${finalRecords.length}`);
    }

    // v4.13.0: capturar estado previo (una sola lectura) para auditoría automática + presafe
    let _auditOld = null;
    try { _auditOld = await getTable(req.tenantId, table); } catch(e) {}

    // v4.15.0: scrub de fantasmas — un animal con baja NO puede estar en el inventario.
    // Cubre el caso de un dispositivo con copia vieja que re-pushea un animal ya muerto.
    if (table === 'animals' && finalRecords && typeof finalRecords === 'object' && !Array.isArray(finalRecords)) {
      try {
        const _bj = await getTable(req.tenantId, 'bajas');
        const _dead = new Set((Array.isArray(_bj) ? _bj : []).map(b => String((b && b.animal_id) || '')).filter(Boolean));
        const _r = _scrubDeadFromAnimals(finalRecords, _dead);
        if (_r.removed > 0) { console.log(`[scrub-animals] tenant=${req.tenantId} removidos=${_r.removed} (animales con baja)`); finalRecords = _r.obj; }
      } catch(e) { console.error('[scrub-animals]', e.message); }
    }

    // v4.9.0: snapshot pre-replace para tablas protegidas (permite revertir un wipe)
    if (BULK_PROTECTED_TABLES.indexOf(table) >= 0) {
      await saveBulkPresafe(req.tenantId, table, _auditOld);
    }
    await setTable(req.tenantId, table, finalRecords);

    // v4.15.0: si se pushearon bajas, sacar del inventario los animales recién dados de baja
    if (table === 'bajas' && Array.isArray(finalRecords)) {
      try {
        const _an = await getTable(req.tenantId, 'animals');
        if (_an && typeof _an === 'object' && !Array.isArray(_an)) {
          const _dead2 = new Set(finalRecords.map(b => String((b && b.animal_id) || '')).filter(Boolean));
          const _r2 = _scrubDeadFromAnimals(_an, _dead2);
          if (_r2.removed > 0) { await setTable(req.tenantId, 'animals', _r2.obj); console.log(`[scrub-on-baja] tenant=${req.tenantId} removidos=${_r2.removed}`); }
        }
      } catch(e) { console.error('[scrub-on-baja]', e.message); }
    }

    // v4.13.0: auditoría automática del diff (fire-and-forget, no bloquea la respuesta)
    _autoAuditTable(req.tenantId, table, _auditOld, finalRecords, req).catch(() => {});
    res.json({ ok: true, table, count: Array.isArray(finalRecords) ? finalRecords.length : 1 });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// v4.9.0: revertir una tabla al último snapshot pre-replace guardado por las salvaguardas.
// Uso: POST /api/bulk-restore-presafe { table }  → restaura _presafe_<table> sobre <table>.
app.post('/api/bulk-restore-presafe', auth, async (req, res) => {
  try {
    const { table } = req.body;
    if (!table) return res.status(400).json({ error: 'table required' });
    const presafe = await getTable(req.tenantId, '_presafe_' + table);
    if (!presafe || !presafe.data || presafe.count === undefined) {
      return res.status(404).json({ error: `No hay snapshot pre-safe para "${table}".` });
    }
    await setTable(req.tenantId, table, presafe.data);
    console.log(`[bulk-restore-presafe] tenant=${req.tenantId} table=${table} restaurado ${presafe.count} registros (snapshot de ${presafe.saved_at})`);
    res.json({ ok: true, table, restored_count: presafe.count, snapshot_at: presafe.saved_at });
  } catch(e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/cloud-backup', auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const tables = BACKUP_TABLES_FULL;  // v4.10.0: lista completa unificada
    const snapshot = { timestamp: new Date().toISOString(), tenant: req.tenant.name, tables: {} };
    for (const t of tables) { snapshot.tables[t] = await getTable(tenantId, t); }
    const snapshots = await getTable(tenantId, 'backup_snapshots');
    snapshots.push({ id: Date.now().toString(), created_at: new Date().toISOString(), size_kb: Math.round(JSON.stringify(snapshot).length / 1024), triggered_by: req.body.triggered_by || 'manual', data: snapshot });
    await setTable(tenantId, 'backup_snapshots', snapshots.sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0, 30));
    res.json({ ok: true, id: snapshots[0].id, created_at: snapshots[0].created_at, size_kb: snapshots[0].size_kb });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/cloud-backup/list', auth, async (req, res) => {
  try {
    const snapshots = await getTable(req.tenantId, 'backup_snapshots');
    res.json(snapshots.sort((a,b) => b.created_at.localeCompare(a.created_at)).map(s => ({ id: s.id, created_at: s.created_at, size_kb: s.size_kb, triggered_by: s.triggered_by })));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/cloud-backup/:id', auth, async (req, res) => {
  try {
    const snapshots = await getTable(req.tenantId, 'backup_snapshots');
    const snap = snapshots.find(s => s.id === req.params.id);
    if (!snap) return res.status(404).json({ error: 'Snapshot not found' });
    res.json(snap.data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Restaurar snapshot: reescribe TODAS las tablas desde un snapshot guardado
app.post('/api/cloud-backup/:id/restore', auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const snapshots = await getTable(tenantId, 'backup_snapshots');
    const snap = snapshots.find(s => s.id === req.params.id);
    if (!snap || !snap.data || !snap.data.tables) return res.status(404).json({ error: 'Snapshot not found or invalid' });

    // Crear un snapshot de seguridad antes de restaurar
    const allTables = Object.keys(snap.data.tables);
    const safetySnap = { timestamp: new Date().toISOString(), tenant: req.tenant.name, tables: {} };
    for (const t of allTables) { safetySnap.tables[t] = await getTable(tenantId, t); }
    snapshots.unshift({ id: 'pre-restore-' + Date.now(), created_at: new Date().toISOString(), size_kb: Math.round(JSON.stringify(safetySnap).length / 1024), triggered_by: 'pre-restore', data: safetySnap });
    await setTable(tenantId, 'backup_snapshots', snapshots.slice(0, 30));

    // Restaurar cada tabla desde el snapshot
    let restored = 0;
    for (const [table, data] of Object.entries(snap.data.tables)) {
      if (Array.isArray(data) || typeof data === 'object') {
        await setTable(tenantId, table, data);
        restored++;
      }
    }

    console.log('[Restore]', tenantId, 'restored', restored, 'tables from snapshot', snap.id, '(' + snap.created_at + ')');
    res.json({ ok: true, restored_tables: restored, snapshot_date: snap.created_at, safety_snapshot: 'pre-restore-' + Date.now() });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/backup', auth, async (req, res) => {
  try {
    const tables = BACKUP_TABLES_FULL;  // v4.10.0: lista completa (antes omitía report_params y 8 tablas más)
    const backup = { timestamp: new Date().toISOString(), tenant: req.tenant.name, tables: {} };
    for (const t of tables) { backup.tables[t] = await getTable(req.tenantId, t); }
    res.json(backup);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Generic CRUD ──────────────────────────────────────────────
function makeCRUD(tableKey) {
  const router = express.Router();
  router.get('/', auth, async (req, res) => { try { res.json(await getTable(req.tenantId, tableKey)); } catch(e) { res.status(500).json({ error: e.message }); } });
  router.post('/', auth, async (req, res) => {
    try {
      const rows = await getTable(req.tenantId, tableKey);
      const data = { ...req.body, server_updated_at: new Date().toISOString() };
      const idx = rows.findIndex(r => r.id == data.id);
      if (idx >= 0) rows[idx] = data; else rows.push(data);
      await setTable(req.tenantId, tableKey, rows);
      res.status(201).json(data);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  router.put('/:id', auth, async (req, res) => {
    try {
      const rows = await getTable(req.tenantId, tableKey);
      const idx = rows.findIndex(r => r.id == req.params.id);
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      rows[idx] = { ...rows[idx], ...req.body, server_updated_at: new Date().toISOString() };
      await setTable(req.tenantId, tableKey, rows);
      res.json(rows[idx]);
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  router.delete('/:id', auth, async (req, res) => {
    try {
      const rows = await getTable(req.tenantId, tableKey);
      const filtered = rows.filter(r => r.id != req.params.id);
      if (filtered.length === rows.length) return res.status(404).json({ error: 'Not found' });
      await setTable(req.tenantId, tableKey, filtered);
      res.json({ deleted: true });
    } catch(e) { res.status(500).json({ error: e.message }); }
  });
  return router;
}

app.use('/api/lots',             makeCRUD('lots'));
app.use('/api/vet-products',     makeCRUD('vet_products'));
app.use('/api/products',         makeCRUD('vet_products'));
// v4.5.3: middleware que normaliza lot_code case-insensitive para todos los endpoints
// de actividad por lote. Si el incoming trae lot_code="test 123" pero en el server
// el lote es "TEST 123", el middleware lo corrige a "TEST 123" antes de guardar.
// Se aplica a nivel de path; corre después de auth porque está montado después.
async function _normalizeLotCodeMiddleware(req, res, next) {
  try {
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') return next();
    if (!req.tenantId) return next(); // auth ya tuvo que correr; si no, pasamos
    const body = req.body || {};
    const incomingCode = body.lot_code;
    if (!incomingCode || typeof incomingCode !== 'string') return next();
    const trimmed = incomingCode.trim();
    if (!trimmed) return next();

    const lots = (await getTable(req.tenantId, 'lots')) || [];
    const lowerIncoming = trimmed.toLowerCase();
    const match = lots.find(l => l && l.code && String(l.code).toLowerCase() === lowerIncoming);
    if (match && match.code !== incomingCode) {
      console.log('[normalize lot_code] "' + incomingCode + '" -> "' + match.code + '" (case-insensitive match)');
      req.body = { ...body, lot_code: match.code };
    }
  } catch(e) {
    console.error('[normalize lot_code]', e);
  }
  next();
}

// Aplicamos auth + normalización al pipeline de los endpoints de actividad por lote.
// auth setea req.tenantId; luego el middleware normaliza; luego makeCRUD opera.
// Como makeCRUD también incluye auth internamente, se ejecuta dos veces (idempotente).
// v4.5.10: middleware específico para treatments que normaliza:
//  - scope: "lote" (español) → "lot" (inglés, lo que espera Desktop)
//  - scope: "completo" / "lote completo" / "todo el lote" → "lot"
//  - scope: "individual" / "animal" → "individual"
//  - fecha: si falta, setea fecha de hoy en YYYY-MM-DD
// El bot WhatsApp inconsistentemente generaba "lote" vs "lot", causando que el Desktop
// rendereara la columna LOTE/ANIMAL vacía (el else del render busca animal_id).
async function _normalizeTreatmentMiddleware(req, res, next) {
  try {
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') return next();
    const body = req.body || {};
    const patch = {};

    // Normalizar scope
    if (body.scope) {
      const s = String(body.scope).toLowerCase().trim();
      if (s === 'lote' || s === 'lot' || s === 'completo' || s === 'lote completo' ||
          s === 'todo el lote' || s === 'todo_el_lote' || s === 'group' || s === 'grupo') {
        patch.scope = 'lot';
      } else if (s === 'individual' || s === 'animal' || s === 'single') {
        patch.scope = 'individual';
      } else if (s === 'weight_range' || s === 'rango' || s === 'rango_peso' || s === 'rango de peso') {
        patch.scope = 'weight_range';
      }
      // Si no matcheó, deja el original (raro pero no rompe)
    }
    // Inferir scope si falta pero hay pista en body
    if (!body.scope || !patch.scope) {
      if (body.lot_code && !body.animal_id) patch.scope = patch.scope || 'lot';
      else if (body.animal_id && !body.lot_code) patch.scope = patch.scope || 'individual';
    }

    // Fecha por defecto
    if (!body.fecha) {
      patch.fecha = new Date().toISOString().slice(0, 10);
    }

    if (Object.keys(patch).length > 0) {
      req.body = { ...body, ...patch };
    }
  } catch(e) {
    console.error('[normalize treatment]', e);
  }
  next();
}

// v4.5.11: middleware que infiere paddock desde lot.paddock cuando el cliente no lo manda.
// Estrategia "mixta": si el cliente manda paddock explícito, se respeta (override).
// Si no, se busca el paddock actual del lote en db.lots. Si tampoco existe, deja pasar
// sin paddock (caso de lot_code huérfano o sin paddock asignado).
// Se aplica a endpoints de actividad por lote (sal, agua, alimento, conteo, partos)
// para garantizar que la pestaña Saladeros y reportes históricos siempre tengan paddock.
async function _inferPaddockMiddleware(req, res, next) {
  try {
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') return next();
    if (!req.tenantId) return next();
    const body = req.body || {};

    // Si cliente mandó paddock explícito (no vacío), respetar override
    if (body.paddock && String(body.paddock).trim()) return next();

    // Sin lot_code no podemos inferir
    if (!body.lot_code) return next();

    // Buscar paddock actual del lote
    const lots = (await getTable(req.tenantId, 'lots')) || [];
    const lot = lots.find(l => l && l.code === body.lot_code);
    if (lot && lot.paddock && String(lot.paddock).trim()) {
      req.body = { ...body, paddock: lot.paddock };
      console.log(`[infer-paddock] tenant=${req.tenantId} lot=${body.lot_code} → paddock="${lot.paddock}"`);
    }
    // Si lot no existe o sin paddock asignado, deja pasar sin paddock (caso huérfano o lote nuevo)
  } catch(e) {
    console.error('[infer-paddock]', e);
  }
  next();
}

// v4.5.16: middleware que setea tipo='mineral' por default en POST /api/sal cuando viene vacío.
// Defensivo — los caminos reales son /api/bot-transaction y /api/sync-push, ya cubiertos.
function _defaultSalTipoMiddleware(req, res, next) {
  try {
    if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT') return next();
    const body = req.body || {};
    if (!body.tipo || !String(body.tipo).trim()) {
      req.body = { ...body, tipo: 'mineral' };
      console.log(`[sal default-tipo] tenant=${req.tenantId || '?'} lot=${body.lot_code || '?'} → tipo="mineral"`);
    }
  } catch(e) {
    console.error('[sal default-tipo]', e);
  }
  next();
}

app.use('/api/treatments', auth, _normalizeLotCodeMiddleware, _normalizeTreatmentMiddleware, makeCRUD('treatments'));
app.use('/api/health-alerts',    makeCRUD('health_alerts'));
app.use('/api/sales',            makeCRUD('sales'));
app.use('/api/purchases',        makeCRUD('purchases'));
app.use('/api/employees',        makeCRUD('employees'));
app.use('/api/field-activities', makeCRUD('field_activities'));
app.use('/api/tasks',            makeCRUD('tasks'));
app.use('/api/pesajes',          auth, _normalizeLotCodeMiddleware, makeCRUD('pesajes'));
app.use('/api/advances',         makeCRUD('advances'));
app.use('/api/maintenance',      makeCRUD('maintenance'));
app.use('/api/agua',             auth, _normalizeLotCodeMiddleware, _inferPaddockMiddleware, makeCRUD('agua'));
// v4.5.3: middleware que descuenta del stock de productos sal al registrar consumo
// Detecta productos con (type/subtype/category) sal_mineral/sal y descuenta qty del stock.
// Si el bot mandó product_id explícito, se respeta. Si no, usa heurística:
//   - 1 producto sal → usar ese
//   - varios → no descontar, dejar la actividad guardada sin descuento (el bot debió preguntar)
app.post('/api/sal', auth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const qty = parseFloat(body.qty || body.kg || 0) || 0;
    if (qty <= 0) return next(); // sin cantidad, no descuento, sigue al CRUD normal

    const products = (await getTable(req.tenantId, 'vet_products')) || [];
    const isSalProduct = (p) => {
      if (!p) return false;
      const t = String(p.type || '').toLowerCase();
      const st = String(p.subtype || '').toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      const sub = String(p.sub_type || '').toLowerCase();
      return t === 'sal_mineral' || st === 'sal_mineral' || cat === 'sal_mineral'
          || t === 'sal' || st === 'sal' || cat === 'sal' || sub === 'sal_mineral' || sub === 'sal'
          || t === 'sal y suplementos' || cat === 'sal y suplementos';
    };
    const salProducts = products.filter(isSalProduct);

    let target = null;
    if (body.product_id) {
      target = products.find(p => String(p.id) === String(body.product_id) && isSalProduct(p));
    } else if (body.product_name) {
      const lower = String(body.product_name).toLowerCase().trim();
      target = salProducts.find(p => String(p.name || '').toLowerCase().trim() === lower);
    } else if (salProducts.length === 1) {
      target = salProducts[0];
    }
    // varios productos y sin pista → no descontamos, dejamos pasar al CRUD normal
    if (!target) {
      console.log(`[sal-stock] No se identificó producto único (salProducts=${salProducts.length}, body.product_id=${body.product_id||''}, body.product_name=${body.product_name||''}). Registrando actividad sin descontar.`);
      return next();
    }

    // Descontar del stock
    const stockBefore = parseFloat(target.stock_qty || 0) || 0;
    const stockAfter = Math.max(0, stockBefore - qty);
    target.stock_qty = stockAfter;
    target.server_updated_at = new Date().toISOString();

    // Guardar productos actualizados
    await setTable(req.tenantId, 'vet_products', products);

    // Enriquecer el body con info del descuento para que quede registrado en la actividad
    req.body = {
      ...body,
      product_id: target.id,
      product_name: target.name,
      stock_before: stockBefore,
      stock_after: stockAfter,
    };

    console.log(`[sal-stock] Tenant ${req.tenantId}: descontados ${qty}kg de "${target.name}" (${stockBefore} → ${stockAfter}kg)`);
    next();
  } catch(e) {
    console.error('[sal-stock middleware]', e);
    next(); // si algo falla, no romper el flujo: dejar pasar al CRUD normal
  }
});

// Endpoint helper para que el bot consulte los productos sal disponibles
app.post('/api/bot/sal-products', auth, async (req, res) => {
  try {
    const products = (await getTable(req.tenantId, 'vet_products')) || [];
    const isSalProduct = (p) => {
      if (!p) return false;
      const t = String(p.type || '').toLowerCase();
      const st = String(p.subtype || '').toLowerCase();
      const cat = String(p.category || '').toLowerCase();
      const sub = String(p.sub_type || '').toLowerCase();
      return t === 'sal_mineral' || st === 'sal_mineral' || cat === 'sal_mineral'
          || t === 'sal' || st === 'sal' || cat === 'sal' || sub === 'sal_mineral' || sub === 'sal'
          || t === 'sal y suplementos' || cat === 'sal y suplementos';
    };
    const salProducts = products.filter(isSalProduct);

    // v4.5.9: helper para listar lotes activos en formato consultable para el usuario
    // Reutilizable para que cualquier endpoint que pida "elegir lote" muestre la lista junta.
    const _buildActiveLotsList = async () => {
      try {
        const lots = (await getTable(req.tenantId, 'lots')) || [];
        const isCuarentenaLot = (l) => {
          const code = String(l.code || '').toLowerCase();
          const paddock = String(l.paddock || '').toLowerCase();
          const status = String(l.status || '').toLowerCase();
          return status === 'cuarentena' || paddock.indexOf('cuarentena') >= 0 || code.startsWith('cuar-');
        };
        const valid = lots.filter(l => {
          if (!l || !l.code) return false;
          const st = String(l.status || '').toLowerCase();
          if (st === 'vendido' || st === 'sold' || st === 'inactivo' || st === 'inactive') return false;
          if ((l.animal_count || 0) <= 0) return false;
          return true;
        });
        const activos = valid.filter(l => !isCuarentenaLot(l));
        const cuarentena = valid.filter(l => isCuarentenaLot(l));
        const fmt = (l) => '• *' + l.code + '* — ' + (l.animal_count || 0) + ' cab' +
          (l.paddock ? ' en ' + l.paddock : '');
        if (activos.length === 0 && cuarentena.length === 0) return '';
        const sections = [];
        if (activos.length > 0) sections.push('*LOTES ACTIVOS:*\n' + activos.map(fmt).join('\n'));
        if (cuarentena.length > 0) sections.push('*EN CUARENTENA:*\n' + cuarentena.map(fmt).join('\n'));
        return sections.join('\n\n');
      } catch(e) { return ''; }
    };

    if (salProducts.length === 0) {
      return res.json({
        ok: false,
        count: 0,
        message: '⚠ *No hay productos de sal cargados en stock.* Creá uno primero desde la app Desktop (Stock → Nuevo producto → categoría Sal y suplementos).',
        products: []
      });
    }
    if (salProducts.length === 1) {
      const p = salProducts[0];
      // v4.5.9: incluir listado de lotes activos para que el usuario elija sin tener que memorizar
      const lotsList = await _buildActiveLotsList();
      const lotsBlock = lotsList ? '\n\n' + lotsList : '';
      return res.json({
        ok: true,
        count: 1,
        auto_selected: true,
        product: { id: p.id, name: p.name, unit: p.unit || 'kg', stock: p.stock_qty || 0 },
        message: 'Usando *' + p.name + '* (stock disponible: ' + (p.stock_qty || 0) + ' ' + (p.unit || 'kg') + ').' +
                 lotsBlock +
                 '\n\n¿Para qué lote y cuántos ' + (p.unit || 'kg') + ' depositaste?'
      });
    }
    // varios: listar productos para que el bot pregunte (los lotes los preguntará después)
    return res.json({
      ok: true,
      count: salProducts.length,
      auto_selected: false,
      products: salProducts.map(p => ({ id: p.id, name: p.name, unit: p.unit || 'kg', stock: p.stock_qty || 0 })),
      message: '*Tenés ' + salProducts.length + ' productos de sal en stock:*\n' +
               salProducts.map((p, i) => '  ' + (i+1) + '. *' + p.name + '* (' + (p.stock_qty || 0) + ' ' + (p.unit || 'kg') + ' disponibles)').join('\n') +
               '\n\n¿Cuál usaste?'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.use('/api/sal',              auth, _normalizeLotCodeMiddleware, _inferPaddockMiddleware, _defaultSalTipoMiddleware, makeCRUD('sal'));
app.use('/api/conteo',           auth, _normalizeLotCodeMiddleware, _inferPaddockMiddleware, makeCRUD('conteo'));
app.use('/api/partos',           auth, _normalizeLotCodeMiddleware, _inferPaddockMiddleware, makeCRUD('partos'));
// v4.6.0: Reproducción V1 — tabla reproductive_services con tipo_servicio ('monta'|'IA'),
// soporta IA + monta + mixto, diagnóstico múltiple (tacto/eco/retorno_celo).
// Estructura por registro: { id, animal_id, tipo_servicio, toro_id?, semen_lote?, technician?,
//   lot_code, paddock, date, diagnosis_method?, diagnosis_date?, result, notes?, by, created_at, updated_at }
//
// NOTAS DE SYNC MULTI-FUENTE:
// - Fuentes: Desktop (REST + sync-push). PWA y Bot WhatsApp: NO en V1.
// - Patrón: idéntico al de sal/agua/partos pero sin descuento de stock.
// - Middleware _reproDefenderResurreccion: si Desktop hace POST con id ya en _deleted_ids,
//   rechaza con 410 Gone. Esto previene que sync-push individuales reactiven registros
//   borrados desde otra fuente (cuando PWA/Bot se sumen en V2).
// - sync-push ya procesa esta tabla vía finalMergedRaw genérico (línea ~4810), pero solo
//   infiere paddock si está en ACTIVITY_TABLES_SYNCPUSH. Por eso lo agregamos abajo.
async function _reproDefenderResurreccion(req, res, next) {
  try {
    if (req.method !== 'POST' && req.method !== 'PUT') return next();
    const body = req.body || {};
    const id = body.id || (req.params && req.params.id);
    if (!id) return next();
    const deletedIdsRaw = await getTable(req.tenantId, '_deleted_ids');
    const deletedMap = (deletedIdsRaw && typeof deletedIdsRaw === 'object' && !Array.isArray(deletedIdsRaw)) ? deletedIdsRaw : {};
    if (deletedMap['reproductive_services:' + String(id)]) {
      console.warn(`[reproductive-services] RESURRECCIÓN BLOQUEADA: id=${id} tenant=${req.tenantId} (estaba en _deleted_ids)`);
      return res.status(410).json({ error: 'Record was deleted, cannot reactivate', id: id });
    }
    next();
  } catch(e) {
    console.error('[reproductive-services] _reproDefenderResurreccion error:', e.message);
    next(); // fail-open: si el middleware falla, no bloqueamos el CRUD
  }
}
app.use('/api/reproductive-services', auth, _normalizeLotCodeMiddleware, _inferPaddockMiddleware, _reproDefenderResurreccion, makeCRUD('reproductive_services'));
app.use('/api/alimento',         auth, _normalizeLotCodeMiddleware, _inferPaddockMiddleware, makeCRUD('alimento'));

// ── Auto backup cada 24 horas ─────────────────────────────────
setInterval(async () => {
  try {
    const tenants = await pool.query('SELECT id, name FROM tenants WHERE active=true');
    for (const tenant of tenants.rows) {
      const tenantId = 'tenant_' + tenant.id;
      const tables = BACKUP_TABLES_FULL;  // v4.10.0: lista completa unificada
      const snapshot = { timestamp: new Date().toISOString(), tenant: tenant.name, tables: {} };
      for (const t of tables) { snapshot.tables[t] = await getTable(tenantId, t); }
      const snapshots = await getTable(tenantId, 'backup_snapshots');
      snapshots.push({ id: Date.now().toString(), created_at: new Date().toISOString(), size_kb: Math.round(JSON.stringify(snapshot).length / 1024), triggered_by: 'auto', data: snapshot });
      await setTable(tenantId, 'backup_snapshots', snapshots.sort((a,b) => b.created_at.localeCompare(a.created_at)).slice(0, 30));
    }
    console.log('[AutoBackup] Snapshots guardados para', tenants.rows.length, 'tenants');
  } catch(e) { console.error('[AutoBackup] Error:', e.message); }
}, 24 * 60 * 60 * 1000);

// ── Start ─────────────────────────────────────────────────────
initDB().then(() => {

// ── UPDATE GEMINI KEY FOR ALL TENANTS (admin only)
// ── ADMIN: Diagnóstico de tamaño de DB ─────────────────────────
// Devuelve breakdown completo: total DB, por tenant, por key, top rows pesados, fotos en base64.
app.get('/api/admin/db-diagnostics', adminAuth, async (req, res) => {
  try {
    const out = {};

    // 1) Tamaño total de la DB
    const dbSize = await pool.query(`SELECT pg_database_size(current_database()) AS bytes, pg_size_pretty(pg_database_size(current_database())) AS pretty`);
    out.database = dbSize.rows[0];

    // 2) Tamaño por tabla (incluye índices y TOAST)
    const tableSizes = await pool.query(`
      SELECT
        c.relname AS table_name,
        pg_total_relation_size(c.oid) AS total_bytes,
        pg_size_pretty(pg_total_relation_size(c.oid)) AS total_pretty,
        pg_relation_size(c.oid) AS data_bytes,
        pg_size_pretty(pg_relation_size(c.oid)) AS data_pretty,
        pg_indexes_size(c.oid) AS index_bytes,
        pg_size_pretty(pg_indexes_size(c.oid)) AS index_pretty,
        c.reltuples::bigint AS rows
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r' AND n.nspname = 'public'
      ORDER BY pg_total_relation_size(c.oid) DESC
    `);
    out.tables = tableSizes.rows;

    // 3) Detalle por (tenant_id, key) en store: tamaño JSONB + array length + has_photos
    const storeBreakdown = await pool.query(`
      SELECT
        s.tenant_id,
        s.key,
        pg_column_size(s.value) AS bytes,
        CASE WHEN jsonb_typeof(s.value) = 'array' THEN jsonb_array_length(s.value) ELSE 0 END AS array_len,
        s.updated_at,
        t.name AS tenant_name
      FROM store s
      LEFT JOIN tenants t ON ('tenant_' || t.id) = s.tenant_id
      ORDER BY pg_column_size(s.value) DESC
      LIMIT 60
    `);
    out.top_keys = storeBreakdown.rows.map(r => ({
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_name || '?',
      key: r.key,
      bytes: parseInt(r.bytes, 10),
      bytes_pretty: humanBytes(parseInt(r.bytes, 10)),
      array_len: parseInt(r.array_len, 10),
      avg_per_record: r.array_len > 0 ? humanBytes(Math.round(r.bytes / r.array_len)) : '—',
      updated_at: r.updated_at
    }));

    // 4) Resumen por tenant: cuánto pesa cada uno
    const tenantBreakdown = await pool.query(`
      SELECT
        s.tenant_id,
        t.name AS tenant_name,
        SUM(pg_column_size(s.value)) AS total_bytes,
        COUNT(*) AS keys
      FROM store s
      LEFT JOIN tenants t ON ('tenant_' || t.id) = s.tenant_id
      GROUP BY s.tenant_id, t.name
      ORDER BY total_bytes DESC
    `);
    out.by_tenant = tenantBreakdown.rows.map(r => ({
      tenant_id: r.tenant_id,
      tenant_name: r.tenant_name || '?',
      bytes: parseInt(r.total_bytes, 10),
      bytes_pretty: humanBytes(parseInt(r.total_bytes, 10)),
      keys: parseInt(r.keys, 10)
    }));

    // 5) Detección de fotos base64: cuenta records con photo_base64 / photo_data por key
    // Recorremos las keys más pesadas y buscamos campos típicos de fotos
    const photoFields = ['photo_base64', 'photos', 'image_base64', 'invoice_image', 'comprobante', 'photo_data'];
    const photoStats = [];
    for (const row of storeBreakdown.rows.slice(0, 30)) {
      if (parseInt(row.array_len, 10) === 0) continue;
      // Query: contar records con campos de foto y suma de bytes de esos campos
      try {
        const photoQuery = await pool.query(`
          SELECT
            COUNT(*) FILTER (WHERE elem ? 'photo_base64' OR elem ? 'photos' OR elem ? 'image_base64' OR elem ? 'invoice_image' OR elem ? 'comprobante' OR elem ? 'photo_data') AS records_with_photos,
            COALESCE(SUM(
              COALESCE(LENGTH(elem->>'photo_base64'), 0) +
              COALESCE(LENGTH(elem->>'image_base64'), 0) +
              COALESCE(LENGTH(elem->>'invoice_image'), 0) +
              COALESCE(LENGTH(elem->>'comprobante'), 0) +
              COALESCE(LENGTH(elem->>'photo_data'), 0) +
              COALESCE(pg_column_size(elem->'photos'), 0)
            ), 0) AS photo_bytes,
            COUNT(*) AS total_records
          FROM store, jsonb_array_elements(value) elem
          WHERE tenant_id = $1 AND key = $2 AND jsonb_typeof(value) = 'array'
        `, [row.tenant_id, row.key]);
        const ps = photoQuery.rows[0];
        const recordsWithPhotos = parseInt(ps.records_with_photos, 10);
        const photoBytes = parseInt(ps.photo_bytes, 10);
        if (recordsWithPhotos > 0 || photoBytes > 0) {
          photoStats.push({
            tenant_id: row.tenant_id,
            tenant_name: row.tenant_name || '?',
            key: row.key,
            records_with_photos: recordsWithPhotos,
            total_records: parseInt(ps.total_records, 10),
            photo_bytes: photoBytes,
            photo_bytes_pretty: humanBytes(photoBytes),
            photos_pct_of_key: row.bytes > 0 ? Math.round(photoBytes / parseInt(row.bytes, 10) * 100) : 0
          });
        }
      } catch(e) {
        // Si la key no es array de objetos, ignorar
      }
    }
    out.photos = photoStats.sort((a,b) => b.photo_bytes - a.photo_bytes);

    // 6) Bloat de tabla (espacio reclamable con VACUUM FULL)
    const bloat = await pool.query(`
      SELECT
        relname,
        n_dead_tup,
        n_live_tup,
        ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
        last_vacuum,
        last_autovacuum
      FROM pg_stat_user_tables
      WHERE n_dead_tup > 0
      ORDER BY n_dead_tup DESC
      LIMIT 10
    `);
    out.bloat = bloat.rows;

    res.json(out);
  } catch(e) {
    res.status(500).json({ error: e.message, stack: e.stack });
  }
});

// Helper para formatear bytes
function humanBytes(b) {
  if (!b || isNaN(b)) return '0 B';
  const units = ['B','KB','MB','GB'];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++; }
  return b.toFixed(1) + ' ' + units[i];
}

// ── ADMIN: Vacuum + reindex (libera espacio reclamable) ───────
// v4.5.2: dedupe de rotation_history — para limpiar entries duplicadas abiertas
// que pudieron generarse por races de sync o bugs del cliente (ej. v1.4.105 Desktop).
// Estrategia: para cada (lot_code|potrero) con >1 entry abierta (exit_date=null),
// preservar la MÁS VIEJA por entry_at, borrar el resto.
//
// Uso:
//   POST /api/admin/dedupe-rotation-history          → todos los tenants
//   POST /api/admin/dedupe-rotation-history?tenant=1 → solo tenant 1
//   POST /api/admin/dedupe-rotation-history?dry=1    → simular sin escribir
app.post('/api/admin/dedupe-rotation-history', adminAuth, async (req, res) => {
  try {
    const targetTenant = req.query.tenant;
    const dryRun = req.query.dry === '1';
    const results = {};

    let tenants;
    if (targetTenant) {
      tenants = [{ id: parseInt(targetTenant, 10) }];
    } else {
      const r = await pool.query('SELECT id FROM tenants ORDER BY id');
      tenants = r.rows;
    }

    for (const t of tenants) {
      const tenantId = t.id;
      let history = await getTable(tenantId, 'rotation_history');
      if (!Array.isArray(history)) history = [];

      // Agrupar entries abiertas por (lot_code|potrero)
      const groups = {};
      history.forEach(r => {
        if (!r || r.exit_date) return;
        const key = String(r.lot_code) + '|' + String(r.potrero);
        if (!groups[key]) groups[key] = [];
        groups[key].push(r);
      });

      const toRemoveIds = [];
      const detail = [];
      Object.keys(groups).forEach(key => {
        if (groups[key].length <= 1) return;
        // Ordenar por entry_at ASC, la más vieja primero
        groups[key].sort((a, b) => String(a.entry_at || a.entry_date || '').localeCompare(String(b.entry_at || b.entry_date || '')));
        const keep = groups[key][0];
        for (let i = 1; i < groups[key].length; i++) {
          toRemoveIds.push(groups[key][i].id);
          detail.push({
            key,
            kept_id: keep.id,
            kept_entry_at: keep.entry_at,
            removed_id: groups[key][i].id,
            removed_entry_at: groups[key][i].entry_at,
            removed_source: groups[key][i].source || '?'
          });
        }
      });

      if (toRemoveIds.length > 0 && !dryRun) {
        const cleaned = history.filter(r => !toRemoveIds.includes(r.id));
        await setTable(tenantId, 'rotation_history', cleaned);
      }

      results[tenantId] = {
        removed: toRemoveIds.length,
        keysWithDupes: Object.keys(groups).filter(k => groups[k].length > 1).length,
        totalBefore: history.length,
        totalAfter: history.length - toRemoveIds.length,
        detail
      };
      console.log(`[dedupe-rotation-history] tenant=${tenantId} removed=${toRemoveIds.length} dry=${dryRun}`);
    }

    res.json({ ok: true, dryRun, results });
  } catch(e) {
    console.error('[dedupe-rotation-history]', e);
    res.status(500).json({ error: e.message });
  }
});

// v4.5.1: backfill de rotation_history para todos los lotes activos con paddock asignado
// pero sin entry abierta correspondiente. Idempotente — corre seguro varias veces.
// Per-tenant o all-tenants según query param.
//
// Uso:
//   POST /api/admin/backfill-rotation-history          → todos los tenants
//   POST /api/admin/backfill-rotation-history?tenant=1 → solo tenant 1
//   POST /api/admin/backfill-rotation-history?dry=1    → simular sin escribir
app.post('/api/admin/backfill-rotation-history', adminAuth, async (req, res) => {
  try {
    const targetTenant = req.query.tenant;
    const dryRun = req.query.dry === '1';
    const results = {};

    // Lista de tenants a procesar
    let tenants;
    if (targetTenant) {
      tenants = [{ id: parseInt(targetTenant, 10) }];
    } else {
      const r = await pool.query('SELECT id FROM tenants ORDER BY id');
      tenants = r.rows;
    }

    for (const t of tenants) {
      const tenantId = t.id;
      const lots = await getTable(tenantId, 'lots') || [];
      let history = await getTable(tenantId, 'rotation_history');
      if (!Array.isArray(history)) history = [];

      let created = 0;
      let alreadyOk = 0;
      let skipped = 0;
      const detail = [];

      for (const lot of lots) {
        if (!lot || !lot.code) { skipped++; continue; }
        const status = String(lot.status || '').toLowerCase();
        if (status === 'vendido' || status === 'sold' || status === 'inactivo' || status === 'inactive') { skipped++; continue; }
        if ((lot.animal_count || 0) === 0) { skipped++; continue; }
        if (!lot.paddock) { skipped++; continue; }

        const hasOpenEntry = history.some(r =>
          r && r.lot_code === lot.code && r.potrero === lot.paddock && !r.exit_date
        );
        if (hasOpenEntry) { alreadyOk++; continue; }

        const entryDate = (lot.cost_origin && lot.cost_origin.date) || lot.entry_date || new Date().toISOString().slice(0,10);
        const entryAt = (lot.cost_origin && lot.cost_origin.date) ? (lot.cost_origin.date + 'T00:00:00.000Z') : (lot.entry_date ? lot.entry_date + 'T00:00:00.000Z' : new Date().toISOString());

        if (!dryRun) {
          history.push({
            id: Date.now() + Math.random() * 1000,
            lot_code: lot.code,
            potrero: lot.paddock,
            from_potrero: '',
            entry_date: entryDate,
            entry_at: entryAt,
            exit_date: null,
            exit_at: null,
            days_occupied: 0,
            cabezas: lot.animal_count || 0,
            reason: 'backfill v4.5.1',
            by: 'admin-backfill',
            source: 'backfill'
          });
        }
        created++;
        detail.push({ lot_code: lot.code, paddock: lot.paddock, entry_date: entryDate, cabezas: lot.animal_count });
      }

      if (created > 0 && !dryRun) {
        await setTable(tenantId, 'rotation_history', history);
      }

      results[tenantId] = { created, alreadyOk, skipped, total: lots.length, detail };
      console.log(`[backfill-rotation-history] tenant=${tenantId} created=${created} alreadyOk=${alreadyOk} skipped=${skipped} dry=${dryRun}`);
    }

    res.json({ ok: true, dryRun, results });
  } catch(e) {
    console.error('[backfill-rotation-history]', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/db-vacuum', adminAuth, async (req, res) => {
  try {
    // VACUUM FULL bloquea la tabla — solo recomendable en off-hours
    // VACUUM (ANALYZE) sin FULL es seguro y suele bastar
    const full = req.query.full === '1';
    const includeN8n = req.query.n8n === '1';
    const purgeOldExecutions = req.query.purge_executions; // formato: '7d', '14d', '30d' o vacío
    const results = [];

    // Tamaño antes
    const sizeBefore = await pool.query('SELECT pg_database_size(current_database()) AS bytes, pg_size_pretty(pg_database_size(current_database())) AS pretty');

    // Si pidió purgar ejecuciones viejas, hacerlo ANTES del vacuum
    if (purgeOldExecutions) {
      const m = String(purgeOldExecutions).match(/^(\d+)d?$/);
      const days = m ? parseInt(m[1], 10) : 7;
      // Borrar ejecuciones de más de N días (chequea ambos posibles nombres de columna)
      try {
        // n8n moderno: execution_entity tiene "startedAt" (camelCase)
        const delExecEnt = await pool.query(
          `DELETE FROM execution_entity WHERE "startedAt" < NOW() - ($1 || ' days')::interval`,
          [String(days)]
        );
        results.push({ step: `DELETE execution_entity > ${days}d`, rows: delExecEnt.rowCount });

        // execution_data se borra por FK cascade en versiones recientes; si no:
        const delExecData = await pool.query(
          `DELETE FROM execution_data WHERE "executionId" NOT IN (SELECT id FROM execution_entity)`
        );
        results.push({ step: 'DELETE execution_data huérfana', rows: delExecData.rowCount });
      } catch(e) {
        results.push({ step: 'DELETE execution_entity', error: e.message });
      }
    }

    // Lista de tablas a hacer vacuum
    const tablesToVacuum = ['store', 'tenants'];
    if (includeN8n) {
      // Solo las que sabemos que existen y son grandes
      const n8nTables = ['execution_data', 'execution_entity', 'workflow_history', 'workflow_publish_history', 'workflow_entity', 'workflows_tags'];
      // Verificar cuáles existen antes de tirarles vacuum
      const existRes = await pool.query(
        `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1)`,
        [n8nTables]
      );
      const existing = existRes.rows.map(r => r.tablename);
      tablesToVacuum.push(...existing);
    }

    // Ejecutar vacuum
    for (const tbl of tablesToVacuum) {
      try {
        if (full) {
          await pool.query(`VACUUM FULL ${tbl}`);
          results.push({ step: `VACUUM FULL ${tbl}`, ok: true });
        } else {
          await pool.query(`VACUUM (ANALYZE) ${tbl}`);
          results.push({ step: `VACUUM ANALYZE ${tbl}`, ok: true });
        }
      } catch(e) {
        results.push({ step: `VACUUM ${tbl}`, error: e.message });
      }
    }

    // Tamaño después
    const sizeAfter = await pool.query('SELECT pg_database_size(current_database()) AS bytes, pg_size_pretty(pg_database_size(current_database())) AS pretty');
    const bytesBefore = parseInt(sizeBefore.rows[0].bytes, 10);
    const bytesAfter = parseInt(sizeAfter.rows[0].bytes, 10);
    const freed = bytesBefore - bytesAfter;

    res.json({
      ok: true,
      mode: full ? 'FULL (bloqueante)' : 'standard',
      include_n8n: includeN8n,
      tables_processed: tablesToVacuum,
      steps: results,
      size_before: sizeBefore.rows[0].pretty,
      size_after: sizeAfter.rows[0].pretty,
      bytes_freed: freed,
      bytes_freed_pretty: humanBytes(freed),
      note: full
        ? 'Espacio físico reclamado al SO (FULL)'
        : 'Espacio liberado para reuso interno. Usar ?full=1 para reclamar al SO.'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── ADMIN: Eliminar fotos base64 viejas de un tenant/key ──────
// Útil para limpieza puntual cuando ya tenés un blob storage externo o no necesitás históricos
// ── ADMIN: Borrar registro puntual de una tabla del store (cleanup directo) ──
app.post('/api/admin/delete-record', adminAuth, async (req, res) => {
  try {
    const { tenant_id, table, record_id } = req.body;
    if (!tenant_id || !table || record_id === undefined) {
      return res.status(400).json({ error: 'Falta tenant_id, table o record_id' });
    }
    const result = await pool.query('SELECT value FROM store WHERE tenant_id=$1 AND key=$2', [tenant_id, table]);
    if (!result.rows.length) return res.status(404).json({ error: 'Tabla no encontrada' });
    const data = result.rows[0].value;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'No es array' });
    const before = data.length;
    const filtered = data.filter(r => String(r && r.id) !== String(record_id));
    if (before === filtered.length) return res.status(404).json({ error: 'Registro no encontrado en el array' });
    await pool.query('UPDATE store SET value=$1, updated_at=NOW() WHERE tenant_id=$2 AND key=$3',
      [JSON.stringify(filtered), tenant_id, table]);
    // También registrar en deleted_ids (clave por tenant) para que clientes nuevos la respeten
    try {
      const delKey = '_deleted_ids';
      const delResult = await pool.query('SELECT value FROM store WHERE tenant_id=$1 AND key=$2', [tenant_id, delKey]);
      let delMap = (delResult.rows.length && delResult.rows[0].value) ? delResult.rows[0].value : {};
      if (!delMap || typeof delMap !== 'object' || Array.isArray(delMap)) delMap = {};
      const k = table + ':' + String(record_id);
      delMap[k] = Date.now();
      // Cap a 500 entries más recientes
      const keys = Object.keys(delMap);
      if (keys.length > 500) {
        keys.sort((a,b) => delMap[a] - delMap[b]);
        for (let i = 0; i < keys.length - 500; i++) delete delMap[keys[i]];
      }
      await pool.query(
        `INSERT INTO store(tenant_id, key, value, updated_at) VALUES($1, $2, $3, NOW())
         ON CONFLICT (tenant_id, key) DO UPDATE SET value = $3, updated_at = NOW()`,
        [tenant_id, delKey, JSON.stringify(delMap)]
      );
    } catch(e) { /* no crítico */ }
    // Loguear el delete via admin (acción manual del admin)
    try {
      await appendAuditLog(tenant_id, {
        action: 'delete',
        table: table,
        record_id: String(record_id),
        record_summary: 'Borrado manual via admin endpoint (' + table + ' #' + record_id + ')',
        user: 'admin',
        source: 'admin',
        ip: getClientIp(req),
        device_os: '',
        device_browser: '',
        app_version: '',
      });
    } catch(e) { /* no crítico */ }
    res.json({ ok: true, tenant_id, table, record_id, before, after: filtered.length });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── AUDIT LOG ENDPOINTS ────────────────────────────────────────
// Endpoint para que clientes (Desktop/PWA) envíen logs (autenticados con su token de tenant)
app.post('/api/audit/log', auth, async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { action, table, record_id, record_summary, user, app_version, diff } = req.body;
    if (!action || !table) return res.status(400).json({ error: 'action y table son requeridos' });
    // Source y device data se infieren del header (igual que en auth middleware)
    const ua = req.headers['user-agent'] || '';
    const parsed = parseUserAgent(ua);
    const source = (req.headers['x-app-type'] === 'pwa') ? 'pwa' : 'desktop';
    const ip = getClientIp(req);
    let geo = null;
    if (ip) {
      try { geo = await Promise.race([lookupGeo(ip), new Promise(r => setTimeout(() => r(null), 1500))]); } catch(e) {}
    }
    await appendAuditLog(tenantId, {
      action: action,
      table: table,
      record_id: record_id ? String(record_id) : '',
      record_summary: record_summary || '',
      user: user || '',
      source: source,
      device_os: parsed.os + (parsed.os_version ? ' ' + parsed.os_version : ''),
      device_browser: parsed.browser + (parsed.browser_major ? ' ' + parsed.browser_major : ''),
      ip: ip || '',
      geo_city: (geo && geo.city) ? geo.city : '',
      app_version: app_version || req.headers['x-app-version'] || '',
      diff: diff || null,
    });
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint admin para listar logs (con filtros)
app.get('/api/admin/audit-logs', adminAuth, async (req, res) => {
  try {
    const { tenant_id, table, action, user, source, from, to, limit, offset } = req.query;
    const limitN = parseInt(limit) || 200;
    const offsetN = parseInt(offset) || 0;

    let allLogs = [];
    if (tenant_id) {
      const logs = await getTable(tenant_id, 'audit_logs');
      if (Array.isArray(logs)) {
        allLogs = logs.map(l => ({ ...l, tenant_id }));
      }
    } else {
      // Buscar logs de TODOS los tenants
      const tenants = await pool.query('SELECT id FROM tenants WHERE active=true');
      for (const t of tenants.rows) {
        const tid = 'tenant_' + t.id;
        const logs = await getTable(tid, 'audit_logs');
        if (Array.isArray(logs)) {
          logs.forEach(l => allLogs.push({ ...l, tenant_id: tid }));
        }
      }
    }

    // Aplicar filtros
    let filtered = allLogs;
    if (table) filtered = filtered.filter(l => l.table === table);
    if (action) filtered = filtered.filter(l => l.action === action);
    if (user) filtered = filtered.filter(l => (l.user || '').toLowerCase().indexOf(user.toLowerCase()) >= 0);
    if (source) filtered = filtered.filter(l => l.source === source);
    if (from) filtered = filtered.filter(l => l.ts >= from);
    if (to) filtered = filtered.filter(l => l.ts <= to);

    // Ordenar desc por ts
    filtered.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

    const total = filtered.length;
    const paginated = filtered.slice(offsetN, offsetN + limitN);
    res.json({ logs: paginated, total, offset: offsetN, limit: limitN });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint admin para CSV export
app.get('/api/admin/audit-logs/export', adminAuth, async (req, res) => {
  try {
    const { tenant_id, table, action, user, source, from, to } = req.query;
    let allLogs = [];
    if (tenant_id) {
      const logs = await getTable(tenant_id, 'audit_logs');
      if (Array.isArray(logs)) allLogs = logs.map(l => ({ ...l, tenant_id }));
    } else {
      const tenants = await pool.query('SELECT id FROM tenants WHERE active=true');
      for (const t of tenants.rows) {
        const tid = 'tenant_' + t.id;
        const logs = await getTable(tid, 'audit_logs');
        if (Array.isArray(logs)) logs.forEach(l => allLogs.push({ ...l, tenant_id: tid }));
      }
    }
    let filtered = allLogs;
    if (table) filtered = filtered.filter(l => l.table === table);
    if (action) filtered = filtered.filter(l => l.action === action);
    if (user) filtered = filtered.filter(l => (l.user || '').toLowerCase().indexOf(user.toLowerCase()) >= 0);
    if (source) filtered = filtered.filter(l => l.source === source);
    if (from) filtered = filtered.filter(l => l.ts >= from);
    if (to) filtered = filtered.filter(l => l.ts <= to);
    filtered.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

    // CSV
    const headers = ['Fecha', 'Tenant', 'Acción', 'Tabla', 'ID Registro', 'Resumen', 'Usuario', 'Origen', 'OS', 'Browser', 'IP', 'Ciudad', 'Versión App', 'Diff'];
    const rows = filtered.map(l => [
      l.ts || '',
      l.tenant_id || '',
      l.action || '',
      l.table || '',
      l.record_id || '',
      (l.record_summary || '').replace(/"/g, '""'),
      l.user || '',
      l.source || '',
      l.device_os || '',
      l.device_browser || '',
      l.ip || '',
      l.geo_city || '',
      l.app_version || '',
      l.diff ? JSON.stringify(l.diff).replace(/"/g, '""') : '',
    ]);
    const csv = '\ufeff' + headers.join(',') + '\n' + rows.map(r => r.map(c => {
      const s = String(c == null ? '' : c);
      return /[",\n]/.test(s) ? '"' + s + '"' : s;
    }).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit_logs_' + new Date().toISOString().slice(0,10) + '.csv"');
    res.send(csv);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
// ADMIN SNAPSHOTS — gestión completa desde dashboard SG
// Permite crear/listar/restaurar/borrar/descargar snapshots de cualquier tenant
// sin necesidad de tener su token. Solo requiere ADMIN_TOKEN.
// ════════════════════════════════════════════════════════════

const ADMIN_SNAPSHOT_TABLES = BACKUP_TABLES_FULL;  // v4.10.0: unificado (antes le faltaba reproductive_services)
const ADMIN_SNAPSHOT_LIMIT = 50;

async function _adminGetTenantById(id) {
  const result = await pool.query('SELECT id, name, plan, active FROM tenants WHERE id=$1', [parseInt(id)]);
  return result.rows[0] || null;
}

// Listar snapshots de un tenant
app.get('/api/admin/snapshots', adminAuth, async (req, res) => {
  try {
    const tenantNum = parseInt(req.query.tenant_id);
    if (!tenantNum) return res.status(400).json({ error: 'tenant_id requerido (numérico)' });
    const tenant = await _adminGetTenantById(tenantNum);
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
    const tenantId = 'tenant_' + tenant.id;

    const snapshots = await getTable(tenantId, 'backup_snapshots') || [];
    const list = snapshots
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .map(s => ({
        id: s.id,
        created_at: s.created_at,
        size_kb: s.size_kb,
        triggered_by: s.triggered_by,
        note: s.note || null
      }));
    const totalKb = list.reduce((sum, s) => sum + (s.size_kb || 0), 0);
    res.json({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      snapshots: list,
      total_count: list.length,
      total_size_kb: totalKb,
      max_allowed: ADMIN_SNAPSHOT_LIMIT
    });
  } catch(e) {
    console.error('[admin/snapshots] list error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Crear snapshot manual
app.post('/api/admin/snapshots/create', adminAuth, async (req, res) => {
  try {
    const tenantNum = parseInt(req.query.tenant_id || req.body.tenant_id);
    if (!tenantNum) return res.status(400).json({ error: 'tenant_id requerido' });
    const tenant = await _adminGetTenantById(tenantNum);
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
    const tenantId = 'tenant_' + tenant.id;
    const note = (req.body && req.body.note) ? String(req.body.note).slice(0, 200) : null;

    // Construir snapshot
    const snapshot = { timestamp: new Date().toISOString(), tenant: tenant.name, tables: {} };
    for (const t of ADMIN_SNAPSHOT_TABLES) {
      snapshot.tables[t] = await getTable(tenantId, t);
    }

    const snapshots = await getTable(tenantId, 'backup_snapshots') || [];
    const newSnap = {
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      size_kb: Math.round(JSON.stringify(snapshot).length / 1024),
      triggered_by: 'admin-manual',
      note: note,
      data: snapshot
    };
    snapshots.unshift(newSnap);

    // Aplicar límite
    const trimmed = snapshots
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, ADMIN_SNAPSHOT_LIMIT);

    await setTable(tenantId, 'backup_snapshots', trimmed);

    res.json({
      ok: true,
      id: newSnap.id,
      created_at: newSnap.created_at,
      size_kb: newSnap.size_kb,
      note: newSnap.note,
      total_count: trimmed.length
    });
  } catch(e) {
    console.error('[admin/snapshots] create error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Restaurar snapshot — crea snapshot safety automático antes
app.post('/api/admin/snapshots/:snap_id/restore', adminAuth, async (req, res) => {
  try {
    const tenantNum = parseInt(req.query.tenant_id || req.body.tenant_id);
    if (!tenantNum) return res.status(400).json({ error: 'tenant_id requerido' });
    const tenant = await _adminGetTenantById(tenantNum);
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
    const tenantId = 'tenant_' + tenant.id;
    const snapId = req.params.snap_id;

    // Doble confirmación: el body debe incluir el nombre del tenant exacto
    const confirmName = req.body && req.body.confirm_name ? String(req.body.confirm_name).trim() : '';
    if (confirmName !== tenant.name) {
      return res.status(400).json({
        error: 'confirm_name no coincide con el nombre del tenant',
        expected: tenant.name,
        received: confirmName || '(vacío)'
      });
    }

    const snapshots = await getTable(tenantId, 'backup_snapshots') || [];
    const snap = snapshots.find(s => s.id === snapId);
    if (!snap || !snap.data || !snap.data.tables) {
      return res.status(404).json({ error: 'Snapshot no encontrado o inválido' });
    }

    // 1. Crear snapshot de seguridad ANTES de restaurar (para rollback)
    const safetySnap = { timestamp: new Date().toISOString(), tenant: tenant.name, tables: {} };
    for (const t of ADMIN_SNAPSHOT_TABLES) {
      safetySnap.tables[t] = await getTable(tenantId, t);
    }
    const safetyEntry = {
      id: Date.now().toString(),
      created_at: new Date().toISOString(),
      size_kb: Math.round(JSON.stringify(safetySnap).length / 1024),
      triggered_by: 'pre-restore-safety',
      note: 'Auto: estado antes de restaurar snapshot ' + snapId,
      data: safetySnap
    };
    snapshots.unshift(safetyEntry);

    // 2. Aplicar el snapshot solicitado
    const tablesData = snap.data.tables;
    let restoredCount = 0;
    for (const tname of Object.keys(tablesData)) {
      // Saltar las metatablas
      if (tname === 'audit_logs' || tname === 'backup_snapshots' || tname === 'transaction_images' || tname === 'bot_session' || tname === 'sync_metadata') continue;
      try {
        await setTable(tenantId, tname, tablesData[tname]);
        restoredCount++;
      } catch(err) {
        console.warn('[admin/restore] error restoring table', tname, err.message);
      }
    }

    // 3. Limpiar _deleted_ids (ya no aplican al estado restaurado)
    try { await setTable(tenantId, '_deleted_ids', {}); } catch(e) {}

    // 4. Guardar snapshots con safety incluido (limpiando límite)
    const trimmed = snapshots
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, ADMIN_SNAPSHOT_LIMIT);
    await setTable(tenantId, 'backup_snapshots', trimmed);

    res.json({
      ok: true,
      restored_snapshot_id: snapId,
      restored_at: new Date().toISOString(),
      tables_restored: restoredCount,
      safety_snapshot_id: safetyEntry.id,
      safety_snapshot_created_at: safetyEntry.created_at
    });
  } catch(e) {
    console.error('[admin/snapshots] restore error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Borrar snapshot (no se puede borrar pre-restore-safety por seguridad)
app.delete('/api/admin/snapshots/:snap_id', adminAuth, async (req, res) => {
  try {
    const tenantNum = parseInt(req.query.tenant_id);
    if (!tenantNum) return res.status(400).json({ error: 'tenant_id requerido' });
    const tenant = await _adminGetTenantById(tenantNum);
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
    const tenantId = 'tenant_' + tenant.id;
    const snapId = req.params.snap_id;

    const snapshots = await getTable(tenantId, 'backup_snapshots') || [];
    const target = snapshots.find(s => s.id === snapId);
    if (!target) return res.status(404).json({ error: 'Snapshot no encontrado' });

    // Permitir forzar borrado de safety con query param ?force=1
    const force = req.query.force === '1';
    if (target.triggered_by === 'pre-restore-safety' && !force) {
      return res.status(403).json({
        error: 'No se puede borrar snapshot de seguridad sin ?force=1',
        hint: 'Estos snapshots son creados automáticamente antes de restaurar. Usá ?force=1 para confirmar.'
      });
    }

    const filtered = snapshots.filter(s => s.id !== snapId);
    await setTable(tenantId, 'backup_snapshots', filtered);

    res.json({ ok: true, deleted_id: snapId, remaining: filtered.length });
  } catch(e) {
    console.error('[admin/snapshots] delete error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Descargar snapshot completo como JSON
app.get('/api/admin/snapshots/:snap_id/download', adminAuth, async (req, res) => {
  try {
    const tenantNum = parseInt(req.query.tenant_id);
    if (!tenantNum) return res.status(400).json({ error: 'tenant_id requerido' });
    const tenant = await _adminGetTenantById(tenantNum);
    if (!tenant) return res.status(404).json({ error: 'Tenant no encontrado' });
    const tenantId = 'tenant_' + tenant.id;
    const snapId = req.params.snap_id;

    const snapshots = await getTable(tenantId, 'backup_snapshots') || [];
    const snap = snapshots.find(s => s.id === snapId);
    if (!snap) return res.status(404).json({ error: 'Snapshot no encontrado' });

    const filename = 'snapshot_tenant_' + tenant.id + '_' + snapId + '.json';
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.json({
      meta: {
        snapshot_id: snap.id,
        created_at: snap.created_at,
        size_kb: snap.size_kb,
        triggered_by: snap.triggered_by,
        note: snap.note,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        downloaded_at: new Date().toISOString()
      },
      data: snap.data
    });
  } catch(e) {
    console.error('[admin/snapshots] download error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ════════════════════════════════════════════════════════════
// fin ADMIN SNAPSHOTS
// ════════════════════════════════════════════════════════════

app.post('/api/admin/strip-photos', adminAuth, async (req, res) => {
  try {
    const { tenant_id, key, before_date } = req.body;
    if (!tenant_id || !key) return res.status(400).json({ error: 'Falta tenant_id o key' });

    // Obtener data actual
    const result = await pool.query('SELECT value FROM store WHERE tenant_id=$1 AND key=$2', [tenant_id, key]);
    if (!result.rows.length) return res.status(404).json({ error: 'No existe el registro' });

    const data = result.rows[0].value;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'No es array' });

    let stripped = 0;
    let bytesFreed = 0;
    const cutoffDate = before_date ? new Date(before_date) : null;

    const photoFields = ['photo_base64', 'image_base64', 'invoice_image', 'comprobante', 'photo_data'];

    const cleaned = data.map(rec => {
      // Si hay filtro de fecha, respetar
      if (cutoffDate) {
        const recDate = new Date(rec.date || rec.fecha || rec.created_at || 0);
        if (recDate >= cutoffDate) return rec; // demasiado nuevo, conservar
      }
      const newRec = { ...rec };
      photoFields.forEach(f => {
        if (newRec[f] && typeof newRec[f] === 'string' && newRec[f].length > 100) {
          bytesFreed += newRec[f].length;
          delete newRec[f];
          newRec.has_photo_legacy = true;  // marcador: tenía foto pero se removió
          stripped++;
        }
      });
      // photos[] como array
      if (Array.isArray(newRec.photos) && newRec.photos.length) {
        const totalLen = newRec.photos.reduce((s, p) => s + (typeof p === 'string' ? p.length : 0), 0);
        if (totalLen > 100) {
          bytesFreed += totalLen;
          delete newRec.photos;
          newRec.has_photos_legacy = newRec.photos ? newRec.photos.length : true;
          stripped++;
        }
      }
      return newRec;
    });

    await pool.query('UPDATE store SET value=$1, updated_at=NOW() WHERE tenant_id=$2 AND key=$3', [JSON.stringify(cleaned), tenant_id, key]);
    res.json({
      ok: true,
      tenant_id, key,
      records_total: data.length,
      records_stripped: stripped,
      bytes_freed: bytesFreed,
      bytes_freed_pretty: humanBytes(bytesFreed),
      note: 'Recordá correr VACUUM (FULL) para reclamar espacio físico'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DEPRECATED: /api/admin/set-gemini-key ──
// La Gemini key ahora vive en env SG_GEMINI_KEY del server.
// Los clientes viejos (Desktop v1.4.26 o menor, PWA v9.7.0 o menor) llaman a este
// endpoint al guardar la key — devolvemos 410 Gone para que sepan que hay que actualizar.
// Eliminar este stub en ~3 meses cuando todos los clientes hayan actualizado.
app.post('/api/admin/set-gemini-key', (req, res) => {
  res.status(410).json({
    error: 'Endpoint deprecado',
    message: 'La gestión de Gemini key se centraliza en SG Bolivia. Actualizá tu app para que las funciones de IA pasen por el proxy.',
    deprecated_at: '2026-05-09',
    upgrade_required: true
  });
});

// ── PROXY DE IA (Gemini) ──────────────────────────────────────────
// Reemplaza llamadas directas del cliente a Gemini API.
// La SG_GEMINI_KEY vive solo en env del server, nunca llega al cliente.
//
// POST /api/ai/generate
// Authorization: Bearer <tenant_token>
// Body: { contents, generationConfig?, system_instruction? }  ← Mismo formato que Gemini API
// Response: la respuesta de Gemini textual + metadata
//
// Rate limiting global: cuando Google avisa que la cuota se acaba (HTTP 429 o RESOURCE_EXHAUSTED),
// marcamos la key como "agotada" y devolvemos 503 a todos los clientes hasta el día siguiente.
//
// Log: cada llamada exitosa se registra en `ai_usage_log` por tenant.

let _aiQuotaExhaustedUntil = 0; // timestamp ms; si Date.now() < esto, devolvemos 503

app.post('/api/ai/generate', auth, async (req, res) => {
  try {
    // 1. Validar SG_GEMINI_KEY configurada
    if (!SG_GEMINI_KEY) {
      return res.status(503).json({
        error: 'IA temporalmente no disponible',
        code: 'AI_NOT_CONFIGURED'
      });
    }

    // 2. Validar circuit breaker de cuota
    if (Date.now() < _aiQuotaExhaustedUntil) {
      const minsLeft = Math.ceil((_aiQuotaExhaustedUntil - Date.now()) / 60000);
      return res.status(503).json({
        error: 'IA temporalmente no disponible',
        code: 'AI_QUOTA_EXHAUSTED',
        retry_after_min: minsLeft
      });
    }

    // 3. Validar body
    const { contents, generationConfig, system_instruction } = req.body;
    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return res.status(400).json({ error: 'contents requerido (array)' });
    }

    // Modelo configurable, default flash
    const model = req.body.model || 'gemini-2.5-flash';
    if (!/^gemini-[a-z0-9.-]+$/i.test(model)) {
      return res.status(400).json({ error: 'modelo inválido' });
    }

    // 4. Llamar a Gemini con la key del server
    const geminiBody = { contents };
    if (generationConfig) geminiBody.generationConfig = generationConfig;
    if (system_instruction) geminiBody.system_instruction = system_instruction;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${SG_GEMINI_KEY}`;
    const startMs = Date.now();
    const resp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody)
    });
    const data = await resp.json();
    const latencyMs = Date.now() - startMs;

    // 5. Detectar quota exhausted → activar circuit breaker (24h)
    if (resp.status === 429 || (data.error && data.error.status === 'RESOURCE_EXHAUSTED')) {
      _aiQuotaExhaustedUntil = Date.now() + 24 * 60 * 60 * 1000;
      console.error('[AI] Cuota Gemini agotada. Circuit breaker activado por 24h.');
      return res.status(503).json({
        error: 'IA temporalmente no disponible',
        code: 'AI_QUOTA_EXHAUSTED',
        retry_after_min: 1440
      });
    }

    // 6. Loggear uso (no bloqueante: si falla, no rompe la respuesta)
    try {
      const usageMeta = data.usageMetadata || {};
      const logEntry = {
        ts: new Date().toISOString(),
        tenant_id: req.tenant.id,
        model,
        prompt_tokens: usageMeta.promptTokenCount || 0,
        response_tokens: usageMeta.candidatesTokenCount || 0,
        total_tokens: usageMeta.totalTokenCount || 0,
        latency_ms: latencyMs,
        status: resp.status,
        is_error: !!data.error
      };
      const logs = await getTable(req.tenantId, 'ai_usage_log') || [];
      logs.push(logEntry);
      // Mantener últimos 1000 entries por tenant
      if (logs.length > 1000) logs.splice(0, logs.length - 1000);
      await setTable(req.tenantId, 'ai_usage_log', logs);
    } catch (logErr) {
      console.warn('[AI] Error guardando log uso:', logErr.message);
    }

    // 7. Devolver la respuesta de Gemini tal cual (estructura idéntica a la API directa)
    res.status(resp.status).json(data);
  } catch (err) {
    console.error('[AI proxy] error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Endpoint admin: ver uso de IA por tenant ──
app.get('/api/admin/ai-usage', adminAuth, async (req, res) => {
  try {
    const tenantNum = req.query.tenant_id ? parseInt(req.query.tenant_id) : null;
    const tenants = tenantNum
      ? [{ id: tenantNum }]
      : (await pool.query('SELECT id FROM tenants ORDER BY id')).rows;

    const summary = [];
    for (const t of tenants) {
      const tenantId = 'tenant_' + t.id;
      const logs = await getTable(tenantId, 'ai_usage_log') || [];
      const last24h = logs.filter(l => Date.now() - new Date(l.ts).getTime() < 86400000);
      const last30d = logs.filter(l => Date.now() - new Date(l.ts).getTime() < 30 * 86400000);
      summary.push({
        tenant_id: t.id,
        total_requests: logs.length,
        requests_24h: last24h.length,
        requests_30d: last30d.length,
        tokens_24h: last24h.reduce((s, l) => s + (l.total_tokens || 0), 0),
        tokens_30d: last30d.reduce((s, l) => s + (l.total_tokens || 0), 0),
        last_use: logs.length ? logs[logs.length - 1].ts : null
      });
    }
    res.json({
      ai_quota_exhausted: Date.now() < _aiQuotaExhaustedUntil,
      ai_quota_resets_at: _aiQuotaExhaustedUntil ? new Date(_aiQuotaExhaustedUntil).toISOString() : null,
      tenants: summary
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Endpoint admin: resetear circuit breaker manualmente ──
app.post('/api/admin/ai-reset-quota', adminAuth, (req, res) => {
  _aiQuotaExhaustedUntil = 0;
  console.log('[AI] Circuit breaker reseteado manualmente');
  res.json({ ok: true, message: 'Quota reset' });
});

// ── Diagnóstico: ver qué envs están configuradas (sin exponer valores) ──
app.get('/api/admin/env-check', adminAuth, (req, res) => {
  res.json({
    ADMIN_TOKEN: !!ADMIN_TOKEN,
    BOT_SECRET: !!BOT_SECRET,
    SG_GEMINI_KEY: !!SG_GEMINI_KEY,
    DATABASE_URL: !!process.env.DATABASE_URL,
    SMTP_HOST: !!SMTP_HOST,
    SMTP_PORT: SMTP_PORT,
    SMTP_USER: !!SMTP_USER,
    SMTP_PASS: !!SMTP_PASS,
    SMTP_FROM: SMTP_FROM,  // Sí mostramos el valor, no es secreto
    NOTIFY_EMAIL: !!NOTIFY_EMAIL,
    smtp_transporter_ready: !!_smtpTransporter
  });
});

// ── Diagnóstico: probar envío de email ──
app.post('/api/admin/test-email', adminAuth, async (req, res) => {
  if (!_smtpTransporter) {
    return res.status(503).json({
      ok: false,
      error: 'SMTP no configurado. Verificar SMTP_HOST, SMTP_USER, SMTP_PASS en Railway env.'
    });
  }
  const result = await sendNotificationEmail({
    subject: '✅ Test EstanciaPro — Configuración SMTP OK',
    html: `<div style="font-family:sans-serif;padding:20px;max-width:500px">
      <h2 style="color:#10b981">✅ SMTP funcionando</h2>
      <p>Si recibís este email, la configuración SMTP de tu server está OK.</p>
      <p style="color:#666;font-size:13px">
        Servidor: ${SMTP_HOST}:${SMTP_PORT}<br>
        Remitente: ${SMTP_USER}<br>
        Destinatario: ${NOTIFY_EMAIL}<br>
        Timestamp: ${new Date().toISOString()}
      </p>
    </div>`,
    text: 'Test EstanciaPro - SMTP funcionando. Servidor: ' + SMTP_HOST + ':' + SMTP_PORT
  });
  res.json(result);
});

// ══════════════════════════════════════════════════════════════
// v4.5.11: ADMIN — Migración one-time de paddocks y lotes archivados
// ══════════════════════════════════════════════════════════════

// POST /api/admin/migrate-paddocks?tenant_id=1
// Recorre tablas sal/agua/alimento/conteo/partos del tenant
// Para cada registro sin paddock, infiere desde lot.paddock y lo guarda
// Devuelve reporte de qué actualizó
app.post('/api/admin/migrate-paddocks', adminAuth, async (req, res) => {
  try {
    const tenantIdNum = req.query.tenant_id || req.body.tenant_id;
    if (!tenantIdNum) return res.status(400).json({ error: 'tenant_id requerido' });
    // v4.5.11 fix: tenantId en este server tiene formato "tenant_N", no número raw
    const tenantId = 'tenant_' + tenantIdNum;

    const dryRun = req.query.dry_run === 'true' || req.body.dry_run === true;
    const lots = (await getTable(tenantId, 'lots')) || [];
    const lotPaddockMap = {};
    lots.forEach(l => { if (l && l.code && l.paddock) lotPaddockMap[l.code] = l.paddock; });

    const tablesToMigrate = ['sal', 'agua', 'alimento', 'conteo', 'partos'];
    const report = { tenant_id: tenantIdNum, tenant_id_internal: tenantId, dry_run: dryRun, tables: {} };

    for (const tableKey of tablesToMigrate) {
      const rows = (await getTable(tenantId, tableKey)) || [];
      let updated = 0, alreadyHadPaddock = 0, noLotMatch = 0, noLotCode = 0;
      const updatedRows = rows.map(r => {
        if (!r) return r;
        if (r.paddock && String(r.paddock).trim()) { alreadyHadPaddock++; return r; }
        if (!r.lot_code) { noLotCode++; return r; }
        const padd = lotPaddockMap[r.lot_code];
        if (padd) {
          updated++;
          return { ...r, paddock: padd, server_updated_at: new Date().toISOString() };
        }
        noLotMatch++;
        return r;
      });
      report.tables[tableKey] = {
        total: rows.length,
        updated,
        alreadyHadPaddock,
        noLotMatch,
        noLotCode
      };
      if (!dryRun && updated > 0) {
        await setTable(tenantId, tableKey, updatedRows);
      }
    }
    console.log(`[migrate-paddocks] tenant=${tenantId} dryRun=${dryRun}`, JSON.stringify(report.tables));
    res.json(report);
  } catch(e) {
    console.error('[migrate-paddocks]', e);
    res.status(500).json({ error: e.message });
  }
});

// v4.5.16: POST /api/admin/backfill-sal-tipo?tenant_id=1[&dry_run=true][&default=mineral]
// Recorre db.sal del tenant y setea tipo=default (por defecto 'mineral') para registros
// que tengan tipo null/undefined/vacío. Idempotente — no toca registros que ya tienen tipo.
// Devuelve reporte de cuántos actualizó.
app.post('/api/admin/backfill-sal-tipo', adminAuth, async (req, res) => {
  try {
    const tenantIdNum = req.query.tenant_id || req.body.tenant_id;
    if (!tenantIdNum) return res.status(400).json({ error: 'tenant_id requerido' });
    const tenantId = 'tenant_' + tenantIdNum;
    const dryRun = req.query.dry_run === 'true' || req.body.dry_run === true;
    const defaultTipo = String(req.query.default || req.body.default || 'mineral').trim() || 'mineral';

    const rows = (await getTable(tenantId, 'sal')) || [];
    let updated = 0, alreadyHadTipo = 0;
    const updatedRows = rows.map(r => {
      if (!r) return r;
      if (r.tipo && String(r.tipo).trim()) { alreadyHadTipo++; return r; }
      updated++;
      return { ...r, tipo: defaultTipo, server_updated_at: new Date().toISOString() };
    });

    const report = {
      tenant_id: tenantIdNum,
      tenant_id_internal: tenantId,
      dry_run: dryRun,
      default_tipo: defaultTipo,
      total: rows.length,
      updated,
      already_had_tipo: alreadyHadTipo
    };

    if (!dryRun && updated > 0) {
      await setTable(tenantId, 'sal', updatedRows);
    }

    console.log(`[backfill-sal-tipo] tenant=${tenantId} dryRun=${dryRun} default="${defaultTipo}" updated=${updated}/${rows.length}`);
    res.json(report);
  } catch(e) {
    console.error('[backfill-sal-tipo]', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/admin/create-archived-lots?tenant_id=1
// Detecta lot_codes huérfanos (mencionados en sal/agua/etc pero no en db.lots)
// Crea entradas en lots con status='archived' y placeholder
// Devuelve lista de lotes creados
app.post('/api/admin/create-archived-lots', adminAuth, async (req, res) => {
  try {
    const tenantIdNum = req.query.tenant_id || req.body.tenant_id;
    if (!tenantIdNum) return res.status(400).json({ error: 'tenant_id requerido' });
    // v4.5.11 fix: tenantId en este server tiene formato "tenant_N", no número raw
    const tenantId = 'tenant_' + tenantIdNum;
    const dryRun = req.query.dry_run === 'true' || req.body.dry_run === true;

    const lots = (await getTable(tenantId, 'lots')) || [];
    const lotCodesInLots = new Set(lots.map(l => l && l.code).filter(Boolean));

    // Buscar lot_codes huérfanos en todas las tablas con lot_code
    const tablesToScan = ['sal', 'agua', 'alimento', 'conteo', 'partos', 'pesajes', 'treatments'];
    const orphanCounts = {}; // { lot_code: { table: count } }

    for (const tableKey of tablesToScan) {
      const rows = (await getTable(tenantId, tableKey)) || [];
      rows.forEach(r => {
        if (!r || !r.lot_code) return;
        if (!lotCodesInLots.has(r.lot_code)) {
          if (!orphanCounts[r.lot_code]) orphanCounts[r.lot_code] = {};
          orphanCounts[r.lot_code][tableKey] = (orphanCounts[r.lot_code][tableKey] || 0) + 1;
        }
      });
    }

    // Crear lotes archivados
    const orphanCodes = Object.keys(orphanCounts);
    const newLots = orphanCodes.map(code => {
      const totalRefs = Object.values(orphanCounts[code]).reduce((a,b) => a+b, 0);
      return {
        id: `archived_${code}_${Date.now()}`,
        code: code,
        status: 'archived',
        paddock: '(archivado)',
        category: 'archivado',
        animal_count: 0,
        notes: `Lote archivado automáticamente v4.5.11. Tenía ${totalRefs} referencias en: ${Object.keys(orphanCounts[code]).join(', ')}.`,
        archived_at: new Date().toISOString(),
        archived_reason: 'orphan_references_v4_5_11',
        server_updated_at: new Date().toISOString()
      };
    });

    const report = {
      tenant_id: tenantIdNum,
      tenant_id_internal: tenantId,
      dry_run: dryRun,
      orphans_found: orphanCodes.length,
      lots_to_create: newLots.map(l => ({ code: l.code, refs: orphanCounts[l.code] })),
      details: orphanCounts
    };

    if (!dryRun && newLots.length > 0) {
      const updatedLots = [...lots, ...newLots];
      await setTable(tenantId, 'lots', updatedLots);
    }

    console.log(`[create-archived-lots] tenant=${tenantId} dryRun=${dryRun} orphans=${orphanCodes.length}`);
    res.json(report);
  } catch(e) {
    console.error('[create-archived-lots]', e);
    res.status(500).json({ error: e.message });
  }
});

  app.listen(PORT, () => { console.log(`[API] EstanciaPro v4.1 — Multi-tenant + Bot TX — Puerto ${PORT}`); });
}).catch(err => { console.error('[DB] Error:', err.message); process.exit(1); });

// ══════════════════════════════════════════════════════════════
// REPORTES AUTOMÁTICOS — Cron WhatsApp
// ══════════════════════════════════════════════════════════════
const META_WA_TOKEN = 'EAANy5Satj38BRAtLqqgStyQZB2hidjSQr6cDzbZBAPZBh5ZAq1HHxqZCnTuiZCQv5kZCnUKhbTyHnz1uZCMxIaHeNWjLA6KWAc7d8eDWGf41ZChbkevyGMnkHjMD6FVWiHPiZBH0INZA9vVGp7OZCZAqPZBZCoOCblMTK7xojrYQZD';
const META_PHONE_ID_REPORT = '1124983387355546';

async function sendWhatsAppText(to, text) {
  try {
    await fetch(`https://graph.facebook.com/v21.0/${META_PHONE_ID_REPORT}/messages`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + META_WA_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } })
    });
  } catch(e) { console.error('[Report] WA send error:', e.message); }
}

async function buildMorningReport(tenantId) {
  const [lots, products, bajas, diesel, tasks, employees, advances, maintenance, treatments, animals, diesel_tank, alerts] = await Promise.all([
    getTable(tenantId, 'lots'), getTable(tenantId, 'vet_products'), getTable(tenantId, 'bajas'),
    getTable(tenantId, 'diesel'), getTable(tenantId, 'tasks'), getTable(tenantId, 'employees'),
    getTable(tenantId, 'advances'), getTable(tenantId, 'maintenance'), getTable(tenantId, 'treatments'),
    getTable(tenantId, 'animals'), getTable(tenantId, 'diesel_tank'), getTable(tenantId, 'health_alerts')
  ]);

  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const monthKey = today.slice(0,7);
  const yearKey = today.slice(0,4);
  const dayName = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][now.getDay()];
  const activeLots = (lots||[]).filter(l => l.status !== 'sold' && (l.animal_count||0) > 0);
  const totalCab = activeLots.reduce((s,l) => s + (l.animal_count||0), 0);
  const bajasYear = (bajas||[]).filter(b => (b.fecha||'').startsWith(yearKey));
  const mortPct = totalCab > 0 ? (bajasYear.length / (totalCab + bajasYear.length) * 100).toFixed(1) : '0';

  let r = `☀️ *Buenos días. ${dayName} ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}*\n\n`;
  r += `📊 *${totalCab} cabezas* en ${activeLots.length} lotes\n`;
  r += `🪦 Mortandad ${yearKey}: ${bajasYear.length} bajas (${mortPct}%)\n`;

  // Tanks
  const tanks = Array.isArray(diesel_tank) ? diesel_tank : [];
  if (tanks.length) {
    r += `\n⛽ *Tanques:*\n`;
    tanks.forEach(t => {
      const pct = t.capacity ? Math.round((t.current_level||0)/t.capacity*100) : 0;
      const warn = pct < 25 ? ' ⚠️' : '';
      r += `  ${t.name}: ${t.current_level||0}/${t.capacity}L (${pct}%)${warn}\n`;
    });
  }

  // Stock bajo
  const lowStock = (products||[]).filter(p => (p.stock_qty||0) <= (p.stock_min||0));
  if (lowStock.length) {
    r += `\n💊 *Stock bajo:*\n`;
    lowStock.forEach(p => r += `  ⚠️ ${p.name}: ${p.stock_qty} ${p.unit||'ml'} (mín: ${p.stock_min})\n`);
  }

  // Tasks pending
  const pendTasks = (tasks||[]).filter(t => t.status === 'pendiente');
  if (pendTasks.length) {
    r += `\n📋 *${pendTasks.length} tareas pendientes:*\n`;
    pendTasks.slice(0,5).forEach(t => r += `  • ${t.title}${t.assignee?' → '+t.assignee:''}${t.due?' (vence: '+t.due+')':''}\n`);
  }

  // Unresolved alerts
  const activeAlerts = (alerts||[]).filter(a => !a.resolved);
  if (activeAlerts.length) {
    r += `\n⚠️ *${activeAlerts.length} alertas activas:*\n`;
    activeAlerts.slice(0,3).forEach(a => r += `  • ${a.title||a.desc||'Alerta'}\n`);
  }

  // Weather
  try {
    const rp = await getTable(tenantId, 'report_params') || {};
    const lat = rp.lat || -16.8696;
    const lon = rp.lon || -60.7774;
    const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=America/La_Paz&forecast_days=2`);
    const wx = await wxRes.json();
    if (wx.current) {
      const temp = Math.round(wx.current.temperature_2m);
      const hum = wx.current.relative_humidity_2m;
      const thi = Math.round(temp - (0.55 - 0.0055*hum)*(temp-14.5));
      r += `\n🌤️ *Clima:* ${temp}°C, Hum ${hum}%, THI ${thi}`;
      if (thi >= 72) r += ' ⚠️ Estrés calórico';
      r += '\n';
      if (wx.daily && wx.daily.precipitation_probability_max && wx.daily.precipitation_probability_max[1] > 30) {
        r += `🌧️ Mañana: ${wx.daily.precipitation_probability_max[1]}% prob. lluvia (${wx.daily.precipitation_sum[1]}mm)\n`;
      }
    }
  } catch(e) {}

  r += `\n_Reporte automático EstanciaPro_`;
  return r;
}

async function buildWeeklyReport(tenantId) {
  const [lots, products, bajas, diesel, tasks, employees, advances, maintenance, treatments, sales, agua, sal, partos, diesel_tank] = await Promise.all([
    getTable(tenantId, 'lots'), getTable(tenantId, 'vet_products'), getTable(tenantId, 'bajas'),
    getTable(tenantId, 'diesel'), getTable(tenantId, 'tasks'), getTable(tenantId, 'employees'),
    getTable(tenantId, 'advances'), getTable(tenantId, 'maintenance'), getTable(tenantId, 'treatments'),
    getTable(tenantId, 'sales'), getTable(tenantId, 'agua'), getTable(tenantId, 'sal'),
    getTable(tenantId, 'partos'), getTable(tenantId, 'diesel_tank')
  ]);

  const now = new Date();
  const weekAgo = new Date(now - 7*86400000).toISOString().slice(0,10);
  const twoWeeksAgo = new Date(now - 14*86400000).toISOString().slice(0,10);
  const today = now.toISOString().slice(0,10);
  const inRange = (d, from, to) => (d||'') >= from && (d||'') <= to;

  // This week
  const bajasW = (bajas||[]).filter(b => inRange(b.fecha||b.created_at, weekAgo, today));
  const treatW = (treatments||[]).filter(t => inRange(t.date||t.created_at, weekAgo, today));
  const dieselW = (diesel||[]).filter(d => d.type==='despacho' && inRange(d.fecha, weekAgo, today));
  const dieselLW = dieselW.reduce((s,d) => s+(parseFloat(d.litros)||0), 0);
  const maintW = (maintenance||[]).filter(m => inRange(m.date, weekAgo, today));
  const maintCost = maintW.reduce((s,m) => s+(m.cost||0), 0);
  const advW = (advances||[]).filter(a => inRange(a.date, weekAgo, today));
  const advTotal = advW.reduce((s,a) => s+(a.amount||0), 0);
  const salesW = (sales||[]).filter(s => inRange(s.date, weekAgo, today));
  const salesTotal = salesW.reduce((s,v) => s+(v.total||0), 0);
  const partosW = (partos||[]).filter(p => inRange(p.date, weekAgo, today));

  // Previous week
  const bajasP = (bajas||[]).filter(b => inRange(b.fecha||b.created_at, twoWeeksAgo, weekAgo));
  const treatP = (treatments||[]).filter(t => inRange(t.date||t.created_at, twoWeeksAgo, weekAgo));
  const dieselP = (diesel||[]).filter(d => d.type==='despacho' && inRange(d.fecha, twoWeeksAgo, weekAgo));
  const dieselLP = dieselP.reduce((s,d) => s+(parseFloat(d.litros)||0), 0);

  const arrow = (cur, prev) => cur > prev ? '↑' : cur < prev ? '↓' : '→';
  const diff = (cur, prev) => { const d = cur-prev; return d > 0 ? '+'+d : d < 0 ? ''+d : '='; };

  let r = `📊 *RESUMEN SEMANAL*\n${weekAgo} al ${today}\n\n`;
  r += `🐄 *Actividad de campo:*\n`;
  r += `  💉 Curaciones: ${treatW.length} ${arrow(treatW.length, treatP.length)}\n`;
  r += `  🪦 Bajas: ${bajasW.length} ${arrow(bajasW.length, bajasP.length)}\n`;
  r += `  🐣 Partos: ${partosW.length}\n`;
  r += `  🔧 Mantenimiento: ${maintW.length} (Bs. ${maintCost.toLocaleString()})\n\n`;

  r += `⛽ *Combustible:*\n`;
  r += `  Consumo: ${Math.round(dieselLW)}L ${arrow(dieselLW, dieselLP)} (${diff(Math.round(dieselLW), Math.round(dieselLP))}L vs sem. ant.)\n`;
  const tanks = Array.isArray(diesel_tank) ? diesel_tank : [];
  tanks.forEach(t => {
    const pct = t.capacity ? Math.round((t.current_level||0)/t.capacity*100) : 0;
    r += `  ${t.name}: ${t.current_level||0}L (${pct}%)${pct<25?' ⚠️ RECARGAR':''}\n`;
  });

  r += `\n💰 *Financiero:*\n`;
  r += `  Adelantos: Bs. ${advTotal.toLocaleString()} (${advW.length} registros)\n`;
  if (salesW.length) r += `  Ventas: Bs. ${salesTotal.toLocaleString()} (${salesW.length})\n`;

  // Stock needs
  const lowStock = (products||[]).filter(p => (p.stock_qty||0) <= (p.stock_min||0));
  const criticalTanks = tanks.filter(t => t.capacity && (t.current_level||0)/t.capacity < 0.25);
  if (lowStock.length || criticalTanks.length) {
    r += `\n🛒 *NECESIDADES DE COMPRA:*\n`;
    lowStock.forEach(p => {
      const need = (p.stock_min||0) * 2 - (p.stock_qty||0);
      r += `  ⚠️ ${p.name}: quedan ${p.stock_qty} ${p.unit||'ml'} — comprar ~${Math.max(0,need)} ${p.unit||'ml'}\n`;
    });
    criticalTanks.forEach(t => {
      const need = (t.capacity||0) - (t.current_level||0);
      r += `  ⛽ ${t.name}: faltan ${need}L para llenar\n`;
    });
  } else {
    r += `\n✅ *Stock e insumos OK*\n`;
  }

  r += `\n_Reporte semanal automático EstanciaPro_`;
  return r;
}

async function buildMonthlyReport(tenantId) {
  const [lots, products, bajas, diesel, employees, advances, maintenance, treatments, sales, partos] = await Promise.all([
    getTable(tenantId, 'lots'), getTable(tenantId, 'vet_products'), getTable(tenantId, 'bajas'),
    getTable(tenantId, 'diesel'), getTable(tenantId, 'employees'), getTable(tenantId, 'advances'),
    getTable(tenantId, 'maintenance'), getTable(tenantId, 'treatments'), getTable(tenantId, 'sales'),
    getTable(tenantId, 'partos')
  ]);

  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonth = new Date(now.getFullYear(), now.getMonth()-2, 1);
  const lmKey = lastMonth.toISOString().slice(0,7);
  const pmKey = prevMonth.toISOString().slice(0,7);
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  const inMonth = (d, mk) => (d||'').startsWith(mk);

  const bajasLM = (bajas||[]).filter(b => inMonth(b.fecha||b.created_at, lmKey));
  const bajasPM = (bajas||[]).filter(b => inMonth(b.fecha||b.created_at, pmKey));
  const treatLM = (treatments||[]).filter(t => inMonth(t.date||t.created_at, lmKey));
  const treatPM = (treatments||[]).filter(t => inMonth(t.date||t.created_at, pmKey));
  const dieselLM = (diesel||[]).filter(d => d.type==='despacho' && inMonth(d.fecha, lmKey)).reduce((s,d) => s+(parseFloat(d.litros)||0), 0);
  const dieselPM = (diesel||[]).filter(d => d.type==='despacho' && inMonth(d.fecha, pmKey)).reduce((s,d) => s+(parseFloat(d.litros)||0), 0);
  const maintLM = (maintenance||[]).filter(m => inMonth(m.date, lmKey)).reduce((s,m) => s+(m.cost||0), 0);
  const maintPM = (maintenance||[]).filter(m => inMonth(m.date, pmKey)).reduce((s,m) => s+(m.cost||0), 0);
  const advLM = (advances||[]).filter(a => inMonth(a.date, lmKey)).reduce((s,a) => s+(a.amount||0), 0);
  const advPM = (advances||[]).filter(a => inMonth(a.date, pmKey)).reduce((s,a) => s+(a.amount||0), 0);
  const salesLM = (sales||[]).filter(s => inMonth(s.date, lmKey)).reduce((s,v) => s+(v.total||0), 0);
  const salesPM = (sales||[]).filter(s => inMonth(s.date, pmKey)).reduce((s,v) => s+(v.total||0), 0);
  const partosLM = (partos||[]).filter(p => inMonth(p.date, lmKey));
  const partosPM = (partos||[]).filter(p => inMonth(p.date, pmKey));
  const empSalarios = (employees||[]).reduce((s,e) => s+(e.salary||0), 0);

  const arrow = (c,p) => c>p?'↑':c<p?'↓':'→';
  const pctChange = (c,p) => { if(!p) return c?'+100%':'0%'; return ((c-p)/p*100).toFixed(0)+'%'; };

  let r = `📊 *COMPARATIVO MENSUAL*\n${meses[lastMonth.getMonth()]} vs ${meses[prevMonth.getMonth()]} ${now.getFullYear()}\n\n`;

  r += `🐄 *Producción:*\n`;
  r += `  Bajas: ${bajasLM.length} vs ${bajasPM.length} ${arrow(bajasLM.length,bajasPM.length)}\n`;
  r += `  Curaciones: ${treatLM.length} vs ${treatPM.length} ${arrow(treatLM.length,treatPM.length)}\n`;
  r += `  Partos: ${partosLM.length} vs ${partosPM.length} ${arrow(partosLM.length,partosPM.length)}\n\n`;

  r += `⛽ *Consumo diesel:*\n`;
  r += `  ${Math.round(dieselLM)}L vs ${Math.round(dieselPM)}L ${arrow(dieselLM,dieselPM)} (${pctChange(dieselLM,dieselPM)})\n\n`;

  r += `💰 *Costos:*\n`;
  r += `  Mantenimiento: Bs. ${maintLM.toLocaleString()} vs ${maintPM.toLocaleString()} ${arrow(maintLM,maintPM)}\n`;
  r += `  Adelantos: Bs. ${advLM.toLocaleString()} vs ${advPM.toLocaleString()} ${arrow(advLM,advPM)}\n`;
  r += `  Salarios: Bs. ${empSalarios.toLocaleString()}/mes\n`;
  const totalCostLM = maintLM + advLM + empSalarios + dieselLM*7.5;
  const totalCostPM = maintPM + advPM + empSalarios + dieselPM*7.5;
  r += `  *TOTAL: Bs. ${Math.round(totalCostLM).toLocaleString()} vs ${Math.round(totalCostPM).toLocaleString()} ${arrow(totalCostLM,totalCostPM)} (${pctChange(totalCostLM,totalCostPM)})*\n\n`;

  if (salesLM || salesPM) {
    r += `💵 *Ingresos:*\n`;
    r += `  Ventas: Bs. ${salesLM.toLocaleString()} vs ${salesPM.toLocaleString()} ${arrow(salesLM,salesPM)}\n\n`;
  }

  const totalCab = (lots||[]).filter(l=>l.status!=='sold').reduce((s,l) => s+(l.animal_count||0), 0);
  if (totalCab) {
    r += `📈 *Indicadores:*\n`;
    const costPerCab = totalCab ? Math.round(totalCostLM/totalCab) : 0;
    r += `  Costo/cabeza/mes: Bs. ${costPerCab}\n`;
    r += `  Mortandad ${meses[lastMonth.getMonth()]}: ${bajasLM.length} de ${totalCab} (${(bajasLM.length/totalCab*100).toFixed(1)}%)\n`;
  }

  r += `\n_Reporte mensual automático EstanciaPro_`;
  return r;
}

// ── Cron: Check every minute ──
setInterval(async () => {
  try {
    const now = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/La_Paz'}));
    const h = now.getHours();
    const m = now.getMinutes();
    const dow = now.getDay(); // 0=Sun, 1=Mon
    const dom = now.getDate();

    // Get all active tenants with report config
    const tenantsRes = await pool.query("SELECT id, token FROM tenants WHERE active=true");
    for (const tenant of tenantsRes.rows) {
      const tenantId = 'tenant_' + tenant.id;
      const rp = await getTable(tenantId, 'report_params');
      if (!rp || !rp.report_phone) continue;
      const phone = rp.report_phone;

      // Daily morning report at 6:00 AM
      if (h === 6 && m === 0) {
        console.log('[Cron] Sending morning report to', phone);
        const report = await buildMorningReport(tenantId);
        await sendWhatsAppText(phone, report);
      }

      // Weekly report: Monday 9:00 AM
      if (dow === 1 && h === 9 && m === 0) {
        console.log('[Cron] Sending weekly report to', phone);
        const report = await buildWeeklyReport(tenantId);
        await sendWhatsAppText(phone, report);
      }

      // Monthly report: 1st of month 9:00 AM
      if (dom === 1 && h === 9 && m === 0) {
        console.log('[Cron] Sending monthly report to', phone);
        const report = await buildMonthlyReport(tenantId);
        await sendWhatsAppText(phone, report);
      }
    }
  } catch(e) { console.error('[Cron] Error:', e.message); }
}, 60000); // Every 60 seconds

// ── Manual trigger endpoint ──
app.post('/api/send-report', auth, async (req, res) => {
  try {
    const { type, phone } = req.body;
    if (!phone) return res.status(400).json({error: 'phone required'});
    let report = '';
    if (type === 'morning') report = await buildMorningReport(req.tenantId);
    else if (type === 'weekly') report = await buildWeeklyReport(req.tenantId);
    else if (type === 'monthly') report = await buildMonthlyReport(req.tenantId);
    else return res.status(400).json({error: 'type must be morning, weekly or monthly'});
    await sendWhatsAppText(phone, report);
    res.json({ok: true, type, sent_to: phone, length: report.length});
  } catch(e) { res.status(500).json({error: e.message}); }
});
