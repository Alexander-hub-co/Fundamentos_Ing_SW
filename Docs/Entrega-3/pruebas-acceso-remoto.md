# Pruebas de acceso remoto y disponibilidad (#12)

**Parquivo** · Entrega Final
**Fecha:** 20 de noviembre de 2026, 17:16 (hora de Bogotá)
**Entorno probado:** producción, <https://parquivo.vercel.app> (Vercel + PostgreSQL en Neon)

## Criterios de la historia

1. Desde otro lugar, la información carga sin errores de conexión.
2. Desde distintas redes (wifi y datos móviles), el sistema responde igual.
3. Si la conexión se cae y vuelve, se ve la información actualizada sin volver a iniciar sesión.

## Disponibilidad y tiempos de respuesta

Quince peticiones seguidas a cada ruta, desde una red wifi residencial en Bogotá.

| Ruta | Respuestas correctas | Tiempo medio | Tiempo máximo | Observación |
|---|:---:|:---:|:---:|---|
| `/login` | 15 / 15 | 0,28 s | 0,40 s | Página pública |
| `/taquilla` | 15 / 15 | 0,30 s | 0,49 s | Sin sesión redirige a `/login` (307), como debe |
| `/panel` | 15 / 15 | 0,29 s | 0,58 s | Sin sesión redirige a `/login` (307), como debe |

Ninguna petición falló ni superó los 0,6 segundos.

## Seguridad de la conexión

| Comprobación | Resultado |
|---|---|
| Protocolo | HTTPS con TLS 1.3 |
| Certificado | `*.vercel.app`, válido hasta el 29 de enero de 2027 |
| HSTS | Activo (`max-age` de dos años, con `includeSubDomains` y `preload`) |
| Rutas protegidas sin sesión | Redirigen al inicio de sesión; no exponen datos |

## Reconexión

La sesión se guarda en una *cookie* del navegador y se valida contra la base en
cada petición, de modo que perder la conexión no la cierra: al volver la red, la
siguiente página que se pida muestra los datos actuales sin pedir de nuevo la
contraseña. La sesión solo termina al cerrarla o al vencer.

## Prueba desde datos móviles

Con el celular **sin wifi**, solo con datos móviles:

1. Abrir <https://parquivo.vercel.app> e iniciar sesión.
2. Entrar a la taquilla y a «Últimos cobros».
3. Activar el modo avión unos segundos, desactivarlo y recargar: la sesión sigue abierta.

| Red | Resultado | Quién lo probó |
|---|---|---|
| Wifi residencial (computador) | Correcto: ver tablas anteriores | Equipo, 20 de noviembre |
| Datos móviles (celular) | | |

## Conclusión

Con la red wifi probada, el sistema está disponible, responde en menos de 0,6
segundos y protege las rutas privadas. La prueba con datos móviles completa el
segundo criterio de la historia.
