# Tareas: Configuración del establecimiento

**Rama**: `002-configuracion-establecimiento` · **Plan**: [plan.md](plan.md) · **Spec**: [spec.md](spec.md)

Orden por dependencia, no por comodidad. Dos criterios gobiernan la secuencia:

1. **Lo puro va primero.** Las jornadas y el calculador no dependen de nada y son la pieza de más
   riesgo. Resolverlas antes de construir encima evita descubrir un error de medianoche cuando ya
   hay cinco pantallas apoyadas en él.
2. **Cada bloque cierra con su prueba negativa A↛B** antes de pasar al siguiente. Retrofitear el
   ámbito después es exactamente el trabajo que nunca se termina de hacer bien.

**Sobre el orden de las historias**: US4 (turnos) va antes que US3 (equipo) porque así se pidió, y
la dependencia no bloquea — F1 ya permite crear cuentas desde la plataforma, así que hay gente a
quien asignar antes de que el administrador del establecimiento pueda crearla él mismo.

---

## Phase 1: Setup

- [X] T001 Crear el enum `modelo_cobro` con los valores `por_minuto` y `por_intervalo` en `src/db/esquema/enums.ts`
- [X] T002 Crear el enum `alcance_plena` con los valores `estadia` y `jornada` en `src/db/esquema/enums.ts`
- [X] T003 [P] Crear la tabla `tipo_vehiculo` en `src/db/esquema/tipo-vehiculo.ts`, sin `parqueadero_id` y sin RLS, documentando en el propio archivo por qué es la excepción
- [X] T004 Sembrar el catálogo con automóvil, motocicleta y bicicleta en `src/db/semilla-catalogo.ts`, marcado explícitamente como dato de inicialización sobrescribible

---

## Phase 2: Foundational (bloquea todo lo demás)

Las nueve tablas con su ámbito y sus políticas. Ninguna historia puede empezar sin esto.

- [X] T005 [P] Crear la tabla `tarifa` con sus columnas de ambos modelos y su rango de vigencia en `src/db/esquema/tarifa.ts`
- [X] T006 Añadir a `tarifa` el CHECK por modelo: `por_minuto` exige mínima, valor por minuto y plena; `por_intervalo` exige intervalo, valor del intervalo y plena; cada uno anula las columnas del otro, en `src/db/esquema/tarifa.ts`
- [X] T007 Añadir a `tarifa` el índice único parcial sobre `(parqueadero_id, tipo_vehiculo_id) WHERE vigente_hasta IS NULL`, que es lo que impide dos versiones abiertas del mismo par, en `src/db/esquema/tarifa.ts`
- [X] T008 Añadir a `tarifa` los CHECK de no negatividad, `intervalo_minutos > 0`, `tarifa_minima <= tarifa_plena` y `vigente_hasta > vigente_desde`, en `src/db/esquema/tarifa.ts`
- [X] T009 [P] Crear las tablas `horario_atencion` y `horario_franja` en `src/db/esquema/horario.ts`, con `parqueadero_id` denormalizado en la franja
- [X] T010 [P] Crear la tabla `capacidad` con su único por `(parqueadero_id, tipo_vehiculo_id)` y CHECK `cupos >= 0` en `src/db/esquema/capacidad.ts`
- [X] T011 [P] Crear las tablas `turno`, `turno_dia` y `turno_asignacion` en `src/db/esquema/turno.ts`, con CHECK `hora_inicio <> hora_fin` y `parqueadero_id` denormalizado en las hijas
- [X] T012 [P] Crear las tablas `convenio` y `convenio_placa` en `src/db/esquema/convenio.ts`, con CHECK de descuento entre 0 y 100
- [X] T013 Añadir a `convenio_placa` el índice único parcial que hace determinista la resolución cuando una placa podría estar en dos convenios vigentes, en `src/db/esquema/convenio.ts`
- [X] T014 Declarar la política RLS de cada tabla nueva con `pgPolicy` y `.enableRLS()`, siguiendo el patrón de `parqueadero.ts` de F1
- [X] T015 Exportar las tablas nuevas desde `src/db/esquema/index.ts`
- [X] T016 Generar la migración con `drizzle-kit generate` y aplicarla en ambas bases con `npm run db:migrate` y `npm run db:migrate:test`
- [X] T017 Verificar que la guardia de `blindaje.sql` no encuentre ninguna tabla con `parqueadero_id` sin política; si falla, es que faltó una política y no que sobra la guardia

---

## Phase 3: US1 — Definir cuánto cobra el parqueadero (P1) 🎯 MVP

**Objetivo**: el establecimiento declara sus tarifas y puede comprobar el cálculo antes de que
llegue el primer cliente.

**Prueba independiente**: definir una tarifa de cada modelo y ejercitar el calculador con momentos
inventados, verificando importe y desglose. Sin vehículos, sin movimientos.

### Lo puro primero

- [X] T018 [P] [US1] Definir los tipos de tarifa como unión discriminada por `modelo` en `src/dominio/tarifas/modelos.ts`
- [X] T019 [P] [US1] Definir el tipo `Cobro` con importe y desglose —minutos cobrables, tramos, tope aplicado y por qué— en `src/dominio/tarifas/modelos.ts`
- [X] T020 [US1] Implementar `expandirHorario()` en `src/dominio/calendario/expandir.ts` —fuera de `tarifas/` porque lo consumen también horarios y turnos, y una función de calendario colgando del módulo de tarifas invita a un ciclo de dependencias—, que convierte las horas de reloj de un horario en ventanas de instantes absolutos sobre un rango de fechas; es el único lugar donde se razona sobre medianoches
- [X] T021 [US1] Implementar `partirEnJornadas()` en `src/dominio/tarifas/jornadas.ts`, con los tres casos: 24 horas cortando a medianoche, con horario descartando lo cerrado, y con horario cobrándolo con tramos contiguos
- [X] T022 [P] [US1] Probar `expandirHorario()` en `tests/unit/calendario.test.ts`: horario normal, horario que cruza la medianoche, día sin franjas, y rango que abarca varios días
- [X] T023 [P] [US1] Probar `partirEnJornadas()` en `tests/unit/jornadas.test.ts`: permanencia dentro de una jornada, permanencia que cruza una noche cerrada, permanencia enteramente dentro del periodo cerrado —que no produce ningún tramo—, y establecimiento de 24 horas
- [X] T024 [US1] Implementar el calculador del modelo por minuto en `src/dominio/tarifas/calcular.ts`, aplicando mínima por abajo y plena por arriba
- [X] T025 [US1] Implementar el calculador del modelo por intervalos en `src/dominio/tarifas/calcular.ts`, con techo de la división y plena por jornada
- [X] T026 [US1] Implementar `calcularImporte()` como único punto de entrada, con despacho por mapa `modelo → calculador`, en `src/dominio/tarifas/calcular.ts`, de modo que agregar un tercer modelo no obligue a tocar los existentes
- [X] T027 [US1] Implementar el respeto de `alcance_plena` en `src/dominio/tarifas/calcular.ts`: la plena topa toda la estadía o se reinicia en cada jornada, según lo declare la tarifa
- [X] T028 [US1] Verificar que `src/dominio/tarifas/calcular.ts` y `jornadas.ts` no importan nada de `src/db`; añadir una prueba en `tests/unit/pureza-calculador.test.ts` —en `unit` y no en `aislamiento`, que está reservado al aislamiento multi-parqueadero— que lo compruebe leyendo los imports, para que no se rompa sin que nadie se dé cuenta
- [X] T029 [P] [US1] Probar el modelo por minuto en `tests/unit/calcular.test.ts` con los ejemplos de la especificación: 5 minutos cobran la mínima, 60 cobran el cálculo directo, 250 topan en la plena
- [X] T030 [P] [US1] Probar el modelo por intervalos en `tests/unit/calcular.test.ts`: 10 y 30 minutos cobran un intervalo, 31 cobran dos, y la plena detiene el crecimiento dentro de la jornada
- [X] T031 [P] [US1] Probar el caso completo de la bicicleta que entra a las 19:30 y sale a las 7:10 con el establecimiento cerrado de noche, en `tests/unit/calcular.test.ts`; debe dar $4.500
- [X] T032 [P] [US1] Probar que dos establecimientos con decisiones opuestas de `alcance_plena` y de cobro de horas cerradas producen importes distintos para la misma permanencia, en `tests/unit/calcular.test.ts` (SC-012)
- [X] T033 [P] [US1] Probar que el desglose justifica el importe en todos los casos anteriores, en `tests/unit/calcular.test.ts` (SC-014)

### Escritura y consulta

- [X] T034 [US1] Implementar `declararTarifa()` en `src/dominio/tarifas/declarar.ts`, cerrando la versión vigente e insertando la nueva en la misma transacción
- [X] T035 [US1] Implementar la validación de `declararTarifa()`: parámetros que no corresponden al modelo, valores negativos, mínima mayor que plena, intervalo no positivo, y `alcance_plena` sin declarar, en `src/dominio/tarifas/declarar.ts`
- [X] T036 [US1] Implementar `tarifaVigenteEn()` en `src/dominio/tarifas/consultar.ts`, que devuelve la que regía en un instante dado y no necesariamente la actual
- [X] T037 [US1] Implementar `tiposSinTarifa()` en `src/dominio/tarifas/consultar.ts`, para que la pantalla diga qué falta antes de operar
- [X] T038 [US1] Exigir autorización y estado del establecimiento en las operaciones de tarifa, rechazando la escritura con el establecimiento suspendido y permitiendo la lectura, en `src/dominio/tarifas/declarar.ts` y `src/dominio/tarifas/consultar.ts`
- [X] T039 [P] [US1] Probar el versionado en `tests/integracion/tarifas.test.ts`: declarar, modificar, y comprobar que la anterior conserva su periodo y ninguna se borra
- [X] T040 [P] [US1] Probar en `tests/integracion/tarifas.test.ts` que no pueden existir dos versiones abiertas del mismo par, forzando el choque contra el índice único parcial
- [X] T041 [P] [US1] Probar en `tests/integracion/tarifas.test.ts` que el establecimiento suspendido rechaza la escritura y permite la lectura
- [X] T042 [US1] Escribir la prueba negativa de aislamiento de tarifas en `tests/aislamiento/a-no-alcanza-b-tarifas.test.ts`, comprobando además que el intento quedó anotado en `acceso_denegado` (SC-002): denegar sin dejar rastro deja el aislamiento sin auditar

---

## Phase 4: US2 — Declarar cuándo abre y cuánto cabe (P1)

**Objetivo**: el establecimiento declara su horario y su capacidad. El horario ya no es
informativo: alimenta la jornada tarifaria.

**Prueba independiente**: declarar un horario con días distintos y comprobar que el sistema informa
correctamente si está abierto en un momento dado, incluidos los cruces de medianoche.

- [X] T043 [P] [US2] Implementar `estaAbierto()` puro en `src/dominio/horarios/consultar.ts`, reutilizando `expandirHorario()`
- [X] T044 [P] [US2] Probar `estaAbierto()` en `tests/unit/horarios.test.ts`: dentro del horario, fuera, día cerrado, y horario que cruza la medianoche consultado a las 2:00
- [X] T045 [US2] Implementar `declararHorario()` en `src/dominio/horarios/declarar.ts`, con `abierto_24h`, `cobra_horas_cerradas` y las franjas por día
- [X] T046 [US2] Implementar la validación de franjas: hora de cierre igual a la de apertura, y solapes dentro del mismo día, en `src/dominio/horarios/declarar.ts`
- [X] T047 [US2] Implementar `declararCapacidad()` en `src/dominio/capacidad/declarar.ts`, rechazando cupos negativos
- [X] T048 [P] [US2] Probar horario y capacidad en `tests/integracion/horario-capacidad.test.ts`, incluida la suspensión
- [X] T049 [US2] Escribir las pruebas negativas de aislamiento de horario y capacidad en `tests/aislamiento/a-no-alcanza-b-horario.test.ts`, comprobando además el asiento en `acceso_denegado` (SC-002)

---

## Phase 5: US4 — Organizar quién trabaja y cuándo (P2)

**Objetivo**: el administrador crea sus turnos y asigna quién los cubre, incluido él mismo.

**Prueba independiente**: crear dos turnos con horarios y días distintos, asignar personas, y
comprobar qué turno rige en un momento dado. Sin que nadie haya abierto ningún turno.

- [X] T050 [P] [US4] Implementar `turnoVigenteEn()` puro en `src/dominio/turnos/consultar.ts`, reutilizando la expansión a instantes absolutos de las jornadas
- [X] T051 [P] [US4] Probar `turnoVigenteEn()` en `tests/unit/turnos.test.ts`: turno normal, turno nocturno consultado a las 2:00 del día siguiente, día sin turno, y dos turnos solapados
- [X] T052 [US4] Implementar `crearTurno()` y `editarTurno()` en `src/dominio/turnos/gestionar.ts`, con sus días en filas de `turno_dia`
- [X] T053 [US4] Implementar `activarTurno()` y `desactivarTurno()` en `src/dominio/turnos/gestionar.ts`, sin borrado físico
- [X] T054 [US4] Implementar `asignarATurno()` y `retirarDeTurno()` en `src/dominio/turnos/asignar.ts`, rechazando a quien no pertenece al establecimiento y aceptando administradores además de operarios
- [X] T055 [US4] Implementar `horasSinCubrir()` en `src/dominio/turnos/cobertura.ts`, que compara el horario de atención con los turnos activos y devuelve los huecos
- [X] T056 [P] [US4] Probar los turnos en `tests/integracion/turnos.test.ts`: creación, días, asignación múltiple, rechazo de persona ajena, desactivación sin borrado, suspensión, y dos establecimientos con organizaciones de turno opuestas —uno con un solo turno de todo el día, otro con tres y días especiales— conviviendo sin cambios en el sistema (SC-009)
- [X] T057 [P] [US4] Probar `horasSinCubrir()` en `tests/unit/turnos.test.ts`, comprobando que es aviso y no impedimento
- [X] T058 [US4] Escribir la prueba negativa de aislamiento de turnos en `tests/aislamiento/a-no-alcanza-b-turnos.test.ts`, comprobando además el asiento en `acceso_denegado` (SC-002)

---

## Phase 6: US3 — Armar el equipo de la taquilla (P2)

**Objetivo**: el administrador del establecimiento da de alta y gestiona a su propia gente, sin
pasar por la plataforma.

**Prueba independiente**: crear un operario desde la cuenta del administrador de un establecimiento
y comprobar que entra, que queda vinculado a ese local y sólo a ese, y que su administrador puede
bloquearlo.

- [X] T059 [US3] Añadir a `src/lib/autorizacion.ts` las operaciones de gestión de cuentas del propio establecimiento, con sus roles autorizados
- [X] T060 [US3] Verificar que ninguna operación nueva quede autorizada sólo para `operario`: todo administrador puede además lo que puede un operario (FR de roles acumulativos), en `src/lib/autorizacion.ts`
- [X] T061 [US3] Implementar `crearCuentaDeEstablecimiento()` en `src/dominio/cuentas/crear-en-establecimiento.ts`, reutilizando la asignación de código legible de F1
- [X] T062 [US3] Implementar el rechazo del rol de administrador general y de cualquier establecimiento distinto del propio, en `src/dominio/cuentas/crear-en-establecimiento.ts`
- [X] T063 [US3] Implementar `nombrarAdministrador()` en `src/dominio/cuentas/crear-en-establecimiento.ts`, acotado al propio establecimiento
- [X] T064 [US3] Implementar `gestionarCuentaDeEstablecimiento()` para bloquear, desbloquear, restablecer contraseña y dar de baja dentro del propio establecimiento, en `src/dominio/cuentas/gestionar-en-establecimiento.ts`
- [X] T065 [P] [US3] Probar el alta y la gestión en `tests/integracion/equipo.test.ts`, incluido el rechazo del rol de plataforma, el del establecimiento ajeno, y que el establecimiento suspendido rechaza el alta y permite la consulta (SC-005)
- [X] T066 [US3] Escribir la prueba negativa de aislamiento del equipo en `tests/aislamiento/a-no-alcanza-b-equipo.test.ts`, comprobando además el asiento en `acceso_denegado` (SC-002)

---

## Phase 7: US5 — Aplicar convenios a clientes habituales (P3)

**Objetivo**: el establecimiento registra descuentos por empresa o por placa. No se aplica ningún
cobro: sólo se informa.

**Prueba independiente**: registrar un convenio por empresa y otro por placa, y comprobar qué
descuento corresponde a una placa dada.

- [X] T067 [P] [US5] Implementar la normalización de placa —mayúsculas, sin espacios ni guiones— en `src/dominio/convenios/placa.ts`, con sus pruebas en `tests/unit/placa.test.ts`
- [X] T068 [US5] Implementar `registrarConvenio()`, `agregarPlaca()`, `quitarPlaca()` y `vencerConvenio()` en `src/dominio/convenios/gestionar.ts`
- [X] T069 [US5] Implementar `descuentoParaPlaca()` en `src/dominio/convenios/consultar.ts`, determinista cuando una placa podría estar en más de un convenio vigente
- [X] T070 [P] [US5] Probar los convenios en `tests/integracion/convenios.test.ts`: vigencia, vencimiento, placa sin convenio, la misma placa con convenio en un local y no en otro, y que el establecimiento suspendido rechaza la escritura y permite la lectura (SC-005)
- [X] T071 [US5] Escribir la prueba negativa de aislamiento de convenios en `tests/aislamiento/a-no-alcanza-b-convenios.test.ts`, comprobando además el asiento en `acceso_denegado` (SC-002)

---

## Phase 8: Pantallas

- [X] T072 [US1] Construir la pantalla de tarifas en `src/app/(establecimiento)/configuracion/tarifas/page.tsx`, mostrando qué tipos tienen tarifa y cuáles faltan
- [X] T073 [US1] Construir el formulario de tarifa con los campos que cambian según el modelo elegido, en `src/app/(establecimiento)/configuracion/tarifas/formulario.tsx`
- [X] T074 [US1] Construir el probador de cálculo en la misma pantalla: dos instantes de ejemplo, importe y desglose, en `src/app/(establecimiento)/configuracion/tarifas/probador.tsx`
- [X] T075 [US1] Mostrar el historial de versiones de cada tarifa con su periodo de vigencia, en `src/app/(establecimiento)/configuracion/tarifas/historial.tsx`
- [X] T076 [US2] Construir la pantalla de horario en `src/app/(establecimiento)/configuracion/horario/page.tsx`, con el interruptor de 24 horas, el de cobro de horas cerradas y las franjas por día
- [X] T077 [US2] Advertir en la pantalla de horario que el horario afecta al cobro, porque la jornada tarifaria se apoya en él, en `src/app/(establecimiento)/configuracion/horario/page.tsx`
- [X] T078 [US2] Construir la capacidad **dentro de la pantalla de horario** —son la misma pregunta del negocio, cuándo abre y cuánto cabe, y una sola historia— en `src/app/(establecimiento)/configuracion/horario/capacidad.tsx`
- [X] T079 [US4] Construir la pantalla de turnos con vista de calendario semanal en `src/app/(establecimiento)/configuracion/turnos/page.tsx`
- [X] T080 [US4] Mostrar el aviso de horas de atención sin turno que las cubra, sin impedir el guardado, en `src/app/(establecimiento)/configuracion/turnos/aviso-cobertura.tsx`
- [X] T081 [US3] Construir la pantalla de equipo en `src/app/(establecimiento)/equipo/page.tsx`, con alta y gestión
- [X] T082 [US5] Construir la pantalla de convenios en `src/app/(establecimiento)/configuracion/convenios/page.tsx`
- [X] T083 Construir la navegación de configuración del establecimiento, con recuadro en todos los enlaces y sin emojis, siguiendo `src/app/ui.ts`

---

## Phase 9: Cierre

- [X] T084 Implementar en cada operación de escritura de configuración —tarifas, horario, capacidad, turnos y convenios— la variante con ámbito explícito para el administrador general, que la especificación exige y el contrato promete, en `src/dominio/configuracion/como-plataforma.ts`
- [X] T085 [P] Probar en `tests/integracion/soporte-plataforma.test.ts` que el administrador general modifica la configuración de cualquier establecimiento y que el administrador de un local sigue sin alcanzar otro
- [X] T086 Registrar en auditoría toda modificación de configuración hecha por el administrador general sobre un establecimiento ajeno, distinguible de un cambio hecho por el propio establecimiento, en `src/dominio/auditoria/configuracion.ts`
- [X] T087 [P] Probar esa distinción en `tests/integracion/soporte-plataforma.test.ts`
- [X] T088 Verificar que ningún importe, intervalo ni horario quedó como literal en el código, con una prueba en `tests/aislamiento/cero-valores-quemados.test.ts` que rastree números sospechosos en `src/dominio`
- [X] T089 [P] Probar el criterio SC-010 en `tests/integracion/sin-movimientos.test.ts`: toda la configuración de F2 se define y verifica sin registrar un solo movimiento
- [X] T090 Recorrer [quickstart.md](quickstart.md) entero a mano y corregir lo que no coincida
- [X] T091 Ejecutar `npm run typecheck && npm run lint && npm test && npx next build` y dejarlo todo en verde

---

## Dependencias

```
Phase 1 (catálogo)
    ↓
Phase 2 (esquema y RLS)  ← bloquea todo
    ↓
Phase 3 US1 (tarifas)  ──┐
    ↓                    │  T020-T021 (jornadas) son prerequisito
Phase 4 US2 (horario)  ←─┘  de T024-T027 (calculador), y el horario
    ↓                       de T043-T046 los reutiliza
Phase 5 US4 (turnos)   ← T050 reutiliza la expansión de T020
    ↓
Phase 6 US3 (equipo)
    ↓
Phase 7 US5 (convenios)  ← independiente de las demás
    ↓
Phase 8 (pantallas)      ← cada una tras su dominio
    ↓
Phase 9 (cierre)
```

**Historias independientes**: US5 (convenios) no depende de ninguna otra y podría adelantarse si
hiciera falta. US2 depende de US1 sólo por reutilizar `expandirHorario()`; si se implementara antes,
habría que mover esa función.

## Paralelismo

Dentro de la Phase 2, las tablas marcadas `[P]` son archivos distintos y no se pisan: T005, T009,
T010, T011 y T012 pueden ir a la vez. Las políticas de T014 llegan después porque las necesitan a
todas.

En la Phase 3, las pruebas del calculador (T029 a T033) son todas sobre el mismo archivo pero
independientes entre sí; se marcan `[P]` porque no comparten estado, aunque conviene escribirlas
seguidas.

## Alcance mínimo

**El MVP de F2 es la Phase 3 completa más T072 a T075.** Con eso un establecimiento puede declarar
sus tarifas y comprobar que calculan bien, que es lo único que bloquea a F3. Todo lo demás —horario,
turnos, equipo, convenios— agrega valor pero no desbloquea la taquilla.
