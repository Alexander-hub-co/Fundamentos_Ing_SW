# Handoff: Parquivo — rediseño de interfaz (taquilla, plataforma, establecimiento)

## Resumen

Rediseño completo de la interfaz de **Parquivo** (gestión de parqueaderos multi-establecimiento,
Next.js App Router + PostgreSQL con RLS). Cubre los tres roles del producto —administrador general,
administrador de establecimiento y operario de taquilla— en escritorio y móvil, más las páginas de
error. La dirección visual es tema oscuro con barra lateral fija, tipografía Public Sans y cifras en
JetBrains Mono, sobre la paleta que ya está muestreada del logo en `src/app/globals.css`.

## Empieza por aquí

**`SCREENS.md` es el índice: las 44 pantallas con su id, rol, marco y el archivo del repo al que
corresponde cada una.** Ábrelo primero. Todas las pantallas viven en un único archivo,
`Taquilla.dc.html`, y cada una está marcada con `data-screen="<id>"` y `data-screen-name="…"`, así
que se localizan con `grep -n 'data-screen="2a"' Taquilla.dc.html`. El login, por ejemplo, es `2a`
en escritorio y `7a` en móvil.

## Sobre los archivos de diseño

Los archivos de este paquete son **referencias de diseño hechas en HTML**: prototipos que muestran
la apariencia y el comportamiento buscados, **no código de producción para copiar**. La tarea es
**recrear estos diseños dentro del código existente** (`src/app/**`, componentes de servidor y
cliente de Next.js, estilos en línea + tokens CSS de `globals.css`), respetando los patrones que ya
usa el repositorio:

- Los estilos viven en objetos `CSSProperties` compartidos (`src/app/ui.ts`) y en variables CSS del
  tema, no en clases utilitarias. Los colores nuevos deben salir de esos tokens.
- Los formularios usan `useActionState` con server actions en `acciones.ts`.
- Todo acceso a datos pasa por `conAmbito()` / `comoPlataforma()` (`src/db/ambito.ts`).
- Los archivos `"use server"` sólo exportan funciones asíncronas.

## Fidelidad

**Alta fidelidad.** Colores, tipografía, espaciados y estados son definitivos. Cada pantalla de
escritorio está dibujada a 1180×764 y cada pantalla móvil a 390×844; esos son marcos de encuadre,
no anchos fijos: la implementación debe ser fluida (la barra lateral fija en 212px y el contenido
elástico).

## Paleta y tokens

Ya existen en `src/app/globals.css`. El rediseño usa el tema oscuro como base:

| Token | Valor | Uso |
|---|---|---|
| `--fondo` | #051a38 | lienzo |
| `--superficie` | #0f2b50 | tarjetas, barra lateral |
| `--borde` | #2a4d7d | separadores y bordes de tarjeta |
| `--borde-control` | #5580b4 | botones secundarios y campos |
| `--texto` | #eef4fb | texto principal |
| `--texto-tenue` | #9fb6d4 | texto secundario |
| `--verde` | #8ccf22 | acento, acción primaria, ítem activo |
| `--azul` | #002454 | texto sobre verde |

Colores adicionales introducidos por el rediseño (derivar de `--azul-vivo` #0060cc al implementar):

| Uso | Valor |
|---|---|
| Relleno de aviso de convenio | #12325c |
| Borde de convenio | #4f8cd9 |
| Texto de convenio sobre oscuro | #a8ccff |
| Insignia de convenio | #0060cc con texto #ffffff |
| Pendiente / advertencia | #f59e0b con texto #002454 |
| Error | #b91c1c (relleno), #fca5a5 (texto), #2a1416 (fondo), #5b1f22 (borde) |

**Regla heredada que no se rompe:** el verde nunca es color de texto sobre fondo claro (1.90:1). En
oscuro sí (9.13:1). El convenio se distingue con azul, no con otro verde.

## Tipografía

- **Public Sans** (Google Fonts) para todo el texto. Pesos usados: 500, 600, 700, 800, 900.
- **JetBrains Mono** para placas, horas, importes, códigos e identificadores.
- Títulos de pantalla 24px/800; título de taquilla 22px/800; rótulos de sección 11px/700 con
  `letter-spacing:.1em` y mayúsculas; cuerpo 13–15px; nunca por debajo de 12px.
- La placa en la taquilla: JetBrains Mono 800, 64px, `letter-spacing:.07em`.

## Escala de espaciado y formas

- Radios: 8–9px controles, 10–12px tarjetas pequeñas, 14px tarjetas grandes, 999px insignias.
- Separaciones: 8, 10, 12, 14, 16, 18, 22, 26px.
- Barra lateral: 212px, cabecera con `padding:22px 20px 18px`, ítems `padding:10px 20px`, ítem
  activo con fondo #8ccf22 y texto #051a38 en peso 700.
- Móvil: objetivos táctiles mínimos de 44px; barra de pestañas de 56px + 18px de área segura.

## Navegación (unificada, dos menús)

**Operario (terminal de taquilla):** Taquilla · Bicicletas · Movimientos · Convenios · Mis reportes ·
Ajustes (tuerca). No hay "Entradas" ni "Salidas": un solo campo de placa resuelve ambas.
Al pie de la barra, panel de turno abierto con hora real, hora prevista y "Cerrar turno".

**Administrador de establecimiento:** Taquilla · Mi parqueadero · Tarifas · Horario y capacidad ·
Turnos · Convenios · Operarios · Reportes · Ajustes (tuerca).

**Administrador general:** Panel · Parqueaderos · Cuentas · Ajustes (tuerca).

En móvil la barra lateral se convierte en pestañas inferiores; la de Ajustes lleva el ícono de
tuerca sobre la etiqueta.

## Pantallas

### Operario

**Taquilla (1b)** — la pantalla central. Rejilla `212px | 1fr | 372px`.
Columna izquierda: título, campo de placa (tarjeta con borde de 2px, altura 104px, placa centrada a
64px), insignia de detección arriba a la derecha ("Ya está adentro → salida" en verde, "No está
adentro → entrada"), dos tarjetas de permanencia y total, desglose por tramos y, al pie, botón
"Cobrar e imprimir ticket" (verde) más "Cancelar".
Columna derecha "Adentro ahora": contador n/capacidad, chips por tipo, tabla de placa, entrada,
tiempo y parcial, con la fila activa resaltada.

**Convenio detectado (4a salida, 4b entrada)** — misma estructura; el aviso cambia de verde a azul y
**nombra el convenio en lugar del importe**. En salida aparecen permanencia / cubierto / cobrable y
el tramo cubierto se muestra en $0. En entrada el pie dice "Convenio" donde iría el precio.

**Mis reportes (5a)** — turno abierto (vendido, movimientos, ticket promedio, convenios sin cobro,
ventas por hora), tabla de turnos anteriores con hora real frente a programada y totales, vendido
por tipo y pendientes del turno.

### Administrador de establecimiento

**Mi parqueadero (8a)**, **Tarifas con probador (2f)**, **Horario y capacidad (2g)**, **Turnos (2h)**,
**Convenios (8b)**, **Operarios (8c)**, **Reportes (2i)**, **Ajustes (8d)**.

Ajustes es pantalla nueva: elección explícita de tema claro/oscuro (nunca `prefers-color-scheme`),
densidad de la taquilla, tamaño de la placa, color de acento entre los tres del logo y preferencias
de taquilla (imprimir automáticamente, confirmar antes de cobrar, sonido al detectar convenio).

### Administrador general

**Panel (2b)**, **Parqueaderos (2c)**, **Ficha de parqueadero (2d)**, **Cuentas (2e)**,
**Ficha de cuenta (6a)**.

### Errores y estados excepcionales (turno 11)

404, error del servidor con código de incidente, "fuera de su alcance" (misma respuesta exista o no
el identificador, y el intento queda en auditoría), servicio suspendido en modo restringido con la
lista de lo que sí se puede hacer, y sin conexión en móvil.

### Móvil

Todas las pantallas anteriores tienen su versión de 390×844 en los turnos 7, 9, 10 y 11.

## Interacciones y comportamiento

- **Un solo campo resuelve entrada y salida.** Al confirmar la placa, el sistema consulta si ese
  vehículo está adentro y decide la operación. Enter confirma; Esc limpia.
- Mientras el vehículo está adentro, el sistema informa el **total parcial hasta el momento**.
- El movimiento guarda **un registro por extremo**: quién hizo la entrada y bajo qué turno, y quién
  hizo la salida y bajo cuál. Pueden ser turnos distintos.
- El turno guarda hora programada y hora real de apertura y cierre.
- Convenio: el aviso cambia de color y nombra el convenio; el movimiento guarda copia del convenio
  y de la tarifa aplicados.
- Estados a implementar: vacío (listados sin datos), carga, error de servidor, sin permiso,
  establecimiento suspendido, sin conexión.

## Estado

- Placa en curso y resultado de la detección (entrada | salida | convenio).
- Lista de vehículos adentro con parcial recalculado.
- Sesión de turno abierta (id, hora real de apertura, totales acumulados).
- Preferencias de apariencia por cuenta (tema, densidad, acento, tamaño de placa).

## Assets

- `assets/logo-claro.png` y `assets/logo-oscuro.png`: copiados de `src/app/`. **La variante oscura sí
  tiene transparencia** (50% de píxeles totalmente transparentes), así que el bloqueo del modo
  oscuro anotado en `docs/roadmap.md` ya no aplica.
- El wordmark del rediseño es tipográfico: "PARQ" en `--texto` + "UIVO" en `--verde`, peso 900, con
  una barra verde de 3–5px debajo. En claro, "UIVO" va en `--verde-texto` (#4a7a10) por contraste.
- Ícono de ajustes: tuerca dibujada en SVG en línea (dos círculos concéntricos + ocho radios,
  `stroke-width:1.5`, `currentColor`).
- No hay más iconografía: la navegación es tipográfica.

## Archivos

- `SCREENS.md` — índice de las 44 pantallas: id, nombre, rol, marco, destino en el repo, orden
  sugerido de implementación y qué pantallas no existen todavía en el código.
- `Taquilla.dc.html` — todas las pantallas. Cada una lleva `data-screen`, `data-screen-name`,
  `data-role` y `data-viewport`, además del id visible al abrir el archivo en el navegador.
- `assets/logo-claro.png`, `assets/logo-oscuro.png`.

## Nota sobre el login

Hay dos: `2a` en escritorio (dos columnas, wordmark centrado sobre la columna izquierda con el
mensaje de aislamiento de datos, formulario a la derecha con su estado de error) y `7a` en móvil
(una sola columna centrada). No confundir con `3b`, que es la hoja del logo, no una pantalla.
