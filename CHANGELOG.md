# Changelog — Origina v3

Formato: cada fase o cambio relevante bumpea la versión en `package.json` **y**
`client/package.json` (esta última es la que se ve en la barra lateral vía `__APP_VERSION__`).
Se sube la **minor** por fase/feature; **patch** para arreglos; **major** para rupturas.

## 3.5.0 — Rediseño visual al estándar de producción
- Sistema de diseño alineado al front de producción: tipografía Jost (títulos),
  Inter (cuerpo), JetBrains Mono (números); acento verde + clay.
- Tarjetas con radio 16px y sombra, thead con subrayado de acento, pills en mayúscula,
  botones outline con hover clay + variante `.btn.dark`, inputs y modales pulidos.

## 3.4.0 — Cotizador de producción hospedado
- Backend clave→valor del cotizador (`og_store.js`, `POST /api/og` get/set/delete) sobre
  Postgres (`og_kv`), aislado por tenant y autenticado con el JWT de v3.
- Hosting del bundle en `/cotizador` con inyección del token de sesión; link en la sidebar.
- Código fuente del cotizador guardado en `cotizador/src/`.

## 3.3.0 — Fase 4 · Compras y control
- Órdenes de compra (compromisos formales): `compras.js`, tablas `ordenes_compra` +
  `orden_compra_lineas`. Ciclo borrador→emitida→anulada; emitir/anular/pagar alimentan el libro.
- Control por partida: presupuestado vs comprometido con % de avance.
- Pestaña **Compras** en el detalle de obra.

## 3.2.0 — Fase 3 · Dinero claro
- Libro de movimientos append-only (`movimientos.js`, tabla `movimientos`): pipeline de
  costo (Presupuesto→Comprometido→Real) y de caja (Contratado→Facturado→Cobrado).
- Tablero de costo y caja con brechas (por comprometer/facturar/cobrar, caja neta).
- Pestaña **Dinero** en el detalle de obra.

## 3.1.0 — Fase 2 · Presupuesto
- Presupuesto por selección de partidas + metrado y explosión de insumos (`presupuesto.js`,
  tabla `presupuesto_items`). Pestaña de detalle de obra (`ObraDetalle`).
- Seed idempotente del catálogo (capítulos estándar + insumos/partida demo).

## 3.0.0 — Fases 0–1 · Fundación + Catálogos (APU)
- Base Node modular + React/Vite (estilo PPS): auth JWT multitenant, obras paginadas.
- Catálogos: insumos, partidas con APU (`pu_costo` calculado), capítulos estándar.
