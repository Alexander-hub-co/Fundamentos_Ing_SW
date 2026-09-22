# Tareas — Taquilla de bicicletas y fichas

**Feature**: `005-bicicletas-fichas` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

`[P]` marca lo que puede ir en paralelo con lo que tiene al lado.

---

## Fase 1 — Setup

- [X] T001 Verificar que `blindaje.sql` recorre las tablas y no las enumera, para que `ficha` quede con RLS forzada sin tocar ese archivo

## Fase 2 — Fundacional (bloquea todas las historias)

- [X] T002 Crear `src/db/esquema/ficha.ts`: tabla `ficha` con `parqueadero_id`, `numero`, `estado`, `nota`, su política RLS, el único `(parqueadero_id, numero)` y el `check(numero >= 1)`
- [X] T003 Añadir a `src/db/esquema/enums.ts` el enumerado `estado_ficha` con `activa`, `perdida`, `dada_de_baja`. **Sin `entregada`**: es derivable, y el porqué está en research.md D1
- [X] T004 Añadir a `src/db/esquema/movimiento.ts` las columnas `ficha_id`, `cedula`, `telefono`, `nota_vehiculo`, `ficha_perdida`, y **volver `placa` nula**
- [X] T005 Añadir a `movimiento` el índice único parcial `(parqueadero_id, ficha_id) where salida_en is null`. **Es la garantía de D1**, y sin él todo lo demás es teatro
- [X] T006 Añadir a `movimiento` el `check` de identificador excluyente —o placa o ficha, nunca los dos ni ninguno— y el índice `(parqueadero_id, cedula) where salida_en is null`
- [X] T007 Añadir `reposicion_ficha` a `politica_cobro`, entero, cero por defecto
- [X] T008 Escribir a mano `src/db/migraciones/0013_fichas.sql` con todo lo anterior y actualizar `meta/_journal.json`. A mano porque drizzle-kit exige un terminal interactivo que no hay
- [X] T009 Correr `npm run db:migrate` y `npm run db:migrate:test`, y comprobar que los movimientos existentes siguen íntegros
- [X] T010 [P] `tests/aislamiento/fichas-ambito.test.ts`: la ficha 7 de A no es visible ni alcanzable desde B

**Punto de control**: el esquema soporta fichas y ninguna prueba existente se rompió.

---

## Fase 3 — Historia 3: declarar el conjunto (P2, va primero porque las otras la necesitan)

- [X] T011 Crear `src/dominio/fichas/declarar.ts` con `declararFichas`, que amplía el conjunto sin tocar las existentes
- [X] T012 Añadir `darDeBajaFicha`, que **falla si la ficha tiene un movimiento abierto**: la bicicleta todavía tiene que poder salir
- [X] T013 Añadir `reactivarFicha`, que sirve tanto para una perdida que aparece como para una baja por error
- [X] T014 Añadir `fichasDelEstablecimiento`, con el estado de cada una y cuál está entregada, calculado y no almacenado
- [X] T015 [P] `tests/integracion/fichas.test.ts`: declarar, ampliar, dar de baja, reactivar, y que dar de baja una entregada falle
- [X] T016 Crear `src/app/(establecimiento)/configuracion/fichas/` con su pantalla y sus acciones
- [X] T017 Añadir "Fichas" a la barra lateral del establecimiento y a la línea de configuración de `8a`

**Punto de control**: un administrador declara sus 40 fichas y las ve.

---

## Fase 4 — Historia 1: recibir una bicicleta (P1, MVP)

- [X] T018 Crear `src/dominio/fichas/asignar.ts` con `tomarFichaDisponible`, usando `FOR UPDATE SKIP LOCKED` para que dos taquillas no choquen
- [X] T019 Añadir `fichasDisponibles` para el contador de la taquilla
- [X] T020 Añadir `recibirBicicleta` a `src/dominio/taquilla/registrar.ts`: exige `taquilla.entrada`, toma ficha, valida cédula y teléfono, crea el movimiento
- [X] T021 Traducir el choque contra el índice único a "esa ficha ya está entregada", igual que se hizo con la placa
- [X] T022 Rechazar con mensaje claro cuando no queden fichas disponibles, no con un error técnico
- [X] T023 Añadir `telefonoConocidoDe(cedula)`, que mira los movimientos previos del establecimiento
- [X] T024 [P] `tests/integracion/fichas-recepcion.test.ts`: recepción completa, sin tarifa declarada, sin fichas disponibles, y teléfono propuesto
- [X] T025 [P] `tests/integracion/fichas-concurrencia.test.ts`: **dos recepciones simultáneas reciben fichas distintas**. Es la prueba que justifica D1
- [X] T026 Extender `comprobanteDe` y `comprobante-html.ts` para que el papel muestre el número de ficha donde muestra la placa
- [X] T027 Crear el formulario de recepción en la taquilla, con la frase que dice para qué se piden los datos
- [X] T028 Mostrar en la taquilla cuántas fichas quedan disponibles

**Punto de control**: se recibe una bicicleta y sale su ticket.

---

## Fase 5 — Historia 2: devolver y cobrar (P1)

- [X] T029 Extender `resolverPlaca` para que un texto de sólo dígitos se resuelva como ficha. Renombrar a `resolverEntrada` si el nombre queda mintiendo
- [X] T030 Devolver la resolución de una ficha entregada con su permanencia y su cobro, por el mismo motor de tarifas
- [X] T031 Responder claramente cuando la ficha no está entregada o no existe, sin registrar nada
- [X] T032 Añadir `devolverBicicleta` a `registrar.ts`: cierra el movimiento, cobra y libera la ficha
- [X] T033 Comprobar que la cortesía y la corrección funcionan igual sobre un movimiento de bicicleta
- [X] T034 [P] `tests/integracion/fichas-devolucion.test.ts`: cobro correcto, ficha liberada, segunda devolución rechazada, cortesía y corrección
- [X] T035 Ajustar la vista de "adentro" para que muestre las bicicletas por su ficha

**Punto de control**: el ciclo completo de una bicicleta funciona.

---

## Fase 6 — Historia 4: el tarjetón perdido (P2)

- [X] T036 Añadir `buscarPorCedula` a `src/dominio/taquilla/resolver.ts`, que lista los movimientos abiertos de esa cédula
- [X] T037 Añadir `cerrarSinFicha` a `registrar.ts`: cobra la permanencia más `reposicion_ficha`, marca `ficha_perdida` y deja la ficha en `perdida`
- [X] T038 Registrar quién declaró la pérdida y cuándo
- [X] T039 [P] `tests/integracion/fichas-perdida.test.ts`: búsqueda por cédula, cierre sin ficha, la ficha no vuelve al conjunto, y aparece después
- [X] T040 Añadir la búsqueda por cédula a la taquilla
- [X] ~~T041 Añadir `reposicion_ficha`~~ — **eliminada**: no hay tarjetón que reponer

**Punto de control**: un cliente sin tarjetón se lleva su bicicleta.

---

## Fase 7 — Datos personales

- [X] T042 Extender la purga de retención para que vacíe `cedula`, `telefono` y `nota_vehiculo` de los movimientos cerrados, **conservando el movimiento y su cobro**
- [X] T043 [P] `tests/integracion/fichas-retencion.test.ts`: pasado el plazo no queda ningún dato personal y el cobro sigue entero
- [X] T044 Comprobar que la cédula no sale en ningún listado que no la necesite

---

## Fase 8 — Cierre

- [X] T045 Historia 5: el contador de fichas disponibles visible antes de intentar recibir
- [X] T046 Suite completa y `next build` limpios
- [X] T047 Actualizar `docs/roadmap.md`: F4 entregada
- [ ] T048 Revisar la tensión con el Principio III con el producto delante: ¿cuánto frena la fila pedir cédula?

---

## Dependencias

- **Fundacional (T002–T010)** bloquea todo
- **Historia 3 (T011–T017)** va antes que la 1: sin fichas declaradas no hay nada que entregar
- **Historia 1 (T018–T028)** es el MVP
- **Historia 2 (T029–T035)** depende de la 1
- **Historia 4 (T036–T041)** depende de la 1 y de la 2
- **Datos personales (T042–T044)** depende de que existan las columnas; puede ir en paralelo con la historia 4

## El riesgo de esta funcionalidad

**Volver `placa` nula.** Es el cambio más invasivo: todo lo que hoy lee `placa` dando por
hecho que existe tiene que revisarse. Se hace en la fase fundacional a propósito, para que
lo que se rompa se rompa temprano y con la suite completa como red, en vez de aparecer a
mitad de la historia 2.
