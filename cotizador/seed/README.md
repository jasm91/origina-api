# Semillas del cotizador

Dejá acá los archivos de exportación del cotizador y se cargan solos al desplegar
(los lee `migrate.js → ensureCotizadorSeed`). Es idempotente e incremental: cada
archivo se aplica una sola vez por organización (marca `__seed_files` en `og_kv`).

Formatos aceptados:
- **Export completo** (`ORIGINA_base_*.json`, con `__originaBase:true`): trae todas las
  cotizaciones + biblioteca de costos + contratistas + OCs + usuarios. Es el que
  produce el cotizador en **Archivo → Exportar base (.json)**. Este es el autoritativo.
- **Cotización suelta** (`*.ogq.json`, con `__og:"quote"`): una sola cotización.

Para migrar todo lo que ya tenías cargado: exportá la base del sistema viejo y dejá el
`ORIGINA_base_*.json` en esta carpeta; en el próximo deploy quedan todas las obras.
