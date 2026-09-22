# Implementation Plan: Taquilla de vehículos

**Branch**: `004-taquilla-vehiculos` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-taquilla-vehiculos/spec.md`

## Summary

La funcionalidad que hace que el producto sirva. Un solo campo de placa resuelve entrada y
salida; el tipo se deriva de la placa; la salida cobra de verdad reutilizando el motor que
ya existe; y cada movimiento queda protegido por el Principio IV.

**El riesgo técnico está cerrado.** La impresión sale por el sistema operativo desde el
navegador, porque es lo único que cubre las tres conexiones que hay en el campo —cable, red
y Bluetooth— sin obligar a nadie a cambiar de impresora ni a instalar un programa. La
decisión y sus alternativas están en [research.md](research.md); lleva un spike por delante
como primera tarea, y si el spike falla la decisión se revisa allí y no en medio de la
implementación.

## Technical Context

**Language/Version**: TypeScript 5, Node 22

**Primary Dependencies**: Next.js 16 (App Router, Turbopack), Drizzle ORM, Better Auth

**Storage**: PostgreSQL con RLS forzada. Dos puertas: `conAmbito()` y `comoPlataforma()`

**Testing**: Vitest, tres proyectos: `unit`, `integracion`, `aislamiento`

**Target Platform**: aplicación web servida desde Node; la taquilla corre en un navegador
de escritorio en el local, con una impresora térmica instalada en esa máquina

**Project Type**: aplicación web con dominio separado de la interfaz

**Performance Goals**: la ruta crítica es humana, no de máquina. El objetivo real es
**menos pulsaciones**, no menos milisegundos: registrar una entrada debe ser escribir la
placa y confirmar. El cálculo es puro y en memoria.

**Constraints**: importes enteros; marcas de tiempo con zona; el calculador no puede
importar nada de `src/db` —hay una prueba que lo verifica—; toda tabla con
`parqueadero_id` lleva RLS forzada; **la impresión no puede estar en el camino del
registro**, porque ocurre en una máquina que el servidor no controla.

**Scale/Scope**: cinco tablas nuevas, una pantalla nueva grande, tres historias.

## Constitution Check

*Verificado antes de la Fase 0 y de nuevo tras la Fase 1. Sin violaciones.*

| Principio | Cómo se cumple | Verificación |
|---|---|---|
| **I. Aislamiento** | Los movimientos son el dato más sensible que ha existido en el sistema. Las cinco tablas nacen con política de ámbito | Prueba negativa obligatoria: un operario de A no alcanza los movimientos de B. La prueba estructural cubre las tablas nuevas sin nombrarlas |
| **II. Cero valores quemados** | Esta funcionalidad **no declara ningún valor de negocio**. Todo lo que usa —tarifas, horarios, convenios, capacidad, redondeo— ya está declarado por el establecimiento | La prueba de valores quemados sigue verde sin excepciones nuevas |
| **III. La taquilla es la ruta crítica** | Es la funcionalidad que lo materializa: un dato para entrar, sin selector de tipo | Los botones de sello son el único añadido, y su justificación ya está escrita: el sello es un objeto físico que llega con el cliente |
| **IV. Integridad del historial** | Primera funcionalidad con movimientos que proteger. Copia embebida del cobro, disparador que impide modificar lo cerrado, correcciones como asientos nuevos que conservan los dos importes | Se prueba con consultas directas, no sólo por la interfaz: la garantía tiene que estar en el motor |
| **V. Alcance deliberado** | Bicicletas y reportes quedan fuera, cada uno con su razón | El ticket entró porque el propietario del producto dijo que sin él no hay operación, no porque cupiera |
| **Roles y delegación (1.1.0)** | Una sola operación delegable, comprobada en la puerta de autorización y no en la pantalla | Las cuatro reglas de la enmienda se cumplen por construcción del modelo |

**Sobre la enmienda que esta funcionalidad provocó.** La constitución pasó a 1.1.0 durante
la clarificación, porque un permiso delegable no cabía en "exactamente tres niveles". Se
enmendó por el procedimiento formal en lugar de reinterpretarse. Queda anotado acá para que
la decisión no se revierta por comodidad: la lista de operaciones delegables tiene **un**
valor, y ampliarla exige volver a la especificación.

## Project Structure

### Documentation (this feature)

```text
specs/004-taquilla-vehiculos/
├── plan.md              # Este archivo
├── spec.md              # 52 requisitos, ya clarificada
├── research.md          # Fase 0 — siete decisiones, la primera es la impresión
├── data-model.md        # Fase 1 — cinco tablas y lo que se reutiliza
├── quickstart.md        # Fase 1 — seis recorridos
├── contracts/dominio.md # Fase 1 — las funciones y las garantías a probar
└── tasks.md             # Lo genera /speckit-tasks
```

### Source Code (repository root)

```text
src/
├── db/esquema/
│   ├── movimiento.ts        # NUEVO: el movimiento y su índice único parcial
│   ├── correccion.ts        # NUEVO
│   ├── delegacion.ts        # NUEVO
│   └── sesion-turno.ts      # NUEVO
├── db/blindaje.sql          # + disparador: no se modifica un movimiento cerrado
├── dominio/
│   ├── vehiculos/
│   │   ├── clasificar.ts    # NUEVO y puro: la regla del último carácter
│   │   └── placa.ts         # se muda desde convenios/, que era su sitio provisional
│   ├── taquilla/
│   │   ├── resolver.ts      # NUEVO: entrada, salida o rechazo
│   │   ├── registrar.ts     # NUEVO: los dos extremos y la cortesía
│   │   ├── comprobante.ts   # NUEVO: datos a imprimir y estado de emisión
│   │   └── ocupacion.ts     # NUEVO
│   ├── turnos/sesiones.ts   # NUEVO: abrir y cerrar
│   └── correcciones/        # NUEVO: emitir, delegar, revocar
└── app/(establecimiento)/taquilla/
    ├── page.tsx             # la pantalla
    ├── campo-placa.tsx      # el campo único, que es el centro de todo
    └── imprimir.ts          # el único código que sabe de impresión
```

**Por qué `placa.ts` se muda.** Hoy vive en `dominio/convenios/` porque los convenios
fueron quienes primero necesitaron normalizar placas, y su propio comentario dice "lo usa
el dominio y también la taquilla en F3". Ese momento llegó: una placa no es un concepto de
los convenios. Es una mudanza, no una reescritura.

## Fase 0 — Investigación

Completa. Siete decisiones en [research.md](research.md). Las tres que gobiernan el diseño:

1. **La impresión sale por el sistema operativo, desde el navegador.** Es lo único que
   cubre cable, red y Bluetooth sin instalar nada: el sistema operativo ya sabe hablar con
   las tres y la impresora ya está instalada en esa máquina. Un agente propio daría más
   control y costaría montar un canal de distribución de software de escritorio antes de
   tener el primer cliente.
2. **La impresión no está en el camino del registro.** El movimiento se guarda y se
   confirma; el comprobante se intenta después. No es sólo lo que pide la especificación:
   es lo único que funciona cuando la impresión ocurre en una máquina que el servidor no
   controla.
3. **Una placa no está adentro dos veces por restricción del motor**, no por bloqueo de
   aplicación. El bloqueo de aviso que el proyecto usa para los correlativos no aplica
   —aquél existe porque hay que leer antes de escribir— y aquí sería más lento y más frágil
   para la misma garantía.

## Fase 1 — Diseño

Completa: [data-model.md](data-model.md), [contracts/dominio.md](contracts/dominio.md),
[quickstart.md](quickstart.md).

**Constitution Check tras el diseño: sin violaciones.** Dos decisiones del modelo merecen
constar porque se apartan de lo obvio:

- **El movimiento no tiene columna de estado.** Se deduce de si hay hora de salida. Una
  columna aparte podría contradecir a las fechas, y entonces habría dos verdades sobre lo
  mismo.
- **La revocación de una delegación no borra la fila.** Revocar es un hecho que también se
  audita, y las correcciones ya emitidas se conservan: eran válidas cuando se hicieron.

## Riesgos

**El spike de impresión puede fallar.** Si el modo silencioso no funciona contra una
térmica real, o el ancho del rollo no se respeta, hay que volver a D1 y evaluar el agente
local. Por eso es la primera tarea y no la última: descubrirlo con la funcionalidad a medio
construir sería mucho más caro. Mientras tanto, todo lo demás —el ciclo, el cobro, los
turnos, la ocupación— es independiente de esa decisión.

**Es la primera vez que el sistema maneja dinero cobrado.** Un error en el cálculo hasta
ahora producía un número equivocado en una pantalla de prueba; a partir de aquí produce un
cobro real. El motor ya está probado, pero la conexión entre la taquilla y el motor es
nueva, y por eso el quickstart exige comparar el importe de la taquilla con el del
comprobador para la misma permanencia.

**La pantalla es grande y la tentación de llenarla también.** El Principio III obliga a
justificar cada añadido. Todo lo que no sea escribir la placa y confirmar debería tener que
defenderse.
