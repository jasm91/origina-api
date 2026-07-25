/**
 * server.js — Origina v3. Wiring modular (estilo PPS) + sirve el front React (client/dist).
 * Deploy: el Procfile corre migrate.js y luego este server.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

if (!process.env.JWT_SECRET) { console.error('FATAL: JWT_SECRET es obligatorio.'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('FATAL: DATABASE_URL es obligatorio.'); process.exit(1); }

const { router: authRouter } = require('./auth');
const apiRouter = require('./api');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

const APP_VERSION = require('./package.json').version;
app.get('/health', (_req, res) => res.json({ ok: true, version: APP_VERSION, ts: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api', apiRouter);

// Frontend (React build en client/dist).
const dist = path.join(__dirname, 'client', 'dist');
app.use(express.static(dist, { index: false, maxAge: '1y', immutable: true }));
app.get('*', (req, res) => {
  if (req.path.startsWith('/assets/')) return res.status(404).end(); // asset viejo tras redeploy → 404, no HTML
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(dist, 'index.html'));
});

app.listen(PORT, () => console.log(`✅ Origina v3 escuchando en :${PORT}`));
