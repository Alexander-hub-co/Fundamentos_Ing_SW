# Feature Specification: Taquilla de bicicletas y fichas

**Feature Branch**: `005-bicicletas-fichas`

**Created**: 2026-08-22

**Status**: Draft

**Input**: F4 del roadmap — el operario recibe bicicletas, que no tienen placa. El identificador es una ficha física reutilizable que se entrega al dejar la bicicleta y se devuelve al recogerla. El establecimiento tiene un conjunto finito de fichas numeradas.

> **Corrección posterior a la implementación.** La primera versión de esta
> especificación modeló la ficha como un TARJETÓN FÍSICO reutilizable, con
> inventario, estados de vida y un cobro de reposición. Está mal, y se corrigió
> con el producto delante: **una ficha es el ticket**, el mismo papel que sale
> para un carro con un número en vez de una placa; no hay nada que el cliente
> devuelva, y **cuántas hay es la capacidad de bicicletas ya declarada** —un
> espacio es una ficha—. El documento se conserva porque el análisis del flujo
> sigue valiendo; lo que cambió está anotado abajo, en "Decisiones cerradas".

## Contexto: qué cambia respecto de los vehículos con placa

Esta funcionalidad **no repite** el ciclo del vehículo, lo extiende. Ya existen y se
reutilizan sin cambios: el motor de tarifas —que sabe cobrar bicicletas con el modelo por
intervalo y plena por jornada—, el movimiento y su inmutabilidad, las sesiones de turno, la
cortesía, las correcciones y el comprobante impreso.

Lo que **no** existe y es la razón de ser de esta funcionalidad son dos cosas, y conviene
separarlas porque tienen consecuencias distintas:

1. **No hay identificador natural.** Una placa la trae el vehículo y es única en el país.
   Una ficha la presta el establecimiento, es única sólo dentro de él, y se reutiliza
   muchas veces al día.
2. **El identificador es un recurso finito con ciclo de vida propio.** Una placa no se
   "acaba"; las fichas sí. Una ficha entregada no puede volver a entregarse hasta que
   vuelva, y esa restricción no tiene ningún equivalente en el flujo de vehículos.

De la segunda sale casi todo lo difícil de esta funcionalidad: la ficha perdida, la ficha
que se agota, y la ficha que quedó marcada como entregada porque alguien se fue sin
devolverla.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recibir una bicicleta y entregar su ficha (Priority: P1)

Llega un cliente con una bicicleta. El operario le pide la cédula y el teléfono y los
escribe, el sistema propone la ficha disponible que sigue, el operario le entrega ese
tarjetón físico al cliente y confirma. Sale el comprobante con el número de ficha impreso.

La cédula no es burocracia: **es lo que permite devolverle la bicicleta a alguien que perdió
el tarjetón**, que es el caso que ocurre de verdad. Sin ella, un tarjetón perdido deja la
bicicleta sin forma de vincularla a nadie.

**Why this priority**: Es el MVP. Sin poder recibir una bicicleta no hay nada más que
probar, y con sólo esto un parqueadero ya puede empezar a recibirlas aunque el cobro se
haga a mano el primer día.

**Independent Test**: Se prueba entero declarando un conjunto de fichas, recibiendo una
bicicleta y comprobando que la ficha entregada deja de estar disponible.

**Acceptance Scenarios**:

1. **Given** un establecimiento con fichas 1 a 40 declaradas y ninguna entregada, **When** el operario recibe una bicicleta, **Then** el sistema propone la ficha 1, queda un movimiento abierto asociado a esa ficha y la ficha pasa a entregada
2. **Given** las fichas 1 y 2 entregadas, **When** el operario recibe otra bicicleta, **Then** el sistema propone la ficha 3
3. **Given** una bicicleta recibida con la ficha 7, **When** se emite su comprobante, **Then** el papel muestra el número 7 de forma destacada, igual que una placa
4. **Given** un establecimiento sin tarifa de bicicleta declarada, **When** el operario recibe una bicicleta, **Then** el sistema lo recibe igual y avisa que no se le va a poder cobrar al salir
5. **Given** un cliente que no quiere dar su cédula, **When** el operario intenta recibir la bicicleta, **Then** el sistema exige el dato, porque sin él la bicicleta no se puede devolver si se pierde el tarjetón
6. **Given** una cédula que ya dejó una bicicleta antes, **When** el operario la escribe, **Then** el sistema propone el teléfono que ya tenía, para no volver a preguntarlo

---

### User Story 2 - Devolver la bicicleta y cobrar (Priority: P1)

El cliente vuelve con el tarjetón. El operario escribe el número de ficha, el sistema
muestra desde cuándo está la bicicleta y cuánto se le cobra, se cobra, y la ficha vuelve al
conjunto disponible.

**Why this priority**: También P1: una bicicleta que entra y no puede salir es peor que no
haber podido recibirla. Las dos primeras historias son una sola operación partida en dos
mitades, y ninguna sirve sin la otra.

**Independent Test**: Se prueba recibiendo una bicicleta, devolviéndola, y comprobando que
el importe cobrado corresponde a la tarifa de bicicleta y que la ficha vuelve a proponerse.

**Acceptance Scenarios**:

1. **Given** la ficha 7 entregada hace tres horas, **When** el operario escribe 7, **Then** el sistema muestra la permanencia y el importe según la tarifa de bicicleta vigente
2. **Given** ese cobro mostrado, **When** el operario lo confirma, **Then** el movimiento queda cerrado con su copia embebida de la tarifa y la ficha 7 vuelve a estar disponible
3. **Given** la ficha 7 ya devuelta, **When** el operario vuelve a escribir 7, **Then** el sistema responde que esa ficha no está entregada, en vez de cobrar dos veces
4. **Given** un número que no corresponde a ninguna ficha declarada, **When** el operario lo escribe, **Then** el sistema lo dice claramente y no registra nada

---

### User Story 3 - Declarar el conjunto de fichas (Priority: P2)

El administrador declara cuántas fichas físicas tiene el establecimiento, y las da de baja
cuando se rompen o se pierden.

**Why this priority**: P2 y no P1 porque un conjunto por defecto permite empezar a operar el
primer día; pero sin esta pantalla el conjunto queda congelado y las fichas rotas se
acumulan como disponibles que no existen, lo que termina en un cliente esperando por un
tarjetón que nadie encuentra.

**Independent Test**: Se prueba declarando un conjunto, dando de baja una ficha, y
comprobando que deja de proponerse.

**Acceptance Scenarios**:

1. **Given** un establecimiento sin fichas declaradas, **When** el administrador declara 40, **Then** quedan disponibles las fichas 1 a 40
2. **Given** la ficha 12 rota, **When** el administrador la da de baja, **Then** deja de proponerse y el total disponible baja en una
3. **Given** la ficha 12 dada de baja y entregada al cliente en ese momento, **When** el administrador intenta darla de baja, **Then** el sistema lo impide mientras esté entregada, porque la bicicleta todavía tiene que poder salir
4. **Given** un conjunto de 40 fichas, **When** el administrador lo amplía a 60, **Then** las fichas 41 a 60 quedan disponibles y las anteriores no se alteran

---

### User Story 4 - El cliente perdió la ficha (Priority: P2)

El cliente vuelve sin el tarjetón. El operario busca por la cédula que se registró al
recibir la bicicleta, encuentra qué ficha tiene esa persona, le entrega la bicicleta y
cierra el movimiento dejando registrado que el tarjetón no volvió.

**Why this priority**: P2 porque ocurre de verdad y con frecuencia. Es además la razón por
la que se pide la cédula al recibir: sin ella la única salida sería dejar el movimiento
abierto para siempre —lo que además inmoviliza esa ficha— o inventar una salida falsa, y
las dos ensucian el historial de una forma que después nadie desenreda.

**Independent Test**: Se prueba recibiendo una bicicleta con una cédula, buscando por esa
cédula sin el número de ficha, y cerrando el movimiento sin devolución.

**Acceptance Scenarios**:

1. **Given** la ficha 7 entregada a la cédula 1020304050, **When** el operario busca por esa cédula, **Then** el sistema muestra que esa persona tiene la ficha 7 adentro, desde cuándo y cuánto se le cobra
2. **Given** esa búsqueda, **When** el operario cierra el movimiento declarando que el tarjetón se perdió, **Then** el movimiento se cierra con su cobro y la ficha 7 queda como perdida, no disponible
3. **Given** ese cierre, **Then** queda registrado quién lo hizo y cuándo, igual que una cortesía
4. **Given** la ficha 7 perdida, **When** el cliente la aparece y la devuelve al día siguiente, **Then** el administrador puede devolverla al conjunto disponible
5. **Given** una ficha perdida, **When** el operario recibe una bicicleta nueva, **Then** esa ficha no se propone
6. **Given** una cédula con dos bicicletas adentro, **When** el operario busca por ella, **Then** el sistema muestra las dos y el operario elige cuál sale

---

### User Story 5 - Se acabaron las fichas (Priority: P3)

Todas las fichas están entregadas y llega otro cliente.

**Why this priority**: P3 porque sólo ocurre en el pico y porque la respuesta correcta es
sencilla; pero sin ella el sistema fallaría con un error técnico en el peor momento posible.

**Independent Test**: Se prueba entregando todas las fichas del conjunto e intentando
recibir una más.

**Acceptance Scenarios**:

1. **Given** las 40 fichas entregadas, **When** el operario intenta recibir otra bicicleta, **Then** el sistema le dice que no quedan fichas disponibles y no registra nada
2. **Given** ese mismo estado, **When** el operario mira la taquilla, **Then** ve cuántas fichas quedan disponibles antes de intentarlo

---

### Edge Cases

- **La bicicleta que nadie recoge.** Un movimiento de bicicleta puede quedar abierto días. La ficha sigue entregada y no vuelve al conjunto; es correcto, porque el tarjetón físico tampoco volvió. El establecimiento lo ve en la lista de lo que está adentro.
- **Dos operarios reciben a la vez.** Dos bicicletas entrando en el mismo instante no pueden recibir la misma ficha. La asignación tiene que ser exclusiva aunque dos taquillas trabajen en paralelo.
- **Número de ficha que coincide con una placa.** Si alguien escribe `123` en el campo único, el sistema tiene que saber si es la ficha 123 o parte de una placa.
- **La ficha se devuelve pero la bicicleta no era esa.** Fuera de alcance: el sistema registra a quién se le entregó qué ficha, no verifica identidad ni propiedad. Se anota explícitamente para que no se asuma lo contrario.
- **Cambiar el conjunto con fichas entregadas.** Reducir el conjunto de 40 a 20 mientras la ficha 35 está entregada no puede borrar esa ficha.
- **Cortesía y corrección.** Una bicicleta tiene que poder salir sin cobro y su cobro tiene que poder corregirse, exactamente igual que un vehículo con placa.
- **Establecimiento suspendido.** Como con los vehículos: no se reciben bicicletas nuevas, pero las que están adentro tienen que poder salir.

## Requirements *(mandatory)*

### Functional Requirements

**El conjunto de fichas**

- **FR-001**: El sistema MUST permitir que cada establecimiento declare cuántas fichas físicas tiene, numeradas correlativamente desde 1
- **FR-002**: El sistema MUST permitir ampliar el conjunto sin alterar las fichas existentes ni sus movimientos
- **FR-003**: El sistema MUST permitir dar de baja una ficha concreta, y MUST impedirlo mientras esa ficha esté entregada
- **FR-004**: El sistema MUST mantener cada ficha en exactamente uno de estos estados: disponible, entregada, perdida o dada de baja

**Recibir la bicicleta**

- **FR-006**: El sistema MUST proponer automáticamente una ficha disponible al recibir una bicicleta, sin que el operario tenga que elegirla
- **FR-007**: El sistema MUST garantizar que una ficha entregada no pueda entregarse otra vez, incluso si dos operarios reciben bicicletas simultáneamente
- **FR-008**: El sistema MUST rechazar la recepción cuando no queden fichas disponibles, con un mensaje que diga eso y no un error técnico
- **FR-009**: El sistema MUST mostrar en la taquilla cuántas fichas quedan disponibles
- **FR-010**: El sistema MUST registrar la recepción como un movimiento con las mismas garantías que uno de vehículo: turno, operario, hora y copia embebida de lo que se aplicó
- **FR-011**: El sistema MUST emitir un comprobante con el número de ficha destacado, con el mismo mecanismo de impresión y de pendientes que ya existe
- **FR-011a**: El sistema MUST exigir la cédula y el teléfono de quien deja la bicicleta
- **FR-011b**: El sistema MUST permitir además una nota corta y opcional sobre la bicicleta —color, marca, una seña—, que el operario puede saltarse sin escribir nada
- **FR-011c**: El sistema MUST proponer el teléfono ya conocido cuando la cédula escrita dejó una bicicleta antes en ese establecimiento, para no volver a preguntarlo

**Devolver la bicicleta**

- **FR-012**: Los operarios MUST poder resolver la devolución escribiendo el número de ficha
- **FR-013**: El sistema MUST calcular el cobro con la tarifa de bicicleta vigente, por el mismo motor que cobra los vehículos
- **FR-014**: El sistema MUST devolver la ficha al conjunto disponible al cerrar el movimiento con devolución
- **FR-015**: El sistema MUST rechazar la devolución de una ficha que no está entregada, sin registrar nada
- **FR-016**: El sistema MUST permitir cerrar sin cobro, con motivo obligatorio, igual que la cortesía de vehículos

**La ficha perdida**

- **FR-017**: Los operarios MUST poder buscar un movimiento de bicicleta abierto por la cédula de quien la dejó, sin el número de ficha
- **FR-018**: Los operarios MUST poder cerrar un movimiento declarando que el tarjetón no volvió
- **FR-019**: El sistema MUST dejar esa ficha como perdida y NO devolverla al conjunto disponible
- **FR-020**: El sistema MUST registrar quién declaró la pérdida y cuándo
- **FR-021**: El sistema MUST cobrar la permanencia normalmente al cerrar por pérdida, y MUST poder sumarle un valor de reposición del tarjetón que **cada establecimiento declara**, con cero como valor de partida. Va a configuración y no quemado porque toca dinero, que es exactamente lo que el Principio II reserva al establecimiento
- **FR-022**: El sistema MUST permitir devolver al conjunto una ficha perdida que aparece después

**Alcance del identificador**

- **FR-023**: El sistema MUST usar la ficha como identificador del movimiento de una bicicleta; la cédula es la vía de recuperación, no el identificador
- **FR-024**: El sistema MUST distinguir sin ambigüedad un número de ficha de una placa cuando ambos se escriben en el mismo campo
- **FR-025**: El alcance de las fichas MUST limitarse a las bicicletas. Las motocicletas tienen placa y siguen entrando por el flujo que ya existe

**Datos personales**

- **FR-026**: El sistema MUST tratar la cédula, el teléfono y la nota de la bicicleta como datos personales, con el mismo régimen que ya se aplica a las cuentas: se anonimizan cuando corresponde y no salen en ningún listado que no los necesite
- **FR-027**: El sistema MUST mostrar al operario, en la pantalla de recepción, para qué se piden esos datos, de modo que pueda decírselo al cliente
- **FR-028**: El sistema MUST purgar cédula y teléfono de los movimientos cerrados según el mismo plazo de retención que ya rige para el resto del historial, conservando el movimiento y su cobro

### Key Entities

- **Ficha**: un tarjetón físico numerado que pertenece a un establecimiento. Tiene un número único dentro de él y un estado: disponible, entregada, perdida o dada de baja. Se reutiliza indefinidamente.
- **Movimiento de bicicleta**: la misma entidad que el movimiento de un vehículo, identificada por ficha en vez de por placa. Conserva las mismas garantías de inmutabilidad y la misma copia embebida de lo cobrado.
- **Conjunto de fichas**: cuántas fichas tiene declaradas el establecimiento. No es una entidad aparte sino el resultado de las fichas existentes; se nombra porque es lo que el administrador cree estar editando.
- **Quien deja la bicicleta**: cédula y teléfono, tomados en la recepción. NO es una cuenta del sistema ni se convierte en una: es un dato del movimiento, y existe para poder devolver la bicicleta cuando el tarjetón se pierde. La cédula es además lo que permite reconocer al cliente que vuelve todos los días.

## Success Criteria *(mandatory)*

### Measurable Outcomes


- **SC-001**: Un operario recibe una bicicleta escribiendo sólo cédula y teléfono, sin elegir la ficha; y para un cliente que ya vino antes, sólo la cédula
- **SC-002**: Un operario devuelve una bicicleta escribiendo únicamente el número de ficha
- **SC-002a**: Un operario encuentra la bicicleta de un cliente que perdió el tarjetón escribiendo únicamente su cédula
- **SC-003**: Ninguna ficha puede estar entregada a dos bicicletas a la vez, ni siquiera cuando dos taquillas reciben en el mismo segundo
- **SC-004**: Toda bicicleta que entró puede salir, incluso sin tarifa declarada, sin fichas disponibles en ese momento, con el establecimiento suspendido, o sin el tarjetón
- **SC-005**: El importe cobrado a una bicicleta puede re-derivarse meses después a partir de lo guardado en su movimiento, sin depender de la tarifa vigente entonces
- **SC-006**: El administrador puede saber en cualquier momento cuántas fichas tiene, cuántas están afuera y cuántas se han perdido
- **SC-007**: Un movimiento de bicicleta cerrado hace más del plazo de retención ya no conserva la cédula ni el teléfono de nadie, pero sí conserva el cobro

## Assumptions

- **La tarifa de bicicleta ya existe** y se declara por la misma pantalla que las demás. Esta funcionalidad no toca el motor de cobro.
- **Los convenios que se activan por placa no alcanzan a las bicicletas**, porque una bicicleta no tiene placa. Los que se activan por sello sí, porque el sello lo trae el cliente y no depende del vehículo. No se construye ningún mecanismo nuevo de convenio.
- **La numeración de las fichas empieza en 1 y es correlativa**, porque así vienen los tarjetones que se compran hechos.
- **El sistema no verifica propiedad**: registra a qué ficha y a qué cédula corresponde qué movimiento, no que quien devuelve el tarjetón sea el dueño de la bicicleta. La cédula mejora el rastro respecto de un tarjetón de papel suelto, pero no es una verificación de propiedad y no debe presentarse como tal.
- **Pedir la cédula es tratamiento de datos personales.** En Colombia eso cae bajo la Ley 1581 de 2012, que obliga a decir para qué se piden, usarlos sólo para eso, y no conservarlos más de lo necesario. Se resuelve con lo que el sistema ya tiene —el régimen de anonimización y el plazo de retención del historial— en vez de construir un mecanismo aparte. Lo que sí es nuevo y hay que hacer es el aviso al cliente, que en la práctica es una frase que el operario pueda leer en pantalla.
- **La impresión del comprobante reutiliza lo ya construido**, incluida la lista de tickets sin imprimir y la reimpresión.
- **Los estados de ficha no se borran**: dar de baja es un estado, no una eliminación, por el Principio IV.

## Restricción de diseño registrada

**Esta funcionalidad no tiene maqueta.** Las 44 pantallas de `design_handoff_parquivo/` no
incluyen ninguna de fichas ni de bicicletas: los aciertos de la palabra "ficha" en el índice
son fichas de registro —de un parqueadero, de una cuenta—, no el tarjetón físico.

A diferencia de todas las funcionalidades anteriores, aquí el diseño visual **no está
decidido**. La consecuencia práctica es que hay que elegir entre dos caminos y la elección
es del producto, no de la implementación:

- Extender la pantalla de taquilla que ya existe, reutilizando su lenguaje visual y su campo
  único; o
- Diseñar la pantalla antes de construirla, como se hizo con las demás.

Se registra acá para que la decisión se tome a la vista y no se resuelva sola por omisión
mientras se implementa.

## Decisiones cerradas en clarificación y después

**Lo que se corrigió sobre la marcha, con el producto delante:**

4. **Una ficha es el ticket, no un tarjetón.** No hay inventario que declarar,
   ni estados, ni pérdida, ni reposición. El número se reutiliza en cuanto la
   bicicleta sale.
5. **Cuántas fichas hay es la capacidad de bicicletas.** Un espacio es una
   ficha. Declararlo dos veces habría abierto la posibilidad de que los dos
   números discreparan.
6. **En la recepción se pide también el NOMBRE**, además de cédula y teléfono.
7. **Los convenios no alcanzan a las bicicletas** salvo que el administrador lo
   encienda en ese convenio concreto. Un acuerdo se pactó pensando en los
   carros del comercio vecino, y extenderlo solo regalaría dinero en silencio.
8. **Los cobros cerrados salen de la taquilla** a una pantalla propia, con tres
   períodos —hoy, este mes, últimos seis meses—. La taquilla se queda con quién
   está adentro AHORA. Un operario ve sólo lo que él cobró.

**Lo acordado en la clarificación inicial:**

1. **Sólo las bicicletas usan ficha.** Las motocicletas tienen placa y siguen entrando por
   el flujo que ya existe. Mantiene el alcance pequeño y no toca nada construido.
2. **Se registra la cédula y el teléfono de quien deja la bicicleta**, y opcionalmente una
   nota corta sobre ella. La cédula es la vía de recuperación cuando se pierde el tarjetón,
   que era la pregunta que quedaba abierta y que así se responde con un mecanismo en vez de
   con un cobro.
3. **El valor de reposición del tarjetón lo declara cada establecimiento**, con cero de
   partida. La pregunta original —si se cobra— deja de ser urgente porque la ficha se
   recupera por cédula, pero el tarjetón físico igual se perdió; se deja configurable
   porque toca dinero, y el Principio II reserva eso al establecimiento.

## Dependencias

- **F3 (taquilla de vehículos)**, entregada: movimiento, sesiones de turno, cortesía,
  correcciones, comprobante impreso y ocupación
- **F2 (configuración del establecimiento)**, entregada: tarifas por tipo de vehículo
- **F1 (plataforma)**, entregada: aislamiento por establecimiento y autorización
