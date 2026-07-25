# Cotizador ORIGINA — Código fuente y guía de integración

Este paquete contiene el código fuente completo del **Cotizador de Obra ORIGINA** y todo
lo necesario para integrarlo a otro sistema.

---

## 1. Qué es

Es una aplicación **React 18** contenida en **un solo archivo**: `cotizador-obra.jsx`.
Exporta un único componente por defecto (`Root`) que renderiza toda la interfaz
(cotización de obra, cotización de diseño, informes de avance, órdenes de compra,
panel empresa, control interno, etc.).

No usa framework de rutas ni backend propio: es UI + lógica de negocio. La persistencia
de datos se hace a través de una **capa de almacenamiento desacoplada** (ver punto 5),
que es el único punto que el programrador debe conectar al sistema destino.

---

## 2. Contenido del paquete

| Archivo | Descripción |
|---|---|
| `cotizador-obra.jsx` | **Código fuente completo** (un componente React, ~3.900 líneas). |
| `entry.jsx` | Punto de montaje: importa `Root` y lo monta en `#root`. |
| `index.html` | HTML anfitrión (con ejemplo de configuración `window.OG_API`). |
| `app.bundle.js` | Bundle ya compilado (IIFE autocontenido) listo para usar sin compilar. |
| `package.json` | Dependencias y script de compilación. |
| `api-referencia.php` | Implementación **de referencia** del endpoint de almacenamiento. |
| `README.md` | Este documento. |

---

## 3. Dependencias

Solo tres, todas estándar de npm:

- `react` **18**
- `react-dom` **18**
- `lucide-react` **0.383.0** (íconos)

Opcionales, cargadas en tiempo de ejecución desde CDN solo al generar PDF:
`html2canvas` y `jspdf`. Se pueden auto-hospedar (ver punto 6).

---

## 4. Cómo compilar y montar

El componente se monta en un `<div id="root">`. Con **esbuild** (recomendado):

```bash
npm install react@18 react-dom@18 lucide-react@0.383.0
npx esbuild entry.jsx --bundle --minify --format=iife \
  --jsx=automatic --loader:.jsx=jsx --outfile=app.bundle.js
```

Luego basta servir `index.html` + `app.bundle.js`. El bundle ya trae React incluido y
se auto-monta en `#root`.

> También sirve cualquier bundler (Vite, webpack, Next.js). Para integrarlo dentro de
> otra app React, no uses `entry.jsx`: importá directamente el componente
> `import Root from "./cotizador-obra.jsx"` y renderízalo donde quieras.

---

## 5. Punto clave de integración: la capa de almacenamiento

**Esto es lo único que hay que conectar.** La app guarda y lee todo mediante funciones
`sGet(key)` / `sSet(key, value)` que resuelven contra uno de dos backends, según lo que
esté definido en `window`:

### Opción A — Endpoint HTTP (recomendada para integrar a un sistema con base de datos)

Si `index.html` define `window.OG_API = "https://tu-servidor/api"`, la app envía **POST**
con JSON a esa URL. El protocolo es mínimo:

```
POST {op:"get",    key:"...", token:"..."}            → { "value": <json|null> }
POST {op:"set",    key:"...", value:<json>, token}    → { "ok": true }
POST {op:"delete", key:"...", token}                  → { "ok": true }
```

- `token` viene de `window.OG_TOKEN` (autenticación simple; podés reemplazarla por tu
  esquema de sesión/JWT).
- El programador solo implementa ese endpoint contra su base de datos (una tabla
  clave→valor JSON es suficiente). Ver `api-referencia.php` para un ejemplo funcional.

### Opción B — Objeto `window.storage`

Si en su lugar existe `window.storage`, la app usa:
`storage.get(key, shared)`, `storage.set(key, value, shared)`, `storage.delete(key, shared)`.

### Claves y modelo de datos

Todo se guarda como pares **clave → JSON**:

| Clave | Contenido |
|---|---|
| `quotes_index` | Array con el índice de todas las cotizaciones (id, código, proyecto, cliente, estado, fecha, servicio, savedAt…). |
| `quote_<id>` | Documento completo de una cotización (meta, params, sections, contractors, cobros, informe, versions). |
| `og_users` | Usuarios, roles y permisos. |
| `lib_costs` | Biblioteca de precios/partidas. |
| `lib_contractors` | Libreta de contratistas. |
| `lib_ordenes` | Órdenes de compra emitidas. |
| `og_correlativo`, `og_correlativo_dis`, `og_correlativo_it` | Contadores de numeración (obra, diseño, informes). |
| `quote_draft`, `design_draft` | Borrador local en curso (siempre en `localStorage`, no compartido). |

Los borradores (`*_draft`) son **locales por dispositivo** y no pasan por el endpoint;
el resto son datos **compartidos** (multiusuario) que sí van al backend.

---

## 6. Servicios externos (todos opcionales)

- **Tipo de cambio del BCB:** intenta `https://apibcb.cucu.bo/api/v1/tc/oficial`. Si no está
  disponible, el TC queda manual (editable en la barra "Dólar oficial (BCB)"). Se puede
  apuntar a tu propio proxy.
- **Generación de PDF:** carga `html2canvas` y `jspdf` desde `cdnjs.cloudflare.com` solo la
  primera vez que se emite un PDF. Para entornos sin internet, hospedá esas dos librerías
  y ajustá las URLs en `cotizador-obra.jsx` (funciones `ensureCanvasLib` y el `loadScript`
  de jspdf).
- **Chequeo de versión:** hace un `HEAD` a `app.bundle.js` para avisar si hay una versión
  nueva. Inofensivo; se puede quitar.

---

## 7. Notas de integración a otro sistema

- **Embeber tal cual:** servir `index.html` + `app.bundle.js` dentro de un `<iframe>` en el
  panel del administrador, definiendo `window.OG_API`/`window.OG_TOKEN` en el HTML anfitrión.
  Es la vía más rápida.
- **Integración nativa:** montar el componente `Root` dentro de la app React del sistema
  destino y proveer `window.OG_API` o `window.storage` apuntando a su backend. Los datos
  quedan en la base de datos del sistema, no en el navegador.
- **Autenticación:** reemplazar `window.OG_TOKEN` por el token/sesión real del sistema; el
  endpoint valida ese token antes de leer/escribir.
- **Migración de datos existentes:** si ya hay cotizaciones en el NAS, se exportan con la
  función de respaldo de la app (Archivo → Exportar base .json) y se importan al nuevo
  backend cargando cada clave del JSON.

---

## 8. Licencia / propiedad

Código propiedad de ORIGINA GROUP. Entregado para su integración interna.
