# Script

Scripts de apoyo del proyecto. Ninguno hace falta para que la aplicación corra
en producción.

| Script | Qué hace | Cómo se corre |
|---|---|---|
| [`verificar.sh`](verificar.sh) | Comprueba la coherencia de la documentación: enlaces rotos, conteos del SRS, numeración de requisitos y marcadores sin completar | `bash Script/verificar.sh` |
| [`dev-movil.sh`](dev-movil.sh) | Arranca el servidor de desarrollo accesible desde un celular en la misma red wifi | `npm run dev:movil` |
| [`muestra-ticket.ts`](muestra-ticket.ts) | Regenera los comprobantes de muestra de 58 y 80 mm que usa la prueba de impresión | `npx tsx Script/muestra-ticket.ts` |
| [`spike-impresion/`](spike-impresion/) | Prueba de impresión en impresoras térmicas: comprobantes de muestra e instalación del controlador en Linux | Ver su [README](spike-impresion/README.md) |
