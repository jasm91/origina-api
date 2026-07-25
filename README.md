# Origina · Control Financiero v3

Reinicio del proyecto sobre el **patrón de la casa** (igual que PPS / sg-ventas):
**Express + PostgreSQL (SQL directo, sin ORM) + React/Vite**, modular y rápido.
Este repo es la **Fase 0 (fundación)**; las siguientes fases agregan los catálogos
estandarizados (APU) y el flujo de dinero rediseñado (ver `PROPUESTA-Origina-v3.md`).

## Por qué es rápido (a diferencia del v2 vanilla)

- Front **React + Vite** compilado — el bundle pesa **~57 kB gzip** (vs ~218 kB del intento
  Vue+PrimeVue, y sin comparación con el `index.html` vanilla que re-renderiza todo por string).
- Backend **modular** (`auth.js`, `perms.js`, `api.js`, …) con **endpoints paginados**: las listas
  traen 20 filas, no la obra entera.
- Payloads chicos + índices en Postgres.

## Correr en local

Backend:
```bash
npm install
cp .env.example .env         # completá DATABASE_URL y JWT_SECRET
npm run migrate              # crea tablas + siembra tenant/admin + obras demo
npm start                    # http://localhost:3000
```
Front (en otra terminal, con proxy a :3000):
```bash
cd client
npm install
npm run dev                  # http://localhost:5173
```
Login demo: `jose@origina.bo` / `origina2026` (editable por envs SEED_*).

## Deploy (una sola app, estilo PPS)

`npm run build` compila el front a `client/dist`, y `server.js` lo sirve como estático + el `/api`.
En Railway/VPS: build `npm install && npm run build`, start via `Procfile`
(`node migrate.js && node server.js`). Mismo modelo de una-sola-app que ya elegiste.

## Estructura

```
server.js     wiring + sirve client/dist
migrate.js    migración idempotente + seed (corre en cada arranque)
db.js         pool pg
auth.js       login JWT multitenant, requireAuth/requireRole
perms.js      matriz de permisos por rol (admin/aprobador/administrativo/revisor)
api.js        negocio: /context + /obras (paginado, CRUD)
catalogo.js   catálogos: insumos + partidas con APU (pu_costo calculado) + capítulos
presupuesto.js presupuesto por selección + explosión de insumos (Fase 2)
movimientos.js libro append-only + tablero de costo y caja (Fase 3)
client/       React + Vite (pages: Login, Dashboard, Obras, ObraDetalle, Insumos, Partidas+APU)
```

## Roadmap (web primero; ver PROPUESTA-Origina-v3.md)

- **Fase 0 · Fundación (este repo):** auth, tenant, obras paginadas, layout rápido. ✅
- **Fase 1 · Catálogos (APU):** insumos → partidas con receta de insumos y rendimientos →
  plantilla de capítulos estándar. La estandarización. ✅
- **Fase 2 · Presupuesto:** armar por selección del catálogo + metrado + explosión de insumos. ✅
- **Fase 3 · Dinero claro:** libro de movimientos (ledger) + pipeline (Presupuesto→Comprometido→
  Real, y Contratado→Facturado→Cobrado) + tablero de costo y caja. ✅
- **Fase 4 · Compras y control:** órdenes de compra (compromisos) + avance real vs presupuesto.
- **Fase 5 · Pulido + tests** (invariantes tipo «Σ movimientos = saldo»).
- **Fase 6 · Mobile simple** al final.
```
