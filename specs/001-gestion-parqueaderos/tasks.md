---
description: "Task list for 001-gestion-parqueaderos"
---

# Tasks: Parquivo

**Input**: Design documents from `/specs/001-gestion-parqueaderos/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Incluidas y **obligatorias**. No es una preferencia de estilo: la constitución exige
verificar los Principios I y IV con pruebas automatizadas, y el criterio de aceptación de la
feature nombra seis verificaciones del quickstart que deben quedar cubiertas.

**Organization**: Las tareas se agrupan por historia de usuario para que cada una pueda
implementarse, probarse y entregarse de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: A qué historia pertenece (US1–US5)
- Cada tarea incluye la ruta exacta del archivo

## Path Conventions

Aplicación web full-stack en un solo despliegue, según la decisión de estructura del plan:
`src/` y `tests/` en la raíz del repositorio.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Dejar el proyecto compilando, con pruebas ejecutables y variables validadas.

- [X] T001 Inicializar proyecto Next.js con TypeScript sobre Node 24 en la raíz, con `package.json`, `tsconfig.json` y `next.config.ts`
- [X] T002 [P] Configurar linter y formateador en `eslint.config.mjs` y `.prettierrc`
- [X] T003 [P] Configurar Vitest en `vitest.config.ts`, con proyectos separados para `tests/unit`, `tests/integracion` y `tests/aislamiento`
- [X] T004 [P] Definir y validar variables de entorno en `src/lib/env.ts`: las tres cadenas de conexión (`app_migrator`, `app_platform`, `app_tenant`) y el secreto de sesión, fallando al arrancar si falta alguna
- [X] T005 Crear el árbol de directorios de `src/` y `tests/` según la estructura del plan

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Construir la barrera de aislamiento y la base de autenticación. **Ninguna historia
puede empezar antes de que esta fase esté completa y verificada**: todas dependen de que el
ámbito se resuelva correctamente.

**⚠️ Esta fase es el Principio I. Si algo de acá queda a medias, todo lo que se construya encima
hereda una falla que no se detecta hasta que un cliente ve datos de otro.**

### Base de datos y aislamiento

- [X] T006 Configurar Drizzle en `drizzle.config.ts` apuntando a `src/db/esquema/` y `src/db/migraciones/`
- [X] T007 Crear los tres roles de PostgreSQL y sus permisos en la migración inicial `src/db/migraciones/0000_roles.sql`: `app_migrator` como dueño del esquema, `app_platform` con `BYPASSRLS`, `app_tenant` sin `BYPASSRLS` y sin ser dueño de ninguna tabla
- [X] T008 [P] Definir los enums `estado_parqueadero` (activo, pendiente, suspendido, dado_de_baja) y `rol_usuario` (admin_general, admin_parqueadero, operario) en `src/db/esquema/enums.ts`
- [X] T009 Definir la tabla `parqueadero` en `src/db/esquema/parqueadero.ts` con código único, estado y marcas de tiempo
- [X] T010 Añadir el disparador que rechaza cualquier `UPDATE` sobre `parqueadero.codigo` en `src/db/migraciones/0001_codigo_inmutable.sql` (FR-015)
- [X] T011 [P] Definir las tablas de Better Auth con los campos adicionales `debe_cambiar_password` y `anonimizada_en` en `src/db/esquema/usuario.ts`
- [X] T012 Definir la tabla `asignacion` en `src/db/esquema/asignacion.ts` con el índice único sobre `usuario_id` (FR-020) y el CHECK que liga rol global con ámbito nulo (FR-002, FR-013)
- [X] T013 [P] Definir las tablas `intento_login` y `acceso_denegado` en `src/db/esquema/auditoria.ts`
- [X] T014 Declarar las políticas RLS en `src/db/esquema/parqueadero.ts` y `src/db/esquema/asignacion.ts`, con `ENABLE` y `FORCE ROW LEVEL SECURITY`, usando `current_setting('app.parqueadero_id', true)`
- [X] T015 Generar las migraciones en `src/db/migraciones/` y aplicarlas con el rol `app_migrator` mediante el script `package.json#scripts.db:migrate`

### El contrato de acceso a datos

- [X] T016 Implementar los dos pools de conexión en `src/db/pools.ts`, uno por rol, sin exponerlos fuera del módulo
- [X] T017 Implementar `conAmbito()` en `src/db/ambito.ts`: abre transacción explícita, ejecuta `set_config('app.parqueadero_id', $1, true)` antes de cualquier consulta y usa el pool de `app_tenant`
- [X] T018 Implementar `comoPlataforma()` en `src/db/ambito.ts`: exige un `MotivoPrivilegiado` del conjunto cerrado (`autenticacion`, `administracion_plataforma`) y lo registra en cada uso (FR-013)
- [X] T019 Escribir en `tests/aislamiento/ambito.test.ts` la prueba de que `conAmbito` fija la variable **dentro** de la transacción y que fuera de ella no persiste — es la garantía de la que depende FR-012

### Autenticación base

- [X] T020 Configurar Better Auth con el plugin de administración y Argon2id en `src/lib/auth.ts`, con sesiones persistidas en base de datos
- [X] T021 Implementar la resolución de ámbito desde la sesión en `src/lib/sesion.ts`: lee la asignación del usuario autenticado y NUNCA acepta un identificador enviado por el cliente (FR-009)
- [X] T022 Implementar el control de autorización por rol en `src/lib/autorizacion.ts`, evaluado en el servidor y aplicado a **toda** operación antes de ejecutarla, de modo que ninguna pantalla decida por su cuenta quién puede qué (FR-003)
- [X] T023 Escribir en `tests/aislamiento/autorizacion.test.ts` la prueba negativa de autorización: un operario no puede ejecutar ninguna operación reservada a administrador, ni siquiera invocándola directamente sin pasar por la interfaz (FR-003)
- [X] T024 Escribir el script de semilla en `src/db/semilla.ts` que crea la única cuenta de administrador general inicial

**Checkpoint**: la base rechaza filas fuera de ámbito y existe un camino de autenticación. Recién acá pueden empezar las historias.

---

## Phase 3: User Story 1 — Dar de alta un parqueadero y su administrador (Priority: P1) 🎯 MVP

**Goal**: El administrador general registra un establecimiento, le asigna una persona
responsable, y esa persona entra a administrarlo.

**Independent Test**: Crear un parqueadero desde el panel general, asignarle un administrador e
iniciar sesión con esa cuenta para confirmar que accede a su establecimiento y a ningún otro.

- [X] T025 [P] [US1] Escribir en `tests/integracion/alta-parqueadero.test.ts` los cuatro escenarios de aceptación de la historia 1
- [X] T026 [US1] Implementar la generación del código interno único e inmutable en `src/dominio/parqueaderos/codigo.ts` (FR-015)
- [X] T027 [US1] Implementar `crearParqueadero()` en `src/dominio/parqueaderos/crear.ts` (FR-014, FR-016)
- [X] T028 [US1] Implementar `editarParqueadero()` en `src/dominio/parqueaderos/editar.ts`, rechazando toda alteración del código (FR-017)
- [X] T029 [US1] Implementar `asignarAdministrador()` y `retirarAdministrador()` en `src/dominio/parqueaderos/asignaciones.ts`, con el rechazo de cuentas ya vinculadas a otro establecimiento (FR-018, FR-020)
- [X] T030 [US1] Implementar `listarParqueaderos()` en `src/dominio/parqueaderos/listar.ts`, registrando el ejercicio del privilegio global
- [X] T031 [P] [US1] Construir la pantalla de inicio de sesión en `src/app/(auth)/login/page.tsx`
- [X] T032 [US1] Construir el listado y el alta de establecimientos en `src/app/(plataforma)/parqueaderos/page.tsx` y `nuevo/page.tsx`
- [X] T033 [US1] Construir la vista del establecimiento propio en `src/app/(establecimiento)/establecimiento/page.tsx`, sin recibir identificador por parámetro (FR-022)
- [X] T034 [US1] Encaminar cada rol a su panel tras el inicio de sesión en `src/app/(auth)/login/acciones.ts`

**Checkpoint**: se puede incorporar un cliente de punta a punta. Esto ya es un MVP entregable.

---

## Phase 4: User Story 2 — Acceso aislado por establecimiento (Priority: P1)

**Goal**: Ningún camino permite a un usuario alcanzar datos de otro establecimiento.

**Independent Test**: Con dos parqueaderos poblados, intentar deliberadamente desde la sesión del
primero alcanzar los recursos del segundo por identificador directo. Toda tentativa falla.

**⚠️ Estas pruebas se escriben ANTES que su implementación. Son la verificación del principio no
negociable, y una prueba escrita después de ver el código tiende a confirmar lo que el código
hace en vez de lo que el requisito exige.**

- [X] T035 [P] [US2] Escribir V1 en `tests/aislamiento/v1-base-rechaza.test.ts`: SQL crudo sin filtro dentro del ámbito de A devuelve sólo filas de A
- [X] T036 [P] [US2] Escribir V2 en `tests/aislamiento/v2-sin-ambito.test.ts`: consulta sin ámbito fijado devuelve cero filas, nunca el conjunto completo (FR-010)
- [X] T037 [P] [US2] Escribir V3 en `tests/aislamiento/v3-parametros.test.ts`: inyectar el identificador de B por cuerpo, ruta y cabeceras no altera el ámbito (FR-009)
- [X] T038 [P] [US2] Escribir V4 en `tests/aislamiento/v4-indistinguible.test.ts`: recurso ajeno y recurso inexistente responden idéntico en código y mensaje (FR-011)
- [X] T039 [US2] Implementar el registro de accesos denegados en `src/dominio/auditoria/acceso-denegado.ts` con cuenta, recurso, ámbito y momento (FR-005)
- [X] T040 [US2] Implementar el contrato uniforme de error de ámbito en `src/lib/errores.ts`, de modo que ajeno e inexistente sean indistinguibles (FR-011)
- [X] T041 [US2] Denegar el acceso a toda cuenta sin asignación en `src/lib/sesion.ts` (escenario 3 de la historia 2)
- [X] T042 [US2] Registrar como auditable cada ejercicio del privilegio global en `src/db/ambito.ts` (escenario 4 de la historia 2)
- [X] T043 [US2] Escribir V5 en `tests/aislamiento/v5-privilegio-acotado.test.ts`: verificación automatizada de que `comoPlataforma` sólo aparece en el módulo de autenticación y en las operaciones de plataforma
- [X] T044 [US2] Añadir en `src/db/blindaje.sql` la comprobación de que ninguna tabla con columna de tenencia carece de política RLS, para que una tabla futura sin política falle al migrar

**Checkpoint**: el Principio I queda verificado por pruebas, no por revisión visual.

---

## Phase 5: User Story 3 — Suspender y reactivar un establecimiento (Priority: P2)

**Goal**: El administrador general corta y restituye el servicio, sin destruir información y sin
dejar vehículos atrapados.

**Independent Test**: Suspender un establecimiento con sesiones abiertas, comprobar que quedan en
modo restringido, reactivarlo y confirmar que la información quedó idéntica.

- [X] T045 [P] [US3] Escribir en `tests/integracion/estados.test.ts` los siete escenarios de aceptación de la historia 3
- [X] T046 [P] [US3] Escribir V10 en `tests/unit/transiciones.test.ts`: toda transición no contemplada es rechazada (FR-023)
- [X] T047 [US3] Implementar la máquina de transiciones en `src/dominio/parqueaderos/estados.ts`, con los cuatro estados excluyentes (FR-023, FR-024)
- [X] T048 [US3] Implementar `cambiarEstadoParqueadero()` en `src/dominio/parqueaderos/cambiar-estado.ts` (FR-025)
- [X] T049 [US3] Registrar autor, momento y motivo de cada cambio de estado en `src/dominio/parqueaderos/historial-estado.ts`, conservándolo ante cambios posteriores (FR-026)
- [X] T050 [US3] Implementar el punto de control del modo restringido en `src/lib/autorizacion.ts`: permite cerrar movimientos abiertos, impide crearlos y bloquea configuración y reportes (FR-027, FR-028)
- [X] T051 [US3] Implementar la revocación de sesiones al cambiar de estado en `src/dominio/autenticacion/revocar.ts`, de modo que alcance a sesiones abiertas en menos de un minuto (FR-004, SC-004)
- [X] T052 [US3] Implementar el mensaje al usuario restringido en `src/app/(establecimiento)/restringido/page.tsx`, explicando motivo y qué puede seguir haciendo (FR-030)
- [X] T053 [US3] Construir los controles de estado en `src/app/(plataforma)/parqueaderos/[id]/estado/page.tsx`
- [X] T054 [US3] Implementar la baja lógica al estado terminal y su reactivación explícita en `src/dominio/parqueaderos/baja.ts` (FR-040, FR-041)
- [X] T055 [US3] Implementar la restitución del acceso pleno al reactivar en `src/dominio/parqueaderos/reactivar.ts`: levanta el modo restringido y devuelve a los usuarios su acceso completo sin pérdida de información (FR-029)
- [X] T056 [P] [US3] Escribir en `tests/integracion/integridad-establecimiento.test.ts` la verificación del Principio IV: dar de baja un establecimiento no destruye ninguna fila ni referencia suya, y su información sigue siendo consultable por el administrador general (FR-040, FR-042)

**Checkpoint**: existe la palanca comercial completa, que es la única que la plataforma necesita dado que el cobro ocurre fuera del sistema.

---

## Phase 6: User Story 4 — Gestionar el acceso y el ciclo de vida de las cuentas (Priority: P2)

**Goal**: El administrador general crea, restablece, bloquea, da de baja y anonimiza cuentas; el
sistema defiende esas cuentas de la adivinación de contraseñas.

**Independent Test**: Crear una cuenta, entrar con la temporal, comprobar el cambio obligatorio,
bloquearla, verificar que no entra, desbloquearla y anonimizarla.

- [X] T057 [P] [US4] Escribir en `tests/integracion/cuentas.test.ts` los nueve escenarios de aceptación de la historia 4
- [X] T058 [P] [US4] Escribir V7 en `tests/integracion/demora.test.ts`: seis fallos consecutivos producen espera creciente con tope, y tras esperar se entra sin intervención (FR-007, SC-009)
- [X] T059 [P] [US4] Escribir V8 en `tests/integracion/anonimizacion.test.ts`: los datos personales dejan de ser recuperables, la cuenta no autentica y las referencias históricas sobreviven (FR-044 a FR-046)
- [X] T060 [P] [US4] Escribir V6 en `tests/integracion/primer-ingreso.test.ts`: con `debe_cambiar_password`, ninguna otra operación es accesible (FR-033)
- [X] T061 [P] [US4] Escribir en `tests/integracion/sin-recuperacion.test.ts` la prueba que falla si aparece cualquier ruta de recuperación de contraseña autogestionada, para que la decisión de no tenerla no se revierta por descuido (FR-035)
- [X] T062 [P] [US4] Escribir en `tests/integracion/cuentas.test.ts` el escenario que prueba que el bloqueo de cuenta y la suspensión del establecimiento son independientes: levantar uno no levanta el otro (FR-039)
- [X] T063 [P] [US4] Escribir en `tests/integracion/integridad-cuenta.test.ts` la verificación del Principio IV: dar de baja o anonimizar una cuenta no elimina su fila ni rompe ninguna referencia histórica (FR-042, FR-045)
- [X] T064 [US4] Implementar el cálculo de la demora en `src/dominio/autenticacion/demora.ts`: 3 intentos sin penalización, duplicación desde el cuarto, tope de 30 segundos, conteo por correo intentado (FR-006)
- [X] T065 [US4] Colocar los parámetros de la demora en un único módulo con nombre en `src/dominio/autenticacion/parametros.ts`, nunca como literales dispersos — lo exige la vigilancia del Principio II anotada en el plan
- [X] T066 [US4] Registrar todo intento de inicio de sesión, exitoso o fallido, en `src/dominio/autenticacion/registro-intentos.ts` (FR-008)
- [X] T067 [US4] Implementar `iniciarSesion()` en `src/dominio/autenticacion/iniciar-sesion.ts` con los seis resultados del contrato y mensaje idéntico ante credenciales inválidas
- [X] T068 [US4] Implementar el cambio obligatorio de contraseña en `src/dominio/autenticacion/cambio-obligatorio.ts` y su pantalla en `src/app/(auth)/cambiar-password/page.tsx` (FR-033)
- [X] T069 [US4] Implementar `crearCuenta()` en `src/dominio/cuentas/crear.ts` con contraseña temporal y asignación (FR-028, FR-032)
- [X] T070 [US4] Implementar `restablecerPassword()` en `src/dominio/cuentas/restablecer.ts` (FR-034)
- [X] T071 [US4] Implementar bloqueo y desbloqueo en `src/dominio/cuentas/bloqueo.ts`, con revocación inmediata de sesiones (FR-036, FR-004)
- [X] T072 [US4] Implementar la protección del último administrador en `src/dominio/cuentas/ultimo-administrador.ts`, devolviendo `REQUIERE_CONFIRMACION` (FR-037)
- [X] T073 [US4] Implementar la baja lógica de cuentas en `src/dominio/cuentas/dar-de-baja.ts`, sin borrado físico ante referencias históricas (FR-038, FR-042)
- [X] T074 [US4] Declarar el conjunto cerrado de campos personales en `src/dominio/cuentas/datos-personales.ts` (FR-043)
- [X] T075 [US4] Implementar `anonimizarCuenta()` en `src/dominio/cuentas/anonimizar.ts`: sustituye campos personales, elimina credenciales, revoca sesiones y preserva la fila con su identificador (FR-044 a FR-046)
- [X] T076 [US4] Construir la gestión de cuentas en `src/app/(plataforma)/cuentas/page.tsx`, con confirmación explícita para las acciones irreversibles

**Checkpoint**: el ciclo de vida completo de una cuenta funciona y está defendido.

---

## Phase 7: User Story 5 — Panel global del estado de la plataforma (Priority: P3)

**Goal**: El administrador general ve de un vistazo el estado de la plataforma.

**Independent Test**: Con establecimientos en los cuatro estados y cuentas anonimizadas, los
contadores coinciden con la realidad y la suma cuadra contra el total.

- [X] T077 [P] [US5] Escribir en `tests/integracion/panel.test.ts` los tres escenarios de aceptación de la historia 5, incluida la exclusión de cuentas anonimizadas
- [X] T078 [US5] Implementar `obtenerResumenPlataforma()` en `src/dominio/plataforma/resumen.ts`, con un contador por cada uno de los cuatro estados y la suma cuadrando contra el total (FR-049)
- [X] T079 [US5] Excluir las cuentas anonimizadas del total e informarlas por separado en `src/dominio/plataforma/resumen.ts` (FR-050)
- [X] T080 [US5] Construir el panel en `src/app/(plataforma)/panel/page.tsx`
- [X] T081 [P] [US5] Escribir V11 en `tests/integracion/rendimiento-panel.test.ts`: con 1.000 establecimientos, listado y panel en menos de 2 segundos (SC-007)

**Checkpoint**: las cinco historias están completas.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T082 [P] Implementar la purga automática a los 12 meses de `intento_login` y `acceso_denegado` en `src/dominio/auditoria/retencion.ts` (FR-047)
- [X] T083 [P] Documentar en `README.md` la puesta en marcha, las tres cadenas de conexión y la ejecución de la semilla
- [X] T084 [P] Añadir índices sobre `asignacion.parqueadero_id`, `parqueadero.estado` e `intento_login.email_intentado` en `src/db/migraciones/`
- [X] T085 Añadir a la integración continua la ejecución de `tests/aislamiento/` como puerta bloqueante: si falla, no se despliega
- [X] T086 [P] Revisar todo `src/` en busca de parámetros de negocio escritos como literales y moverlos a módulos con nombre, según el Principio II
- [X] T087 [P] Unificar el manejo de errores de la interfaz en `src/app/error.tsx`, sin filtrar detalles internos
- [X] T088 Recorrer las once verificaciones de `specs/001-gestion-parqueaderos/quickstart.md` contra el sistema desplegado y anotar los resultados en ese mismo archivo
- [X] T089 Configurar el despliegue en la plataforma gestionada elegida y documentarlo en `docs/despliegue.md`, con las tres conexiones y las migraciones en el arranque

---

## Dependencies

```text
Phase 1 (Setup)
      ↓
Phase 2 (Foundational)  ←── bloquea absolutamente todo
      ↓
      ├──────────────┬──────────────┬──────────────┐
      ↓              ↓              ↓              ↓
Phase 3 (US1)   Phase 5 (US3)  Phase 6 (US4)  Phase 7 (US5)
      ↓
Phase 4 (US2)  ←── necesita US1 para tener dos establecimientos que aislar
      ↓
Phase 8 (Polish)
```

**Dependencias entre historias**:

- **US1** sólo depende de la fase fundacional.
- **US2** depende de US1: para probar que A no ve a B hay que poder crear A y B.
- **US3**, **US4** y **US5** dependen de la fase fundacional y de US1 (necesitan un
  establecimiento y una cuenta con los que operar), pero son independientes entre sí.
- **US5** muestra contadores más ricos si US3 ya existe, pero no la necesita para funcionar.

## Parallel Execution Examples

**Fase fundacional**: T008, T011 y T013 definen esquemas de archivos distintos y pueden ir en
paralelo. T009, T012 y T014 no: dependen de los enums y entre sí.

**US2**: T035 a T038 son cuatro archivos de prueba independientes y pueden escribirse en
paralelo, antes de cualquier implementación de esa fase.

**US4**: T057 a T063 son siete archivos de prueba distintos y van todos en paralelo. T064 a T075
tocan módulos separados pero comparten el flujo de inicio de sesión, así que conviene serializar
T064 → T066 → T067.

**US3**: T045, T046 y T056 son archivos de prueba independientes y pueden escribirse en paralelo.

**Polish**: T082, T083, T084, T086 y T087 son todas independientes.

## Implementation Strategy

**MVP = Fase 1 + Fase 2 + Fase 3 (US1).** Con eso ya se puede incorporar un cliente real: crear
su parqueadero, darle su administrador y que entre a trabajar. Es la primera unidad entregable.

**Segundo incremento: Fase 4 (US2).** Aunque US1 ya funciona, no se despliega a más de un cliente
hasta que las pruebas de aislamiento pasen. Con un solo establecimiento el riesgo es nulo; con
dos, el Principio I deja de ser teórico.

**Tercer incremento: Fases 5 y 6**, en el orden que convenga comercialmente. Si aparece un
cliente que no paga, US3 primero. Si aparecen varios operarios, US4 primero.

**Cuarto: Fase 7 y Fase 8.**

## Nota sobre la puerta de checklists

`/speckit-implement` lee el estado de los checkboxes de `checklists/` como puerta y va a
preguntar antes de proceder si quedan ítems sin marcar. Hoy hay 59 de 70 sin marcar, lo cual es
esperado: son revisión del usuario, no trabajo pendiente de implementación.

---

## Phase 9: Convergence

Hallazgos de `/speckit-converge` tras completar las 89 tareas: código presente y probado que
ningún camino de la aplicación alcanza, más una obligación del contrato que no se cumple. Las
tareas de las fases anteriores están bien marcadas —pedían la capa de dominio y esa se
entregó—; lo que falta es el cableado que convierte esas funciones en requisitos satisfechos.

- [X] T090 CRITICAL Registrar cada denegación de ámbito llamando a `registrarAccesoDenegado()` desde el punto único de denegación (`exigirAlcanzable()` en `src/lib/errores.ts`, cuyo comentario ya afirma que el registro ocurre ahí), y cubrirlo con una prueba que verifique el asiento en `acceso_denegado` per FR-005 (missing)
- [X] T091 Exponer la edición de cualquier establecimiento para el administrador general, conectando `editarParqueadero()` a una ruta y acción de servidor per FR-018 (partial)
- [X] T092 Exponer la edición del establecimiento propio para su administrador, conectando `editarMiParqueadero()` a la pantalla de `/establecimiento` per FR-022 (partial)
- [X] T093 Exponer la asignación y el retiro de personas administradoras sobre cuentas ya existentes, conectando `asignarAdministrador()` y `retirarAdministrador()` per FR-019 (partial)
- [X] T094 Disparar automáticamente `purgarAuditoriaVencida()` a los 12 meses, decidiendo y documentando el mecanismo (tarea programada o verificación diferida en el arranque) per FR-047 (partial)
- [X] T095 [P] Revisar `reactivarParqueadero()`: la interfaz reactiva mediante `cambiarEstadoParqueadero()`, así que hay dos caminos para la misma transición; unificar o retirar el que sobre per plan: transiciones de estado (unrequested)
- [X] T096 [P] Revisar las funciones exportadas sin consumidor —`contarEstablecimientos()`, `ultimosAccesosDenegados()`, `esCodigoValido()`, `segundosDeEspera()`—: justificar su permanencia o retirarlas (unrequested)

**Resultado de la Fase 9.** Las siete quedaron cerradas. Dos merecen nota:

- T095: `reactivarParqueadero()` NO duplicaba lógica —delega en
  `cambiarEstadoParqueadero()`—, así que se conserva con su justificación escrita: nombra una
  operación que la especificación nombra (FR-029) y es por donde entran sus pruebas.
- T096: se retiraron `contarEstablecimientos()`, `segundosDeEspera()` y `esCodigoValido()`, sin
  consumidor y sustituidas por otras. `ultimosAccesosDenegados()` se conservó y se conectó al
  panel: con T090 la tabla por fin recibe filas, y un registro que nadie puede leer no avisa de
  nada.
