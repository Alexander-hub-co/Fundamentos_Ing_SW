# Índice de pantallas — Parquivo

**44 mockups en un solo archivo: `Taquilla.dc.html`.**

Cada pantalla es un `<div class="dv-opt">` con estos atributos, así que se encuentran por búsqueda
directa en el archivo:

```
data-screen="2a"
data-screen-name="Login"
data-role="Todos"
data-viewport="1180×764"
```

Para abrir una pantalla concreta: `grep -n 'data-screen="2a"' Taquilla.dc.html` y leer desde esa
línea hasta el siguiente `data-screen=`. Para listarlas todas:
`grep -o 'data-screen-name="[^"]*"' Taquilla.dc.html`.

El id (`2a`, `7c`, `11d`…) también aparece como insignia visible sobre cada pantalla al abrir el
archivo en el navegador, y es el nombre que usa el README.

## Todas las pantallas

| Id | Pantalla | Rol | Marco | Destino en el repo |
|---|---|---|---|---|
| `1b` | Taquilla — pantalla principal (entrada/salida en un solo campo) | Operario | 1180×764 | `src/app/(establecimiento)/taquilla/` |
| `2a` | Login | Todos | 1180×764 | `src/app/(auth)/login/page.tsx` |
| `2b` | Panel de plataforma | Admin general | 1180×764 | `src/app/(plataforma)/panel/page.tsx` |
| `2c` | Listado de parqueaderos | Admin general | 1180×764 | `src/app/(plataforma)/parqueaderos/page.tsx` |
| `2d` | Ficha de un parqueadero | Admin general | 1180×764 | `src/app/(plataforma)/parqueaderos/[id]/page.tsx` |
| `2e` | Cuentas y usuarios (agrupadas por establecimiento) | Admin general | 1180×764 | `src/app/(plataforma)/cuentas/page.tsx` |
| `2f` | Tarifas, con probador de cálculo | Admin establecimiento | 1180×764 | `src/app/(establecimiento)/configuracion/tarifas/` |
| `2g` | Horario y capacidad | Admin establecimiento | 1180×764 | `src/app/(establecimiento)/configuracion/horario/` |
| `2h` | Turnos — calendario semanal | Admin establecimiento | 1180×764 | `src/app/(establecimiento)/configuracion/turnos/` |
| `2i` | Reportes del establecimiento (día/semana/mes/turno) | Admin establecimiento | 1180×764 | _pantalla nueva_ |
| `3b` | Logo — wordmark PARQUIVO en claro y oscuro, con tamaños reducidos | — | 368 ancho | `src/app/logo.tsx` |
| `4a` | Taquilla — SALIDA de vehículo con convenio | Operario | 1180×764 | `src/app/(establecimiento)/taquilla/` |
| `4b` | Taquilla — ENTRADA de vehículo con convenio | Operario | 1180×764 | `src/app/(establecimiento)/taquilla/` |
| `5a` | Mis reportes del operario (turno abierto + turnos anteriores) | Operario | 1180×764 | _pantalla nueva_ |
| `6a` | Ficha de una cuenta (identidad, acceso, sesiones, intentos) | Admin general | 1180×764 | `src/app/(plataforma)/cuentas/[id]/page.tsx` |
| `7a` | Login | Todos | 390×844 | `src/app/(auth)/login/page.tsx` |
| `7b` | Taquilla — entrada nueva (sin teclado propio: se usa el del celular) | Operario | 390×844 | `src/app/(establecimiento)/taquilla/` |
| `7c` | Taquilla — salida con convenio | Operario | 390×844 | `src/app/(establecimiento)/taquilla/` |
| `7d` | Adentro ahora (lista de vehículos con parcial) | Operario | 390×844 | _pantalla nueva_ |
| `7e` | Mis reportes del turno | Operario | 390×844 | _pantalla nueva_ |
| `7f` | Turno — abrir, ver y cerrar | Operario | 390×844 | _pantalla nueva_ |
| `7g` | Panel de plataforma | Admin general | 390×844 | `src/app/(plataforma)/panel/page.tsx` |
| `8a` | Mi parqueadero (datos + qué está declarado + qué falta) | Admin establecimiento | 1180×764 | _pantalla nueva_ |
| `8b` | Convenios (vigentes, vencido, sin cobrar / por facturar) | Admin establecimiento | 1180×764 | _pantalla nueva_ |
| `8c` | Operarios del establecimiento | Admin establecimiento | 1180×764 | _pantalla nueva_ |
| `8d` | Ajustes — apariencia y preferencias de taquilla | Admin establecimiento | 1180×764 | _pantalla nueva_ |
| `9a` | Listado de parqueaderos | Admin general | 390×844 | `src/app/(plataforma)/parqueaderos/page.tsx` |
| `9b` | Ficha de un parqueadero | Admin general | 390×844 | `src/app/(plataforma)/parqueaderos/[id]/page.tsx` |
| `9c` | Cuentas | Admin general | 390×844 | `src/app/(plataforma)/cuentas/page.tsx` |
| `9d` | Ficha de una cuenta | Admin general | 390×844 | `src/app/(plataforma)/cuentas/[id]/page.tsx` |
| `10a` | Mi parqueadero | Admin establecimiento | 390×844 | _pantalla nueva_ |
| `10b` | Tarifas | Admin establecimiento | 390×844 | `src/app/(establecimiento)/configuracion/tarifas/` |
| `10c` | Horario y capacidad | Admin establecimiento | 390×844 | `src/app/(establecimiento)/configuracion/horario/` |
| `10d` | Turnos | Admin establecimiento | 390×844 | `src/app/(establecimiento)/configuracion/turnos/` |
| `10e` | Convenios | Admin establecimiento | 390×844 | _pantalla nueva_ |
| `10f` | Operarios | Admin establecimiento | 390×844 | _pantalla nueva_ |
| `10g` | Reportes del establecimiento | Admin establecimiento | 390×844 | _pantalla nueva_ |
| `10h` | Ajustes | Admin establecimiento | 390×844 | _pantalla nueva_ |
| `11a` | Error 404 — la página no existe | Todos | 1180×764 | `src/app/not-found.tsx` |
| `11b` | Error del servidor, con código de incidente | Todos | 1180×764 | `src/app/error.tsx` |
| `11c` | Fuera de alcance — recurso de otro establecimiento | Todos | 1180×764 | _pantalla nueva_ |
| `11d` | Servicio suspendido — modo restringido | Admin/Operario | 1180×764 | `src/app/(establecimiento)/restringido/page.tsx` |
| `11e` | Error 404 | Todos | 390×844 | `src/app/not-found.tsx` |
| `11f` | Sin conexión — la taquilla no puede cobrar | Operario | 390×844 | _pantalla nueva_ |

## Orden sugerido de implementación

1. **`2a` / `7a` Login** — la entrada al producto y la prueba del lenguaje visual completo
   (wordmark `3b`, tema oscuro, tipografía, botón primario verde).
2. **`1b` Taquilla** — la pantalla que se usa todo el día, con `4a` y `4b` (convenio) como estados
   de la misma vista, y `7b` / `7c` en móvil.
3. **Errores** `11a`–`11f` — baratos de hacer y necesarios para que el resto no se caiga en blanco.
4. **Plataforma** `2b`, `2c`, `2d`, `2e`, `6a` (+ móvil `7g`, `9a`–`9d`) — ya existen en el repo,
   sólo cambian de apariencia.
5. **Establecimiento** `2f`–`2i`, `8a`–`8d` (+ móvil `10a`–`10h`) — aquí están las pantallas nuevas.

## Pantallas que no existen todavía en el código

Requieren rutas, consultas y server actions nuevas, no sólo rediseño:

- `5a` / `7e` **Mis reportes del operario** — ventas por turno propio, actual e históricos.
- `7d` **Adentro ahora** como vista propia en móvil.
- `7f` **Turno** — abrir y cerrar desde el móvil, con lo pendiente antes de cerrar.
- `8a` / `10a` **Mi parqueadero** — resumen del establecimiento para su administrador.
- `8b` / `10e` **Convenios** — CRUD, placas asociadas, usos y montos no cobrados.
- `8c` / `10f` **Operarios** — gestión desde el establecimiento (hoy sólo existe en plataforma).
- `8d` / `10h` **Ajustes** — preferencias de apariencia por cuenta.
- `2i` / `10g` **Reportes del establecimiento** — agregados por día, semana, mes y turno.
- `11c` **Fuera de alcance** — página propia para el caso de recurso ajeno.
- `11f` **Sin conexión**.
