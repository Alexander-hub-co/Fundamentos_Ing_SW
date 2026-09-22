---
description: "Task list for feature implementation"
---

# Tasks: Convenios y descuentos configurables

**Input**: Design documents from `specs/003-convenios-configurables/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/dominio.md](contracts/dominio.md)

**Alcance**: las dos historias que quedaron. Hubo una tercera —el asistente de IA— que se
**descartó por completo, no se aplazó**: la variedad que iba a interpretar resultó estar
acotada y se cubre enumerando opciones. No hay ninguna tarea suya, ni de proveedor de
modelo, ni de variables de entorno, ni código esperándola.

**Tests**: incluidos y obligatorios. No es una preferencia: la constitución exige que los
principios I (aislamiento) y IV (integridad del historial) se verifiquen con pruebas
automatizadas y no con revisión visual, y esta funcionalidad toca cobro.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece la tarea

---

## Phase 1: Setup

**Purpose**: el vocabulario, como tipos del motor

- [X] T001 Añadir las tres enumeraciones en `src/db/esquema/enums.ts`: `activacion_convenio` (`sello`, `placa`), `beneficio_convenio` (`minutos_gratis`, `porcentaje`, `tarifa_fija`, `sin_cobro`) y `regla_redondeo` (`peso`, `cincuentena`, `centena`), exportando sus tipos derivados como ya se hace con `modeloCobro`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: esquema, migración y tipos compartidos. Nada de las historias puede empezar
antes.

**⚠️ Bloquea todo**: sin esto la aplicación no compila, porque `descuentoPct` desaparece.

- [X] T002 Ampliar la tabla en `src/db/esquema/convenio.ts`: columnas `activacion`, `beneficio`, `valor`, `topePesos`, `limiteDiario` y `creadoPor`; eliminar `descuentoPct`. Ver [data-model.md](data-model.md)
- [X] T003 Añadir a `src/db/esquema/convenio.ts` la restricción `convenio_parametros_del_beneficio` con una rama por beneficio, siguiendo el patrón de `tarifa_parametros_del_modelo` en `src/db/esquema/tarifa.ts`; más `convenio_tope_valido` y `convenio_limite_valido` (rechaza el cero en el motor, no sólo en el formulario)
- [X] T004 [P] Crear `src/db/esquema/politica-cobro.ts` con una fila como máximo por establecimiento (`parqueaderoId` único), columna `redondeo` y política de ámbito con RLS forzada
- [X] T005 [P] Crear `src/dominio/cobro/redondeo.ts` con las tres reglas puras y la constante `REDONDEO_INICIAL`, documentada como valor por defecto sobrescribible (FR-011a). Ninguna regla puede subir el total (FR-011b)
- [X] T006 Exportar lo nuevo desde `src/db/esquema/index.ts`
- [X] T007 Añadir los tipos compartidos `ConvenioAplicable` y `CobroConConvenios` en `src/dominio/tarifas/modelos.ts`, para que las pruebas de ambas historias puedan escribirse antes que la implementación
- [X] T008 Generar la migración y escribir a mano el paso de datos: traducir cada convenio existente a `activacion='placa'`, `beneficio='porcentaje'`, `valor=descuento_pct`, y sólo después eliminar la columna vieja. Todo en la misma migración, sin pasos manuales (FR-006, D5)
- [X] T009 Adaptar los lugares que hoy leen `descuentoPct` para que compilen: `descuentoParaPlaca` y `conveniosDelEstablecimiento` en `src/dominio/convenios/gestionar.ts`, y el conteo de convenios vigentes en `src/dominio/parqueaderos/configuracion-resumen.ts`
- [X] T010 Correr `npx tsc --noEmit`, `npx vitest run` y la migración contra la base de desarrollo; confirmar que la prueba estructural de `tests/aislamiento/toda-tabla-protegida.test.ts` reconoce `politica_cobro` sin haberla nombrado

**Checkpoint**: el esquema nuevo está en pie, los datos viejos traducidos y el árbol
compila. Las historias pueden empezar.

---

## Phase 3: User Story 1 — Declarar los convenios reales (Priority: P1) 🎯 MVP

**Goal**: que una administradora pueda declarar sus cuatro acuerdos —fruver, carnicería,
cliente frecuente y mensualidad— sin que nadie toque el código.

**Independent Test**: declarar los cuatro desde la pantalla de Convenios, verlos listados
con su activación y su beneficio en palabras, y comprobar que el sistema rechaza un
convenio incompleto. Recorrido 1 de [quickstart.md](quickstart.md).

### Tests for User Story 1

> Escribir primero y confirmar que fallan antes de implementar.

- [X] T011 [P] [US1] Prueba de integración en `tests/integracion/convenios-vocabulario.test.ts`: los cuatro acuerdos del negocio se declaran y se releen con su activación y beneficio correctos
- [X] T012 [P] [US1] Prueba de integración en `tests/integracion/convenios-validacion.test.ts`: se rechaza un porcentaje sin valor, un `sin_cobro` con valor, un límite diario de cero y un tope negativo. Cada rechazo llega como mensaje del dominio, no como violación de restricción cruda
- [X] T013 [P] [US1] Prueba de integración en `tests/integracion/convenios-migracion.test.ts`: un convenio del modelo anterior queda traducido a placa + porcentaje conservando valor, placas y vigencia (FR-006), **y el índice único de una-placa-un-convenio sigue en pie después de migrar** (FR-017): es lo que hace determinista qué descuento le corresponde a una placa
- [X] T014 [P] [US1] Prueba negativa en `tests/aislamiento/a-no-alcanza-b-convenios.test.ts` —el archivo ya existía y se extendió en vez de duplicarlo—: un administrador del establecimiento A no alcanza los convenios de B, ni por lista ni por identificador directo (Principio I, FR-016)
- [X] T015 [P] [US1] Prueba de integración en `tests/integracion/convenios-soporte.test.ts`: el administrador general declara un convenio para un establecimiento ajeno por la puerta acotada, el autor queda registrado y distinguible, y se escribe el asiento de uso de privilegio (FR-016a, FR-016b)

### Implementation for User Story 1

- [X] T016 [US1] Reescribir `declararConvenio` en `src/dominio/convenios/gestionar.ts` con el vocabulario nuevo, validando en el dominio lo mismo que valida el CHECK para que el error llegue como texto legible
- [X] T017 [US1] Registrar el autor de cada convenio en `src/dominio/convenios/gestionar.ts`, tomándolo del contexto; un identificador ajeno al establecimiento **es** la marca de soporte (D7)
- [X] T018 [US1] Actualizar `conveniosDelEstablecimiento` para que devuelva el vocabulario completo y una descripción en palabras de cada convenio, con un `switch` exhaustivo y sin rama por defecto, como se hizo con `resumen()` en tarifas
- [X] T019 [US1] Actualizar las acciones de servidor en `src/app/(establecimiento)/configuracion/convenios/acciones.ts`
- [X] T020 [US1] Rehacer el formulario en `src/app/(establecimiento)/configuracion/convenios/`: selector de activación, selector de beneficio con los campos que cambian según el elegido, tope opcional, y el límite diario como **elección explícita** entre "sin límite" y un número — nunca un campo en blanco (FR-004a-bis)
- [X] T021 [US1] Actualizar la lista en `src/app/(establecimiento)/configuracion/convenios/page.tsx` para mostrar activación y beneficio en palabras, y señalar los declarados por soporte

### Vigencias con nombre (añadidas el 2026-08-19)

> Salieron de descartar el asistente de IA: lo que hacía falta no era interpretar prosa
> sino ofrecer las duraciones con las que el negocio nombra sus acuerdos largos. Se
> numeran a partir de T044 para no mover los identificadores de lo ya hecho.

- [X] T044 [US1] Añadir la enumeración `periodicidad_convenio` (`mensual`, `trimestral`, `semestral`, `anual`) en `src/db/esquema/enums.ts`
- [X] T045 [US1] Añadir la columna `periodicidad` a `src/db/esquema/convenio.ts`, con un CHECK que exija fecha de vencimiento cuando la duración está declarada: una mensualidad que no vence no es una mensualidad (FR-005c)
- [X] T046 [P] [US1] Crear `src/dominio/convenios/vigencia.ts` con `vencimientoDe(desde, periodicidad)`, puro. **Debe recortar al último día del mes destino**: `setMonth` sobre el 31 de enero devuelve el 3 de marzo, no el 28 de febrero (FR-005b)
- [X] T047 [P] [US1] `tests/unit/vigencia-convenio.test.ts`: las cuatro duraciones, y el caso que importa —una mensualidad que empieza el 31 de enero vence el 28 o el 29 de febrero, nunca en marzo—
- [X] T048 [US1] Escribir la migración en `src/db/migraciones/` y aplicarla en desarrollo y en pruebas
- [X] T049 [US1] Aceptar la duración en `declararConvenio` calculando el vencimiento, y nombrarla en `describirConvenio` en vez de mostrar una fecha suelta, en `src/dominio/convenios/gestionar.ts`
- [X] T050 [US1] Ofrecer las duraciones en el formulario de `src/app/(establecimiento)/configuracion/convenios/panel.tsx`, junto a "fecha concreta" y "sin vencimiento"
- [X] T051 [P] [US1] Extender `tests/integracion/convenios-vocabulario.test.ts` con la mensualidad declarada por duración, comprobando que el vencimiento se calcula y que la descripción la nombra

**Checkpoint**: los cuatro acuerdos reales se declaran y se ven, y los de larga duración se
declaran por su nombre. La historia 1 funciona sola.

---

## Phase 4: User Story 2 — Comprobar el efecto (Priority: P2)

**Goal**: que la administradora vea qué va a cobrar de verdad, con el desglose que lo
explica, antes de que llegue un cliente.

**Independent Test**: los siete casos del recorrido 2 de [quickstart.md](quickstart.md),
más el recorrido 3 del redondeo.

### Tests for User Story 2

> El calculador es puro, así que todo esto son pruebas unitarias sin base de datos.
>
> **Al implementarlas se consolidaron.** Los casos de T022 a T030 viven en tres archivos
> —`convenios-aplicar.test.ts` con 21 pruebas, `convenios-dia-de-aplicacion.test.ts` y
> `redondeo.test.ts`— en lugar de ocho. Partir en ocho archivos habría repetido el mismo
> montaje ocho veces sin ganar nada: son la misma función pura vista desde ángulos
> distintos. Se añadió además `tests/integracion/convenios-aplicables.test.ts` para las dos
> funciones nuevas que sí tocan la base.

- [X] T022 [P] [US2] `tests/unit/convenios-minutos-gratis.test.ts`: con 60 minutos gratis, una permanencia de 5 horas cobra 4 horas; y **dos sellos a la vez suman** —60 del fruver más 30 de la carnicería descuentan 90 (FR-008a)—, que es el cliente que compró en los dos comercios. **El caso que importa**: con horario que no cobra las horas cerradas, los minutos gratis salen de los minutos COBRABLES y no del reloj (FR-007, D1)
- [X] T023 [P] [US2] `tests/unit/convenios-sin-saldo-a-favor.test.ts`: 40 minutos de permanencia con 60 gratis dan cero, nunca negativo (FR-010)
- [X] T024 [P] [US2] `tests/unit/convenios-acumulacion.test.ts`: 50 % y 20 % descuentan el 70 % —no el 60 % de encadenarlos—, y tres del 40 % se acotan al 100 % con el desglose diciendo que se recortó (FR-008b, FR-008c)
- [X] T025 [P] [US2] `tests/unit/convenios-limite-diario.test.ts`: un convenio de una vez al día no se aplica cuando las aplicaciones previas llegan a una, y el desglose dice por qué; con cero previas sí se aplica (FR-013a)
- [X] T026 [P] [US2] `tests/unit/convenios-dia-de-aplicacion.test.ts`: la frontera del día es el día calendario en la zona del establecimiento, de medianoche a medianoche y no una ventana móvil (FR-004b); y una permanencia que entra el martes a las 23:00 y sale el miércoles a las 02:00 cuenta contra el **miércoles**, porque es cuando el convenio se aplica y se cobra (FR-004c)
- [X] T027 [P] [US2] `tests/unit/convenios-topes.test.ts`: el tope en pesos recorta el aporte de su convenio y el desglose lo señala (FR-004)
- [X] T028 [P] [US2] `tests/unit/convenios-cortocircuito.test.ts`: `tarifa_fija` y `sin_cobro` determinan el total solos, y los beneficios de tiempo quedan anotados como desplazados (FR-009)
- [X] T029 [P] [US2] `tests/unit/redondeo.test.ts`: las tres reglas, y la invariante de que **ninguna sube el total** — $6.850 a la centena da $6.800 (FR-011b)
- [X] T030 [P] [US2] `tests/unit/convenios-determinismo.test.ts`: el mismo cálculo repetido da el mismo resultado, y ninguna combinación supera el importe de la tarifa sola (FR-013, SC-005a, SC-008)
- [X] T031 [US2] Extender la prueba de pureza existente para que cubra también `src/dominio/convenios/aplicar.ts`: no puede importar nada de `src/db` ni leer el reloj

### Implementation for User Story 2

- [X] T032 [US2] Añadir el parámetro opcional `minutosGratis` a `calcularImporte` en `src/dominio/tarifas/calcular.ts`, consumido desde el comienzo de la permanencia tramo por tramo. **Valor por defecto cero**, para que ninguna llamada actual cambie (D1)
- [X] T033 [US2] Crear `src/dominio/convenios/aplicar.ts` con la función pura que compone tarifa, convenios y redondeo en el orden declarado, y devuelve el desglose completo incluyendo el motivo de cada convenio no aplicado
- [X] T034 [US2] Añadir `politicaDeCobro` y `fijarRedondeo` en `src/dominio/cobro/politica.ts` —archivo aparte del `redondeo.ts` puro, porque éstas sí tocan la base—, con la ausencia de fila resolviéndose al valor inicial (D2)
- [X] T035 [US2] Crear `src/dominio/convenios/dia.ts` con `diaDeAplicacion(momento)`, puro, reutilizando la zona horaria y el manejo de medianoche que ya viven en `src/dominio/calendario/expandir.ts` en vez de reimplementarlos (FR-004b, FR-004c)
- [X] T036 [US2] Añadir `conveniosAplicables(contexto, placa, momento)` en `src/dominio/convenios/consultar.ts`, que separa los automáticos de los de sello (FR-019) y devuelve además el día contra el que se cuenta el límite. **Lo consume el comprobador**, no se deja como función sin llamar
- [X] T037 [US2] Construir el comprobador en `src/app/(establecimiento)/configuracion/convenios/comprobador.tsx`, siguiendo el patrón del probador de tarifas: entrada, salida, placa opcional, casilla por convenio, campo para simular las aplicaciones previas del día, la leyenda de contra qué día se cuentan —que es lo que vuelve visible la regla de la medianoche— y desglose completo
- [X] T038 [US2] Añadir la regla de redondeo a `src/app/(establecimiento)/configuracion/horario/`, con las tres opciones y una explicación de qué hace cada una

**Checkpoint**: los siete casos del comprobador dan lo esperado y el redondeo se ve
funcionando.

---

## Phase 5: Polish & Cross-Cutting

- [X] T039 Correr los cinco recorridos de `specs/003-convenios-configurables/quickstart.md` contra la base de desarrollo, incluido el recorrido 5 sobre una base con convenios del modelo anterior
- [X] T040 [P] Verificar que `tests/unit/cero-valores-quemados.test.ts` sigue verde y que ningún importe nuevo quedó en el código
- [X] T041 [P] Recorrer `src/dominio/convenios/` y `src/app/(establecimiento)/configuracion/convenios/` confirmando que ninguna condición menciona un convenio o comercio concreto (FR-020): declarar uno nuevo debe bastar para que aparezca donde corresponde
- [X] T042 Correr `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` y `npx next build`. Reiniciar el servidor de desarrollo después del build, porque el estado mezclado de `.next` sirve HTML viejo
- [X] T043 Actualizar `docs/roadmap.md` dejando constancia de que el asistente de IA se descartó y por qué: la variedad estaba acotada y se cubrió enumerando

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sin dependencias
- **Foundational (T002–T010)**: depende del Setup. **Bloquea ambas historias**: sin la
  migración el árbol no compila, porque `descuentoPct` deja de existir
- **US1 (T011–T021)**: depende de Foundational
- **US2 (T022–T038)**: depende de Foundational. **No depende de US1**: el calculador es
  puro y sus pruebas construyen los convenios en memoria, sin declararlos por pantalla
- **Polish (T039–T043)**: depende de las historias que se quieran entregar

### Dentro de cada historia

- Las pruebas se escriben primero y deben fallar antes de implementar
- En US1: dominio (T016–T018) antes que interfaz (T019–T021)
- En US2: el redondeo (T034) y el parámetro del calculador (T032) antes que la composición
  (T033); la frontera del día (T035) antes de `conveniosAplicables` (T036), que la devuelve;
  y todo eso antes que el comprobador (T037), que es quien lo muestra

### Oportunidades de paralelismo

- T004 y T005 en paralelo: archivos nuevos y distintos
- Las cinco pruebas de US1 (T011–T015) en paralelo entre sí
- Las nueve pruebas unitarias de US2 (T022–T030) en paralelo entre sí: son archivos
  distintos y ninguna toca la base
- Con dos personas, US1 y US2 en paralelo una vez cerrada la fase fundacional

---

## Implementation Strategy

### MVP: sólo la historia 1

1. Setup + Foundational
2. Historia 1 completa
3. **Parar y validar**: recorrido 1 del quickstart
4. Ya hay algo vendible: un parqueadero con convenios de sello puede registrar sus
   acuerdos, cosa que hoy es imposible

### Entrega incremental

1. Foundational → el esquema nuevo en pie y los datos viejos migrados
2. + Historia 1 → se declaran los acuerdos reales (MVP)
3. + Historia 2 → se comprueban antes de que lleguen los clientes
4. No hay una cuarta etapa: el asistente de IA se descartó, no quedó pendiente

---

## Notes

- Ninguna tarea aplica convenios a movimientos reales, y es deliberado: los movimientos
  llegan con la taquilla. El contrato que tendrá que cumplir está escrito en
  [contracts/dominio.md](contracts/dominio.md) §4
- `conveniosAplicables` (T036) **se construye con un consumidor**, el comprobador. Este
  proyecto ya tuvo el problema de funciones de dominio completas y probadas que nadie
  llamaba, y el síntoma fue una brecha de seguridad que ninguna prueba veía
- Confirmar después de cada tarea o grupo lógico
