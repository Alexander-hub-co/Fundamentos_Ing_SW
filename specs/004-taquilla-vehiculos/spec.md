# Feature Specification: Taquilla de vehículos

**Feature Branch**: `004-taquilla-vehiculos`

**Created**: 2026-08-19

**Status**: Draft

**Input**: Todo lo construido hasta ahora configura un parqueadero pero no atiende a un solo cliente. Esta funcionalidad es la que hace que el producto sirva: el operario escribe una placa y el sistema decide si es una entrada o una salida, cobra lo que corresponde según la tarifa y los convenios ya declarados, y deja el movimiento en el historial. Es la primera vez que Parquivo maneja dinero de verdad.

## Clarifications

### Session 2026-08-19

- Q: ¿Un parqueadero puede operar sin entregarle un papel impreso al cliente cuando entra? → A: No. Sin comprobante físico no hay operación, así que el ticket entra en el alcance y la impresión hay que resolverla antes de entregar.
- Q: Si la impresora falla y hay un vehículo esperando en la puerta, ¿qué debe hacer el sistema? → A: Registrar la entrada igual, avisar que el comprobante no salió y dejar el movimiento marcado para reimprimir.
- Q: ¿Un vehículo puede salir sin pagar, y cómo se registra? → A: Sí. Se cierra en cero como cortesía, con motivo obligatorio y registro de quién la otorgó, distinguible de un cobro de cero pesos.
- Q: Cuando un cobro ya cerrado salió mal, ¿quién puede corregirlo? → A: El administrador del establecimiento, y quien él autorice expresamente. Siempre mediante un asiento de corrección que deja intacto el original.
- Q: Un permiso delegable choca con el "exactamente tres niveles" de la constitución. ¿Cómo se resuelve? → A: Enmendando la constitución por su procedimiento formal. Quedó en 1.1.0, con la delegación de operaciones nombradas acotada por cuatro reglas.
- Q: ¿Cómo están conectadas las impresoras de los parqueaderos reales? → A: De las tres formas: por cable USB, por red con su propia dirección, y por Bluetooth. La solución tiene que servir para las tres.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El ciclo completo de un vehículo (Priority: P1)

Un operario atiende la taquilla con carros esperando detrás. Llega uno, escribe la placa,
pulsa Enter y el carro está adentro. Horas después el mismo carro sale: escribe la misma
placa, el sistema reconoce que ya está adentro, le muestra cuánto tiempo lleva y cuánto
debe pagar, y con otra pulsación el movimiento queda cerrado y cobrado.

**Por qué es P1**: es la funcionalidad entera. Sin ella, todo lo construido hasta ahora
—establecimientos, cuentas, tarifas, horarios, convenios— configura un parqueadero que no
puede atender a nadie. Entregada sola, un parqueadero ya puede operar.

**Prueba independiente**: registrar la entrada de un carro y de una moto, esperar, y
registrar sus salidas comprobando que el importe coincide con el que arroja el comprobador
de convenios para esa misma permanencia.

**Escenarios de aceptación**:

1. **Given** un establecimiento con tarifas declaradas y ningún vehículo adentro, **When**
   el operario escribe una placa terminada en dígito y confirma, **Then** queda registrada
   la entrada de un carro, sin que nadie haya elegido el tipo.
2. **Given** el mismo establecimiento, **When** el operario escribe una placa terminada en
   letra, **Then** queda registrada la entrada de una moto.
3. **Given** un vehículo adentro, **When** el operario escribe su placa, **Then** el
   sistema no ofrece registrar otra entrada: reconoce que ya está y ofrece la salida, con
   el tiempo transcurrido y el importe.
4. **Given** una placa que no corresponde a ningún formato conocido, **When** el operario
   la escribe, **Then** el sistema la rechaza con un error explícito para que la corrija,
   y no la clasifica por defecto ni adivina.
5. **Given** un vehículo cuyo tipo no tiene tarifa declarada, **When** el operario intenta
   registrar su entrada, **Then** el sistema lo dice antes de dejarlo entrar, porque un
   vehículo que entra sin tarifa es uno que no se va a poder cobrar al salir.
5b. **Given** una entrada registrada, **When** el operario pide reimprimir el
   comprobante, **Then** sale el mismo comprobante sin que se cree un movimiento nuevo ni
   se altere el que existe.
6. **Given** una salida en curso, **When** el operario la confirma, **Then** el movimiento
   queda cerrado con el importe cobrado, el operario de entrada, el de salida y las dos
   marcas de tiempo.
6b. **Given** un vehículo adentro, **When** el operario cierra su salida como cortesía,
   **Then** el sistema le exige un motivo, guarda quién la otorgó y cuánto se habría
   cobrado, y el movimiento queda distinguible de uno cobrado en cero.
7. **Given** un movimiento ya cerrado, **When** alguien intenta modificarlo o borrarlo,
   **Then** el sistema lo impide: las correcciones son asientos nuevos que lo referencian.

---

### User Story 2 - Saber quién atendió y en qué turno (Priority: P2)

El administrador necesita saber quién estaba en la taquilla cuando ocurrió cada
movimiento. El operario abre su turno al llegar y lo cierra al irse; el sistema guarda la
hora real además de la programada, porque casi nunca coinciden.

**Por qué es P2**: el ciclo del vehículo funciona sin esto —cada movimiento ya registra al
operario—, pero sin turnos no se puede cuadrar una caja ni saber a quién preguntarle por
un cobro raro. Se entrega y se prueba aparte.

**Prueba independiente**: abrir un turno, registrar movimientos, cerrarlo, y comprobar que
cada movimiento quedó atribuido a ese turno y que la sesión guarda la hora real de
apertura y de cierre.

**Escenarios de aceptación**:

1. **Given** un turno declarado que trabaja hoy, **When** el operario lo abre a una hora
   distinta de la programada, **Then** la sesión guarda las dos horas: la programada y la
   real.
2. **Given** una sesión de turno abierta, **When** se registran entradas y salidas,
   **Then** cada una queda atribuida a esa sesión.
3. **Given** un vehículo que entró en el turno de la mañana, **When** sale en el de la
   tarde, **Then** el movimiento guarda un turno por extremo y no uno solo.
4. **Given** una sesión abierta, **When** el operario la cierra, **Then** queda registrada
   la hora real de cierre y deja de recibir movimientos.
5. **Given** ninguna sesión abierta, **When** se registra un movimiento, **Then** se
   registra igual y queda sin turno: no se puede dejar un carro afuera porque nadie abrió
   una sesión.

---

### User Story 3 - Ver cuántos hay adentro (Priority: P3)

El operario y el administrador quieren saber cuántos vehículos hay adentro por tipo y
cuántos caben. La capacidad ya se declara desde la fase anterior; hasta ahora no había
nada contra qué contrastarla.

**Por qué es P3**: no bloquea la operación. Es la primera vez que la capacidad declarada
sirve para algo, y por eso vale la pena, pero un parqueadero puede cobrar sin ella.

**Prueba independiente**: registrar entradas de varios tipos y comprobar que el conteo por
tipo coincide, y que baja al registrar salidas.

**Escenarios de aceptación**:

1. **Given** tres carros y dos motos adentro, **When** se mira la ocupación, **Then**
   muestra tres de la capacidad declarada para carros y dos para motos.
2. **Given** la capacidad de carros llena, **When** el operario registra otra entrada,
   **Then** el sistema avisa pero no lo impide: quien está en la taquilla ve el carro y
   sabe si cabe mejor que el sistema.
3. **Given** un tipo sin capacidad declarada, **When** se mira la ocupación, **Then**
   muestra cuántos hay sin inventar un máximo.

---

### Edge Cases

- **El vehículo lleva días adentro.** Se cobra lo que diga la tarifa, que ya sabe
  distinguir si la plena topa por jornada o por estadía. No hay tope especial ni aviso: es
  una decisión del establecimiento, ya declarada.
- **Cada parqueadero tiene una impresora distinta.** Una por cable, otra por red, otra por
  Bluetooth. La solución tiene que servir para las tres sin que nadie cambie de equipo.
- **El comprobante no sale.** Papel atascado, impresora apagada, servicio caído. La
  entrada se registra igual, se avisa, y el movimiento queda pendiente de comprobante. Es
  la situación operativa más probable de todas, y bloquear la entrada por ella dejaría los
  vehículos acumulándose en la puerta hasta que alguien arregle la impresora.
- **La impresora vuelve con varios pendientes acumulados.** Se pueden emitir todos los
  comprobantes pendientes, y emitirlos no altera ningún movimiento: sólo deja de estar
  pendiente.
- **Una cortesía sin motivo.** No se puede: el motivo es obligatorio. Es lo único que
  distingue después una decisión legítima de una fuga de caja.
- **El establecimiento está suspendido.** No se registran entradas nuevas, pero sí se
  cierran las que están adentro. Dejar vehículos atrapados por una decisión administrativa
  sería inaceptable.
- **El horario cambió mientras el vehículo estaba adentro.** El cobro usa el horario
  vigente en el momento del cobro. Es lo mismo que ya advierte la pantalla de horario.
- **La tarifa cambió mientras el vehículo estaba adentro.** Se cobra con la tarifa vigente
  al momento de la salida, y el movimiento guarda copia de la que se usó.
- **Dos operarios registran la misma placa a la vez.** Sólo una de las dos operaciones
  puede prosperar: una placa no puede estar adentro dos veces.
- **La misma placa vuelve a entrar el mismo día.** Es un movimiento nuevo e independiente.
  Lo único que se acumula entre visitas es el conteo de convenios aplicados en el día.
- **El operario se da cuenta de que cobró mal, y el cliente sigue ahí.** Si no está
  autorizado, lo reporta al administrador. Si el administrador ya lo autorizó, lo corrige
  él mismo y queda registrado quién lo autorizó y quién lo hizo.
- **Se revoca la autorización de alguien que ya emitió correcciones.** Las correcciones
  emitidas se conservan: eran válidas cuando se hicieron. Lo que cambia es que no puede
  emitir más.
- **El operario cierra su turno con vehículos adentro.** Se permite: los vehículos son del
  establecimiento, no del turno. Los cierra quien esté en la taquilla cuando salgan.

## Requirements *(mandatory)*

### Un solo campo resuelve las dos cosas

- **FR-001**: El sistema MUST resolver, a partir de la placa escrita, si corresponde
  registrar una entrada o una salida, sin que el operario elija entre las dos.
- **FR-002**: Registrar la entrada de un carro o de una moto MUST requerir exactamente un
  dato: la placa. MUST NOT existir un selector manual de tipo de vehículo.
- **FR-003**: El tipo MUST derivarse del último carácter de la placa: dígito es carro,
  letra es moto. Esta regla MUST vivir aislada y probada, y MUST poder cambiar sin tocar
  el flujo de registro.
- **FR-004**: Una placa que no corresponda a ningún formato válido conocido MUST
  rechazarse con un error explícito. MUST NOT clasificarse por defecto ni adivinarse.
- **FR-005**: Las placas MUST normalizarse antes de compararse, de modo que "abc 123" y
  "ABC-123" sean el mismo vehículo.
- **FR-006**: El sistema MUST impedir que una misma placa esté adentro dos veces a la vez.
- **FR-007**: El sistema MUST avisar antes de registrar la entrada de un vehículo cuyo
  tipo no tenga tarifa declarada, porque no se le va a poder cobrar la salida.

### El cobro

- **FR-008**: Al registrar la salida, el sistema MUST calcular el importe reutilizando el
  cálculo que ya existe, sin reimplementarlo: tarifa vigente, horario del establecimiento,
  convenios aplicables y regla de redondeo.
- **FR-009**: El sistema MUST aplicar solos los convenios de activación por placa que
  cubran esa placa y estén vigentes en el instante de la salida.
- **FR-010**: El sistema MUST ofrecer un control por cada convenio de activación por sello
  vigente, rotulado con el nombre del convenio, para que quien atiende confirme el que
  traiga el ticket. MUST NOT existir ninguna condición en el código que mencione un
  convenio o un comercio concreto.
- **FR-011**: El sistema MUST contar cuántas veces se aplicó ya cada convenio ese día a
  esa placa —día calendario del establecimiento, contra el día de la salida— y usar ese
  número al calcular, de modo que los límites diarios declarados surtan efecto.
- **FR-012**: La pantalla MUST mostrar el desglose y no sólo el total: el importe base,
  cada convenio con su efecto, los que no se aplicaron y por qué, y el redondeo.
- **FR-013**: Antes de confirmar una entrada, el sistema MUST mostrar la tarifa que se va
  a aplicar; si la placa tiene convenio, MUST nombrar el convenio.
- **FR-014**: El sistema MUST mostrar, mientras el vehículo sigue adentro, cuánto tiempo
  lleva y cuánto pagaría si saliera en ese momento.

### El comprobante

- **FR-007a**: Al registrar una entrada, el sistema MUST producir un comprobante físico
  para el cliente. Un parqueadero no puede operar sin entregarlo.
- **FR-007b**: El comprobante MUST llevar lo necesario para reclamar el vehículo y para
  resolver una discusión sobre el cobro: la placa, la fecha y hora de entrada, el tipo de
  vehículo, la tarifa que se le va a aplicar, el establecimiento y el identificador del
  movimiento.
- **FR-007b-bis**: El identificador que aparece en el comprobante MUST ser legible y MUST
  llevar la sigla del establecimiento, como ya hacen los códigos de los parqueaderos y de
  las cuentas. Alguien va a tener que leerlo en voz alta por teléfono o escribirlo a mano
  cuando el papel se borre, y una cadena larga y aleatoria no sirve para eso.
- **FR-007c**: El sistema MUST NOT asumir que la página web envía el trabajo directamente
  a la impresora. El mecanismo MUST decidirse y documentarse antes de implementarse.
- **FR-007c-bis**: El mecanismo MUST servir para las tres formas de conexión que existen
  en los parqueaderos reales: cable USB, red con dirección propia, y Bluetooth. MUST NOT
  elegirse una solución que obligue a los establecimientos a cambiar de impresora.
- **FR-007c-ter**: El mecanismo MUST NOT depender de que el servidor alcance la impresora.
  Una impresora de red en el local tiene una dirección privada, así que desde fuera es tan
  inalcanzable como una conectada por cable: el trabajo tiene que salir desde la máquina
  de la taquilla, no desde el servidor.
- **FR-007d**: El sistema MUST permitir reimprimir el comprobante de un movimiento abierto
  sin crear un movimiento nuevo ni alterar el existente. Un papel se atasca, se rompe o se
  pierde, y eso no puede obligar a registrar el vehículo dos veces.
- **FR-007e**: Un fallo al emitir el comprobante MUST NOT impedir que la entrada se
  registre. El vehículo ya está físicamente en la puerta: negarle la entrada no lo hace
  desaparecer, sólo lo deja sin registro, que es peor que dejarlo sin papel. La placa
  basta para reclamarlo.
- **FR-007f**: Cuando el comprobante no salga, el sistema MUST decirlo de forma inequívoca
  a quien atiende y MUST dejar el movimiento señalado como pendiente de comprobante, para
  que se pueda emitir en cuanto la impresora vuelva.
- **FR-007g**: El sistema MUST poder listar los movimientos que quedaron pendientes de
  comprobante. Sin esa lista, el aviso se pierde en cuanto llega el vehículo siguiente.

### La cortesía

- **FR-014a**: El sistema MUST permitir cerrar un movimiento sin cobrar, para el vehículo
  del dueño, el del personal o el cliente a quien se le perdona el cobro. Sin esta salida,
  quien atiende improvisa —una salida falsa, o un movimiento que se queda abierto para
  siempre— y las dos ensucian el historial de una forma que después nadie desenreda.
- **FR-014b**: La cortesía MUST exigir un motivo escrito. Es lo único que después permite
  distinguir una decisión legítima de una fuga de caja.
- **FR-014c**: El sistema MUST registrar quién otorgó cada cortesía.
- **FR-014d**: Una cortesía MUST quedar distinguible de un cobro de cero pesos. Son cosas
  distintas: una es dinero que se decidió no cobrar y la otra es un cálculo que dio cero.
  Confundirlas haría ilegible cualquier reporte de ingresos.
- **FR-014e**: El sistema MUST guardar, junto a la cortesía, cuánto se habría cobrado. Sin
  ese número no se puede medir lo que las cortesías le cuestan al establecimiento.

### El historial

- **FR-015**: Un movimiento finalizado MUST NOT modificarse ni eliminarse. Las
  correcciones MUST registrarse como asientos nuevos que referencian el original.
- **FR-015a**: Los administradores de establecimiento MUST poder emitir una corrección. Un
  operario MUST NOT poder hacerlo por su rol: es dinero ya cobrado, y quien cobró de menos
  no debe poder ajustar su propia caja sin que nadie lo haya autorizado.
- **FR-015a-bis**: Un administrador MUST poder autorizar a una persona concreta de su
  establecimiento a emitir correcciones, sin convertirla en administrador. Un parqueadero
  pequeño tiene un operario de confianza en el turno de noche y ningún administrador
  despierto; negarle la corrección hasta la mañana siguiente es una regla que la operación
  real termina saltándose por fuera del sistema.
- **FR-015a-ter**: Esa autorización MUST registrar quién la otorgó, a quién y cuándo, y
  MUST poder revocarse. MUST NOT alcanzar nunca fuera del establecimiento de quien la
  otorga.
- **FR-015a-quater**: "Emitir correcciones" MUST ser la única operación delegable que
  introduce esta funcionalidad. Ampliar la lista exige volver a la especificación, no
  añadir una casilla.
- **FR-015b**: Una corrección MUST llevar un motivo escrito y MUST registrar quién la
  emitió y cuándo.
- **FR-015c**: Una corrección MUST conservar los dos números: lo que se cobró y lo que se
  debió cobrar. Reemplazar uno por otro destruiría la única prueba de que hubo un error.
- **FR-015d**: Los reportes MUST poder reflejar el importe corregido sin que el asiento
  original desaparezca.
- **FR-016**: Todo movimiento MUST registrar el operario de entrada, el operario de salida
  y las marcas de tiempo de ambos eventos.
- **FR-017**: El importe cobrado MUST almacenarse junto con una COPIA de la tarifa y de
  los convenios aplicados en ese instante, no una referencia. Cambiar una tarifa mañana
  MUST NOT alterar lo que ya se cobró.
- **FR-018**: Suspender o dar de baja un establecimiento MUST NOT destruir su historial de
  movimientos.
- **FR-019**: Los importes MUST almacenarse como enteros, nunca en punto flotante, y las
  marcas de tiempo MUST guardarse sin ambigüedad de zona horaria.

### Los turnos

- **FR-020**: Los operarios MUST poder abrir y cerrar una sesión de turno desde la
  taquilla.
- **FR-021**: Una sesión MUST guardar la hora real de apertura y de cierre además de la
  programada por el turno, porque casi nunca coinciden y la diferencia es justamente lo
  que hay que poder revisar.
- **FR-022**: Cada movimiento MUST quedar atribuido a la sesión de turno abierta en el
  momento de cada extremo. La entrada y la salida MUST poder pertenecer a sesiones
  distintas.
- **FR-023**: La ausencia de sesión abierta MUST NOT impedir registrar movimientos. El
  movimiento queda sin turno: no se puede dejar un vehículo afuera porque nadie abrió una
  sesión.
- **FR-024**: El sistema MUST permitir cerrar una sesión aunque queden vehículos adentro.

### Quién puede atender

- **FR-025**: Los operarios de taquilla MUST poder registrar entradas y salidas de su
  establecimiento, y de ningún otro.
- **FR-026**: Los administradores de establecimiento MUST poder hacer además todo lo que
  hace un operario, porque hay parqueaderos donde el administrador trabaja en taquilla.
- **FR-027**: Con el establecimiento suspendido, el sistema MUST impedir entradas nuevas y
  MUST permitir cerrar las que ya están adentro.

### La ocupación

- **FR-028**: El sistema MUST poder decir cuántos vehículos hay adentro por tipo.
- **FR-029**: El sistema MUST contrastar ese conteo con la capacidad declarada cuando
  exista, y MUST NOT inventar un máximo cuando no se declaró.
- **FR-030**: Superar la capacidad MUST avisar sin impedir. Quien está en la taquilla ve
  el vehículo y sabe si cabe mejor que el sistema.

### Key Entities

- **Movimiento**: la estancia de un vehículo. Guarda la placa normalizada, el tipo
  derivado, los dos instantes, los dos operarios, las dos sesiones de turno, el importe
  cobrado y la copia de lo que se aplicó para cobrarlo. Pertenece a un establecimiento.
- **Sesión de turno**: una jornada concreta de un turno declarado. Guarda quién la abrió,
  la hora programada y la real, y cuándo se cerró.
- **Corrección**: un asiento que referencia un movimiento cerrado, emitido por un
  administrador. Guarda el importe corregido, el motivo, quién la emitió y cuándo. Nunca
  modifica el movimiento original: conserva los dos números, que es lo que prueba que hubo
  un error y de cuánto.

## Success Criteria *(mandatory)*

- **SC-001**: Registrar la entrada de un carro requiere escribir la placa y confirmar, sin
  ningún otro dato ni elección.
- **SC-002**: El mismo campo, con la misma placa, registra la entrada la primera vez y
  ofrece la salida la segunda, sin que el operario cambie de modo.
- **SC-003**: El importe que cobra la taquilla coincide exactamente con el que arroja el
  comprobador de convenios para la misma permanencia, tarifa y convenios.
- **SC-004**: Un movimiento cobrado hace seis meses sigue mostrando el mismo importe y el
  mismo desglose después de que se cambien las tarifas y los convenios.
- **SC-005**: Un operario de un establecimiento no logra registrar ni consultar
  movimientos de otro.
- **SC-006**: Con el establecimiento suspendido, no entra ningún vehículo nuevo y todos
  los que están adentro pueden salir.
- **SC-007**: El conteo de vehículos adentro coincide siempre con el número de movimientos
  sin salida registrada.
- **SC-008**: Ninguna placa figura adentro dos veces, ni siquiera si dos personas la
  registran al mismo tiempo.
- **SC-009**: Toda entrada registrada produce un comprobante con la placa, la hora y la
  tarifa, y ese comprobante se puede volver a emitir sin duplicar el movimiento.
- **SC-010**: Con la impresora fuera de servicio, el parqueadero sigue recibiendo
  vehículos y ninguno queda sin registrar.
- **SC-011**: Los movimientos que quedaron sin comprobante se pueden encontrar y resolver
  después, sin depender de que alguien recuerde cuáles fueron.
- **SC-012**: Toda salida sin cobro queda con un motivo escrito, con quién la otorgó y con
  el importe que se dejó de cobrar, y se distingue de un cobro que dio cero.
- **SC-013**: Un movimiento corregido conserva visibles el importe original y el
  corregido, con el motivo y el autor de la corrección.
- **SC-014**: Un operario sin autorización expresa no logra alterar ningún movimiento
  cerrado, ni propio ni ajeno.
- **SC-015**: Toda corrección se puede rastrear hasta quién la emitió y, cuando la emitió
  alguien autorizado, hasta el administrador que lo autorizó.

## Assumptions

- **El ticket impreso es obligatorio para operar**, decidido por el propietario del
  producto: sin comprobante físico el parqueadero no funciona. Eso mete la impresión
  térmica dentro del alcance y la convierte en el riesgo técnico más grande de la
  funcionalidad. Son impresoras de factura del tipo estándar de la industria, conectadas
  de las tres formas posibles según el local: cable, red y Bluetooth. La constitución prohíbe asumir que una página web controla una impresora
  directamente, así que el MECANISMO —servicio local, aplicación auxiliar o impresión del
  navegador— es una decisión técnica que se toma y se documenta al planificar, con un
  spike por delante si hace falta. Lo que esta especificación fija es QUÉ tiene que
  ocurrir, no CÓMO.
- **El cobro ocurre al registrar la salida**, no antes. No hay prepago ni cobro
  anticipado.
- **El pago es en efectivo y fuera del sistema.** La taquilla dice cuánto se debe cobrar;
  no registra medios de pago ni cuadra caja. Eso pertenece a los reportes.
- **Cualquiera que atienda la taquilla puede otorgar una cortesía**, no sólo un
  administrador. Exigir autorización dejaría sin salida un turno de noche, y el motivo
  obligatorio más el registro de quién la dio bastan para revisarlo después.
- **Superar la capacidad avisa pero no impide**, igual que el aviso de horas sin cubrir de
  los turnos: el sistema informa y la persona decide.
- Se asume que el establecimiento ya tiene tarifas declaradas para los tipos que va a
  recibir; FR-007 avisa cuando no.

## Out of Scope

- **Las bicicletas y su sistema de fichas.** No tienen placa, así que ni el campo único ni
  la derivación del tipo les sirven. Es una funcionalidad aparte.
- **Los reportes e históricos agregados** —ingresos por día, por turno, ocupación en el
  tiempo—. Necesitan movimientos cerrados, que es justo lo que esta funcionalidad empieza
  a producir.
- **Los pagos electrónicos y el cuadre de caja.**

## Constitutional Notes

- **Principio I (aislamiento)**: los movimientos son el dato más sensible del sistema.
  FR-025 y SC-005 lo exigen, y hace falta una prueba negativa: un operario de A no alcanza
  los movimientos de B.
- **Principio II (cero valores quemados)**: esta funcionalidad no declara ningún valor de
  negocio. Todo lo que usa —tarifas, horarios, convenios, capacidad, redondeo— ya está
  declarado por el establecimiento.
- **Principio III (la taquilla es la ruta crítica)**: es la funcionalidad que lo
  materializa. FR-002 y SC-001 lo hacen verificable. Los controles de sello (FR-010) son
  el único añadido a la pantalla, y ya se justificó por qué no pueden vivir en el panel
  administrativo: el sello es un objeto físico que llega con el cliente en el instante de
  la salida.
- **Principio IV (integridad del historial)**: FR-015 a FR-019 lo recogen entero, y la
  clarificación lo apretó: las correcciones llevan motivo, conservan los dos importes y
  sólo las emite un administrador o quien él autorice expresamente. La cortesía (FR-014a a FR-014e) es la otra cara: una salida sin cobro
  es una decisión, no un cálculo, y se registra como tal para que los ingresos sigan
  siendo legibles. Es la
  primera funcionalidad donde el principio tiene sujeto: hasta ahora no había movimientos
  que proteger.
- **Principio V (alcance deliberado)**: las bicicletas y los reportes quedan fuera, cada
  uno con su razón escrita. El ticket entró tras la clarificación.
- **Roles y autorización (constitución 1.1.0)**: el permiso delegable de FR-015a-bis no
  cabía en la redacción anterior, que fijaba "exactamente tres niveles". En vez de
  reinterpretarla se enmendó la constitución por su procedimiento formal, y la enmienda
  acota la delegación con cuatro reglas: lista cerrada de operaciones, registro de quién
  autoriza a quién, revocabilidad, y prohibición de alcanzar fuera del establecimiento.
  FR-015a-quater es la lista cerrada que esa enmienda exige.
