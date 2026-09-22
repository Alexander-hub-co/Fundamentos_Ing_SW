---
description: "Task list for feature implementation"
---

# Tasks: Taquilla de vehículos

**Input**: Design documents from `specs/004-taquilla-vehiculos/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/dominio.md](contracts/dominio.md)

**Tests**: incluidos y obligatorios. La constitución exige verificar con pruebas
automatizadas los principios I (aislamiento) y IV (integridad del historial), y ésta es la
primera funcionalidad donde el IV tiene sujeto: hasta ahora no había movimientos que
proteger. Además maneja dinero cobrado de verdad.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece

---

## Phase 0: Spike de impresión ⚠️ ANTES QUE NADA

**Purpose**: cerrar el único riesgo técnico real antes de construir sobre él.

**Por qué va primero.** Si la impresión silenciosa no funciona contra una térmica real, la
decisión D1 se cae y hay que volver a evaluar el agente local. Descubrirlo con la
funcionalidad a medio construir costaría rehacer la capa de impresión entera y parte de la
pantalla. Es media jornada aquí contra una semana más tarde.

> ⚠️ **APLAZADO POR FALTA DE IMPRESORA (2026-08-19).** El spike exige hardware real y no lo
> hay. Se decidió construir primero los cimientos y la historia 1, que son independientes
> de cómo se imprima, y correr el spike cuando haya acceso a una térmica.
>
> **Lo que esto bloquea, y hay que respetarlo**: la fase 6 (el comprobante) NO se construye
> hasta que el spike pase. Construirla contra un mecanismo sin verificar es exactamente el
> riesgo que esta fase existe para evitar; se estaría pagando el costo de descubrirlo tarde
> a cambio de nada.
>
> **Lo que NO bloquea**: todo lo demás. El ciclo del vehículo, el cobro, los turnos, las
> correcciones y la ocupación no dependen de la impresión. Esa independencia es la decisión
> D2 y ahora se está cobrando sola.
>
> T001 sí se puede hacer ya —dejar la página de prueba lista— para que el día que aparezca
> una impresora el spike sea enchufar y mirar, no empezar de cero.

- [X] T001 Preparar una página de prueba del ancho de un rollo térmico que imprima un comprobante de ejemplo con placa, código, hora y tarifa, en `scripts/spike-impresion/`
- [ ] T002 Probar la página de `scripts/spike-impresion/` contra una impresora térmica real por cada conexión disponible —cable, red y Bluetooth—, con el navegador en modo de impresión silenciosa, y anotar qué funcionó y qué no
- [ ] T003 Comprobar con la misma página de `scripts/spike-impresion/` el punto que puede tumbar la decisión: que el ancho del rollo se respete sin recortes y que no aparezca ningún diálogo por vehículo
- [ ] T004 Escribir el resultado en `specs/004-taquilla-vehiculos/research.md`, bajo D1. **Si el spike falla, parar acá**: la decisión se revisa antes de escribir una línea de la funcionalidad

**Checkpoint**: la forma de imprimir está confirmada o corregida. Recién ahora se construye.

---

## Phase 1: Setup

- [X] T005 Mudar `src/dominio/convenios/placa.ts` a `src/dominio/vehiculos/placa.ts` y actualizar quien la importe. Es una mudanza, no una reescritura: una placa no es un concepto de los convenios, y su propio comentario ya decía que la taquilla la usaría

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el esquema y el blindaje. Nada de las historias puede empezar antes.

- [X] T006 [P] Crear `src/db/esquema/movimiento.ts` con las columnas de [data-model.md](data-model.md), la política de ámbito, y **sin columna de estado**: se deduce de si hay hora de salida, para que no puedan existir dos verdades sobre lo mismo
- [X] T007 Añadir a `src/db/esquema/movimiento.ts` el índice único parcial `movimiento_una_placa_adentro` sobre `(parqueadero_id, placa)` donde la salida es nula. Es la garantía de D4 y la impone el motor, no la aplicación
- [X] T008 Añadir los CHECK de coherencia a `src/db/esquema/movimiento.ts`: salida posterior a entrada; cerrado implica importe y copia del cobro; cortesía con motivo, autor e importe cero
- [X] T009 [P] Crear `src/db/esquema/sesion-turno.ts`, con hora programada y real, y el índice único parcial que impide dos sesiones abiertas por persona
- [X] T010 [P] Crear `src/db/esquema/correccion.ts`, que referencia el movimiento y guarda el importe corregido, el motivo y quién la emitió
- [X] T011 [P] Crear `src/db/esquema/delegacion.ts`, con la operación de una lista cerrada, quién otorga a quién y cuándo, y `revocada_en` nulable: revocar es un hecho que también se audita
- [X] T012 Añadir a `src/db/blindaje.sql` el disparador que impide modificar o borrar un movimiento cerrado. **Va en el motor y no en el código de la aplicación**: el Principio IV no acepta que la garantía dependa de la disciplina de quien escribe la próxima consulta
- [X] T013 Exportar lo nuevo desde `src/db/esquema/index.ts` y generar la migración
- [X] T014 Aplicar la migración en desarrollo y en pruebas, y confirmar que `tests/aislamiento/toda-tabla-protegida.test.ts` reconoce las cuatro tablas nuevas sin haberlas nombrado

**Checkpoint**: el esquema está en pie y blindado.

---

## Phase 3: User Story 1 — El ciclo completo de un vehículo (Priority: P1) 🎯 MVP

**Goal**: que un operario registre entradas y salidas con un solo campo, y que la salida
cobre de verdad.

**Independent Test**: recorridos 1, 2 y 3 de [quickstart.md](quickstart.md).

### Tests for User Story 1

> **Se consolidaron al implementarlas.** Los casos de T016 a T023 viven en tres archivos
> —`taquilla-ciclo.test.ts` con 21 pruebas, `taquilla-garantias.test.ts` con 10 y
> `a-no-alcanza-b-movimientos.test.ts` con 7— en vez de nueve. Montar el mismo
> establecimiento con tarifas nueve veces no habría probado nada más.

- [X] T015 [P] [US1] `tests/unit/clasificar-vehiculo.test.ts`: la placa que termina en dígito es carro y la que termina en letra es moto; una placa imposible se rechaza y **no se clasifica por defecto**
- [X] T016 [P] [US1] `tests/integracion/taquilla-ciclo.test.ts`: entrada, salida y cierre, con los dos operarios y las dos marcas de tiempo registrados
- [X] T017 [P] [US1] `tests/integracion/taquilla-una-vez-adentro.test.ts`: la misma placa no entra dos veces, **ni siquiera con dos inserciones simultáneas** — se prueba lanzándolas en paralelo, no en secuencia
- [X] T018 [P] [US1] `tests/integracion/taquilla-cobro.test.ts`: el importe coincide exactamente con el que arroja `aplicarConvenios` para la misma permanencia, tarifa y convenios. Es la prueba que conecta la taquilla con el motor ya probado
- [X] T019 [P] [US1] `tests/integracion/historial-inmutable.test.ts`: un movimiento cerrado no se puede modificar ni borrar **con una consulta directa**, no sólo desde la interfaz
- [X] T020 [P] [US1] `tests/integracion/cobro-congelado.test.ts`: cambiar la tarifa y los convenios después de cobrar no altera el importe ni el desglose guardados
- [X] T021 [P] [US1] `tests/integracion/taquilla-cortesia.test.ts`: sin motivo no cierra; con motivo cierra en cero, guarda el autor y cuánto se habría cobrado, y se distingue de un cobro que dio cero
- [X] T022 [P] [US1] `tests/aislamiento/a-no-alcanza-b-movimientos.test.ts`: un operario de A no alcanza los movimientos de B, ni por listado ni yendo directo al identificador
- [X] T023 [P] [US1] `tests/integracion/taquilla-restringido.test.ts`: con el establecimiento suspendido no entra nadie y todos los que están adentro pueden salir

### Implementation for User Story 1

- [X] T024 [US1] Crear `src/dominio/vehiculos/clasificar.ts`, puro: la regla del último carácter y la correspondencia con el código del catálogo. **Un solo lugar donde la regla y el catálogo se tocan**, para que cambiar la regla no obligue a buscarla por todas partes
- [X] T025 [US1] Crear `src/dominio/taquilla/resolver.ts` con `resolverPlaca`, que devuelve entrada, salida o rechazo. Es la función que hace posible el campo único
- [X] T026 [US1] Crear `src/dominio/taquilla/registrar.ts` con `registrarEntrada`, incluido el código legible con la sigla del establecimiento y el aviso cuando el tipo no tiene tarifa
- [X] T027 [US1] Traducir el choque del índice único a un mensaje legible en `src/dominio/taquilla/registrar.ts`: que se lea "ese carro ya está adentro" y no un error del motor
- [X] T028 [US1] Añadir `registrarSalida` a `src/dominio/taquilla/registrar.ts`, que **consulta el historial** para contar cuántas veces se aplicó cada convenio ese día a esa placa. Es el consumidor que faltaba para el contrato de los convenios
- [X] T029 [US1] Guardar en el movimiento la copia embebida del cobro y de la tarifa usada desde `src/dominio/taquilla/registrar.ts`, con valores y no referencias (D3)
- [X] T030 [US1] Añadir `registrarCortesia` a `src/dominio/taquilla/registrar.ts`, que calcula el importe igual que si fuera a cobrar y lo guarda como "lo que se habría cobrado"
- [X] T031 [US1] Crear las acciones de servidor en `src/app/(establecimiento)/taquilla/acciones.ts`
- [X] T032 [US1] Construir el campo único en `src/app/(establecimiento)/taquilla/campo-placa.tsx`: centrado, la placa en letra grande, y Enter que resuelve
- [X] T033 [US1] Construir la pantalla en `src/app/(establecimiento)/taquilla/page.tsx`, con el aviso de confirmación antes de registrar y el desglose completo al cobrar
- [X] T034 [US1] Añadir a `src/app/(establecimiento)/taquilla/page.tsx` los controles de los convenios de sello, uno por convenio vigente y rotulado con su nombre. **Ninguna condición puede mencionar un comercio concreto**
- [X] T035 [US1] Añadir la taquilla a la navegación del establecimiento en `src/app/(establecimiento)/nav.tsx`

**Checkpoint**: un parqueadero ya puede operar.

---

## Phase 4: User Story 2 — Saber quién atendió y en qué turno (Priority: P2)

**Goal**: sesiones de turno con hora real, y cada movimiento atribuido.

**Independent Test**: recorrido 5 de [quickstart.md](quickstart.md).

### Tests for User Story 2

- [X] T036 [P] [US2] `tests/integracion/sesiones-turno.test.ts`: abrir guarda la hora real además de la programada; una persona no abre dos sesiones a la vez; cerrar se permite con vehículos adentro
- [X] T037 [P] [US2] `tests/integracion/turno-por-extremo.test.ts`: un vehículo que entra en un turno y sale en otro guarda **un turno por extremo**, no uno solo
- [X] T038 [P] [US2] `tests/integracion/sin-sesion-abierta.test.ts`: sin ninguna sesión abierta el movimiento se registra igual y queda sin turno. No se deja un carro afuera porque nadie abrió una sesión

### Implementation for User Story 2

- [X] T039 [US2] Crear `src/dominio/turnos/sesiones.ts` con `abrirSesion`, `cerrarSesion` y `sesionAbiertaDe`, que devuelve nulo sin error
- [X] T040 [US2] Atribuir la sesión abierta en cada extremo desde `src/dominio/taquilla/registrar.ts`
- [X] T041 [US2] Construir el panel de turno en `src/app/(establecimiento)/taquilla/panel-turno.tsx`: el turno abierto con su nombre, quién lo abrió, la hora de inicio y de fin, y el botón de cerrar

**Checkpoint**: se puede saber quién atendió cada movimiento.

---

## Phase 5: User Story 3 — Ver cuántos hay adentro (Priority: P3)

**Goal**: la ocupación por tipo, contrastada con la capacidad ya declarada.

**Independent Test**: recorrido 5 de [quickstart.md](quickstart.md), segunda parte.

### Tests for User Story 3

- [X] T042 [P] [US3] `tests/integracion/ocupacion.test.ts`: el conteo por tipo coincide con los movimientos sin salida, sube al entrar y baja al salir
- [X] T043 [P] [US3] `tests/integracion/ocupacion-sin-capacidad.test.ts`: un tipo sin capacidad declarada muestra cuántos hay **sin inventar un máximo**

### Implementation for User Story 3

- [X] T044 [US3] Crear `src/dominio/taquilla/ocupacion.ts` con `ocupacionActual`
- [X] T045 [US3] Mostrar la ocupación en `src/app/(establecimiento)/taquilla/page.tsx` y avisar —sin impedir— cuando se supere la capacidad. Quien está en la taquilla ve el vehículo y sabe si cabe mejor que el sistema
- [X] T046 [US3] La ocupación quedó en la taquilla, que es donde la maqueta 1b la pone, en vez de en la pantalla de horario: el panel «Adentro ahora» es de quien atiende, no de quien configura

---

## Phase 6: El comprobante

**Purpose**: lo que el spike habilitó. Va aparte de la historia 1 porque su fallo no puede
tumbarla, y esa separación es la decisión D2.

- [X] T047 [P] Crear `src/dominio/taquilla/comprobante.ts` con `comprobanteDe`, que sirve igual para la primera emisión y para reemitir: es una lectura y no cambia nada
- [X] T048 Añadir `marcarComprobanteEmitido` y `movimientosSinComprobante` a `src/dominio/taquilla/comprobante.ts`. Sin la lista, el aviso se pierde en cuanto llega el vehículo siguiente
- [X] T049 Crear `src/app/(establecimiento)/taquilla/imprimir.ts`, **el único archivo que sabe de impresión**, según lo que confirmó el spike
- [X] T050 [P] `tests/integracion/comprobante-pendiente.test.ts`: un fallo de impresión **no impide** que la entrada se registre; el movimiento queda pendiente y aparece en la lista
- [X] T051 Añadir la lista de pendientes a `src/app/(establecimiento)/taquilla/page.tsx`, con la acción de reemitir sin duplicar el movimiento

---

## Phase 7: Correcciones y delegación

**Purpose**: la única operación delegable que introduce esta funcionalidad.

- [X] T052 [P] `tests/integracion/correccion.test.ts`: la corrección conserva **los dos importes**; un operario sin delegación no puede emitirla; con delegación sí; revocada deja de poder y las ya emitidas se conservan
- [X] T053 [P] `tests/aislamiento/delegacion-no-cruza.test.ts`: una delegación no alcanza fuera del establecimiento de quien la otorga
- [X] T054 Crear `src/dominio/correcciones/emitir.ts` con `emitirCorreccion`, `otorgarDelegacion` y `revocarDelegacion`
- [X] T055 Comprobar la delegación **dentro de `src/lib/autorizacion.ts`**, no en las pantallas. Ocultar un botón no es control de acceso, y la constitución lo dice con esas palabras
- [X] T056 Añadir la gestión de delegaciones a la ficha de cuenta en `src/app/(plataforma)/cuentas/[id]/` o a la pantalla de operarios, donde el administrador ya gestiona a su gente
- [X] T057 Añadir la corrección a `src/app/(establecimiento)/taquilla/`, desde donde se consulta un movimiento cerrado

---

## Phase 8: Polish & Cross-Cutting

- [X] T058 Correr los seis recorridos de `specs/004-taquilla-vehiculos/quickstart.md` contra la base de desarrollo
- [X] T059 [P] Verificar que `tests/unit/cero-valores-quemados.test.ts` sigue verde: esta funcionalidad no declara ningún valor de negocio, así que no debería necesitar ninguna excepción nueva
- [X] T060 [P] Confirmar que ninguna condición del código menciona un convenio o comercio concreto, recorriendo `src/dominio/taquilla/` y `src/app/(establecimiento)/taquilla/`
- [X] T061 Correr `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` y `npx next build`. Reiniciar el servidor de desarrollo después del build
- [X] T062 Actualizar `docs/roadmap.md`: F3 entregada, con la decisión de impresión y su resultado

---

## Dependencies & Execution Order

### Phase Dependencies

- **Spike (T001–T004)**: sin dependencias. **Bloquea la fase 6 y puede invalidar D1**
- **Setup (T005)**: sin dependencias, puede ir en paralelo con el spike
- **Foundational (T006–T014)**: depende del Setup. **Bloquea las tres historias**
- **US1 (T015–T035)**: depende de Foundational. Es el MVP
- **US2 (T036–T041)**: depende de Foundational. Toca `registrar.ts`, que US1 crea, así que
  en la práctica va después
- **US3 (T042–T046)**: depende de Foundational y de que existan movimientos, así que
  después de US1
- **Comprobante (T047–T051)**: dependía del spike y de US1. **Hecho, invirtiendo el orden
  a propósito.** Apareció una impresora de cable prestada por unas horas, y llegar a esa
  ventana con sólo la página suelta del spike habría desperdiciado la única oportunidad de
  probar el producto de verdad. El riesgo de la inversión es acotado: si el spike
  desmiente D1, lo único que se rehace es `imprimir.ts` —el único archivo que sabe de
  impresión—, porque el comprobante es un dato, el papel es un documento y ninguno de los
  dos sabe por dónde sale. Sin modo silencioso todo esto sigue funcionando, con un diálogo
  por vehículo
- **Correcciones (T052–T057)**: depende de Foundational y de US1
- **Polish (T058–T062)**: al final

### Oportunidades de paralelismo

- Las cuatro tablas nuevas (T006, T009, T010, T011) son archivos distintos
- Las nueve pruebas de US1 (T015–T023) entre sí
- El spike (T001–T004) y la mudanza de placa (T005) no se estorban

---

## Implementation Strategy

### MVP: el spike, los cimientos y la historia 1

1. Cerrar el spike. Si falla, revisar D1 antes de seguir
2. Setup + Foundational
3. Historia 1 completa
4. **Parar y validar**: recorridos 1 y 3 del quickstart
5. Con eso un parqueadero ya cobra. Es la primera vez que el producto sirve para lo que se
   vende

### Entrega incremental

1. Cimientos → el esquema blindado
2. + Historia 1 → el parqueadero opera (MVP)
3. + Comprobante → deja de depender de que alguien apunte la placa a mano *(en espera del
   spike)*
4. + Historia 2 → se sabe quién atendió
5. + Correcciones → se puede arreglar un cobro equivocado
6. + Historia 3 → se ve cuánto queda libre

---

## Notes

- **El spike va primero y puede tumbar una decisión.** Es su propósito. Si el modo
  silencioso no funciona, es mejor saberlo con cero código escrito
- La impresión vive en **un solo archivo**. Si mañana hay que cambiar de mecanismo, se
  cambia ahí y no en la pantalla
- Ninguna tarea reimplementa el cálculo del cobro. La taquilla lo consume: `calcularImporte`,
  `aplicarConvenios`, `conveniosAplicables`, `diaDeAplicacion`, `politicaDeCobro`,
  `tarifaVigenteEn` y `horarioDelCobro` ya existen y están probados
- **T017 y T019 son las dos pruebas que no se pueden ablandar.** Una placa adentro dos
  veces y un movimiento cerrado editable son los dos fallos que el sistema no debe poder
  tener, y las dos se prueban contra el motor y no contra la interfaz
