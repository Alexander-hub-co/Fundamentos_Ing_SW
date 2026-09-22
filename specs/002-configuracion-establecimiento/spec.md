# Feature Specification: Configuración del establecimiento

**Feature Branch**: `002-configuracion-establecimiento`
**Created**: 2026-08-16
**Status**: Borrador — pendiente de `/speckit-clarify`
**Input**: F2 del roadmap. El administrador de un parqueadero configura su propio local: horarios de
atención, tarifas, convenios, capacidad y su equipo de operarios.

## Contexto y frontera

F1 dejó construido y en operación: autenticación, los tres roles, el aislamiento por
establecimiento, el alta de establecimientos por el administrador general, los cuatro estados con
modo restringido, el ciclo de vida de las cuentas, los códigos legibles con sigla, y la edición de
los datos básicos del establecimiento —nombre, dirección, ciudad, teléfono—. Nada de eso se rehace.

F2 responde una sola pregunta: **¿bajo qué reglas opera este parqueadero?** Deja el establecimiento
listo para que F3 pueda cobrar, pero no cobra nada.

**Dentro**: horarios de atención, tarifas, convenios, capacidad, y alta y gestión de operarios por
el propio administrador del establecimiento.

**Fuera**: registrar entradas y salidas, calcular un cobro real, imprimir tickets, fichas de
bicicleta y reportes. Todo eso es F3 en adelante. Acá se define la regla; allá se aplica.

**El turno se parte en tres, y sólo la primera parte es de F2.** Al principio de la clarificación
quedó entero en F3; el propietario detalló después el sistema de turnos y quedó claro que su
configuración es exactamente lo que F2 hace —reglas del establecimiento, distintas en cada local,
declaradas por su administrador—. El reparto es:

| Parte | Feature | Qué es |
|---|---|---|
| Configuración de turnos | **F2** | Crear turnos con nombre, horario, días y operarios asignados |
| Sesiones de turno | F3 | Iniciar y finalizar el turno, con hora real frente a programada |
| Turno en el movimiento | F3 | Cada entrada y salida guarda quién la hizo y bajo qué turno |
| Reportes por turno | F5 | Entradas, salidas e ingresos agrupados por turno y por operario |

**La detección del tipo de vehículo por la placa es de F3.** El propietario describió la regla
colombiana —placa terminada en número es carro, terminada en letra es moto— y que el operario no
debe elegir el tipo a mano. Eso ocurre al registrar la entrada, así que pertenece a la taquilla.
F2 sólo necesita que los tipos existan para colgarles una tarifa. Conviene anotar desde ya que esa
regla es una heurística sobre los formatos de placa vigentes y que necesitará una salida manual
para las que no encajen.

La frontera es la misma de siempre: F2 declara la regla, F3 la ejerce. Un turno configurado se
puede verificar entero sin que nadie lo haya abierto nunca.

Una consecuencia deliberada: **la configuración se puede verificar sin que exista ni un solo
movimiento**. Si para probar una tarifa hiciera falta un vehículo adentro, F2 no sería
independiente de F3 y las dos tendrían que entregarse juntas.

## Clarifications

### Session 2026-08-16

- Q: ¿Hace falta un tercer modelo de cobro, el que aparece en la pantalla 1b del rediseño? → A: Sí.
  **Primera hora fija y después bloques**: la primera hora se cobra entera aunque el vehículo se
  vaya antes, y a partir de ahí cada fracción de bloque cobra el bloque completo. Los dos modelos
  anteriores no se tocan.
- Q: ¿Cómo debe cobrarse el tiempo que no llega a una hora completa? → A: **Revisada.** Primero se
  acordaron tres modos genéricos —hora completa, bloques y por minuto—. El propietario describió
  después cómo se cobra realmente en Colombia y el modelo quedó reemplazado por dos: **por minuto
  con tarifa mínima y plena** para vehículos motorizados, y **por intervalos con plena por jornada
  tarifaria** para bicicletas. La configurabilidad no cambia; cambia la forma de la regla.
- Q: ¿Quién puede nombrar administradores dentro de un establecimiento? → A: Un administrador de
  establecimiento también puede nombrar a otro administrador de su mismo establecimiento.
- Q: ¿El administrador general puede modificar la configuración de un establecimiento ajeno, o sólo
  consultarla? → A: Puede consultarla y modificarla; cada modificación queda auditada con su autor.
- Q: La tarifa plena de carros y motos, ¿topa toda la estadía o se reinicia cada jornada? → A: Lo
  elige cada establecimiento, declarándolo en cada tarifa. No hay valor por defecto invisible.
- Q: ¿Se cobran las horas en que el establecimiento estuvo cerrado a los vehículos que se quedaron
  adentro? → A: Lo elige cada establecimiento, con una sola regla para todos sus tipos de vehículo.
- Q: ¿Cómo se relacionan el horario de atención y los turnos, que ahora conviven en F2? → A: Son
  cosas distintas y se declaran por separado —el horario dice cuándo abre el local, los turnos
  quién lo cubre—. Si quedan horas de atención sin ningún turno asignado, el sistema lo avisa pero
  no lo impide.
- Q: ¿Dónde se especifica el turno de trabajo? → A: Primero se decidió que entero en F3. El
  propietario detalló después el sistema de turnos y la decisión quedó revisada: la CONFIGURACIÓN
  de turnos es de F2 —es una regla del establecimiento, distinta en cada local y declarada por su
  administrador—; las sesiones de turno y su registro en cada movimiento son de F3; los reportes
  por turno, de F5.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Definir cuánto cobra el parqueadero (Priority: P1)

El administrador del establecimiento define, para cada tipo de vehículo que recibe, cuánto cuesta
estacionar. Para carros y motos declara tres valores —tarifa mínima, valor por minuto y tarifa
plena—; para bicicletas, la duración del intervalo, cuánto vale cada intervalo y el máximo por
jornada. Después puede comprobar el cálculo con tiempos de ejemplo antes de que llegue el primer
cliente.

**Why this priority**: Es la razón de ser de la feature y lo que bloquea a F3. Un parqueadero sin
tarifa configurada no puede cobrar, y la alternativa —dejar valores escritos en el código— es
exactamente lo que el Principio II prohíbe. Sin esta historia, las demás no tienen a quién servir.

**Independent Test**: Se prueba entera definiendo una tarifa de cada modelo y ejercitando el
calculador con momentos de entrada y salida inventados, comprobando el importe y su desglose. No
hace falta que exista ningún vehículo ni ningún movimiento.

**Acceptance Scenarios**:

1. **Given** un establecimiento activo sin tarifas, **When** su administrador declara para
   automóvil una mínima de $500, $60 por minuto y una plena de $14.000, **Then** la tarifa queda
   vigente y el establecimiento aparece como listo para cobrar automóviles.
2. **Given** esa tarifa, **When** se calcula una permanencia de 5 minutos, **Then** el valor es
   $500: los $300 calculados quedan por debajo de la mínima.
3. **Given** esa tarifa, **When** se calcula una permanencia de 60 minutos, **Then** el valor es
   $3.600, que es el cálculo directo.
4. **Given** esa tarifa, **When** se calcula una permanencia de 250 minutos, **Then** el valor es
   $14.000: los $15.000 calculados superan la plena.
5. **Given** una tarifa de bicicleta con intervalo de 30 minutos a $500 y plena de $4.000,
   **When** se calcula una permanencia de 31 minutos, **Then** el valor es $1.000, porque la
   fracción cobra el intervalo entero.
6. **Given** esa misma tarifa, **When** se calcula una permanencia de 7 horas dentro de una sola
   jornada, **Then** el valor es $4.000 y no sigue creciendo.
7. **Given** un establecimiento que abre de 7:00 a 20:00 y esa tarifa de bicicleta, **When** una
   bicicleta entra a las 19:30 y sale a las 7:10 del día siguiente, **Then** el valor es $4.500:
   $4.000 por la jornada del primer día, nada por las horas cerradas, y $500 por los 10 minutos de
   la jornada siguiente.
8. **Given** un establecimiento de 24 horas, **When** una bicicleta entra a las 22:00 y sale a las
   2:00, **Then** el sistema cobra dos jornadas, porque la jornada se reinicia a las 00:00.
9. **Given** una tarifa vigente, **When** el administrador la modifica, **Then** la versión anterior
   se conserva con su periodo de vigencia y la nueva rige desde ese momento.
10. **Given** el administrador del establecimiento A, **When** intenta ver o modificar las tarifas
    de B, **Then** el sistema responde igual que si B no existiera.
11. **Given** una tarifa en edición, **When** la mínima declarada supera a la plena, **Then** el
    sistema rechaza el cambio: ninguna estadía podría cobrarse.

---

### User Story 2 - Declarar cuándo abre y cuánto cabe (Priority: P1)

El administrador declara el horario de atención de su parqueadero —abierto las 24 horas, un horario
fijo, o uno distinto por día de la semana— y cuántos cupos tiene para cada tipo de vehículo.

**Why this priority**: Es P1 junto con las tarifas porque F3 lo necesita desde el primer día: sin
capacidad no se puede saber si hay lugar, y sin horario no se sabe si el establecimiento debería
estar recibiendo vehículos. Es menos complejo que las tarifas, pero igual de bloqueante.

**Independent Test**: Se prueba declarando un horario con días distintos y una capacidad por tipo
de vehículo, y comprobando que el sistema informa correctamente si el establecimiento está abierto
en un momento dado y cuántos cupos declaró.

**Acceptance Scenarios**:

1. **Given** un establecimiento sin horario declarado, **When** su administrador lo declara como
   abierto las 24 horas, **Then** el sistema lo reporta como abierto en cualquier momento.
2. **Given** un establecimiento con horario de lunes a viernes de 7:00 a 19:00, **When** se
   consulta un domingo, **Then** el sistema lo reporta como cerrado.
3. **Given** un horario que cruza la medianoche —de 20:00 a 6:00—, **When** se consulta a las 2:00,
   **Then** el sistema lo reporta como abierto.
4. **Given** un establecimiento con capacidad declarada de 40 automóviles, **When** su
   administrador la consulta, **Then** ve 40 cupos de automóvil.
5. **Given** una capacidad en edición, **When** el administrador intenta declarar cupos negativos,
   **Then** el sistema rechaza el cambio.

---

### User Story 3 - Armar el equipo de la taquilla (Priority: P2)

El administrador del establecimiento da de alta a sus operarios de taquilla, les entrega una
contraseña temporal, y puede bloquearlos o darlos de baja cuando alguien deja de trabajar ahí.

**Why this priority**: P2 porque el administrador general ya puede crear operarios desde F1, así
que el trabajo no está bloqueado — sólo pasa por una persona que no debería tener que intervenir en
la rotación diaria de cada local. Delegarlo es valioso, pero no urgente.

**Independent Test**: Se prueba entera creando un operario desde la cuenta del administrador de un
establecimiento y comprobando que el operario puede entrar, que queda vinculado a ese
establecimiento y sólo a ese, y que su administrador puede bloquearlo.

**Acceptance Scenarios**:

1. **Given** un administrador de establecimiento, **When** da de alta un operario con nombre,
   correo y contraseña temporal, **Then** el operario queda vinculado a ese establecimiento con su
   código legible correlativo y obligado a cambiar la contraseña al entrar.
2. **Given** un administrador del establecimiento A, **When** intenta dar de alta un operario en el
   establecimiento B, **Then** el sistema lo rechaza.
3. **Given** un operario del establecimiento A, **When** su administrador lo bloquea, **Then** el
   operario no puede volver a entrar y sus sesiones abiertas dejan de servir.
4. **Given** un administrador de establecimiento, **When** consulta su equipo, **Then** ve sólo a
   las personas de su establecimiento.
5. **Given** un administrador de establecimiento, **When** intenta crear una cuenta de
   administrador general, **Then** el sistema lo rechaza.

---

### User Story 4 - Organizar quién trabaja y cuándo (Priority: P2)

El administrador del establecimiento crea los turnos de su parqueadero —con su nombre, su horario y
los días en que funcionan— y asigna a cada uno las personas que lo cubren. Puede incluirse a sí
mismo, porque en muchos parqueaderos el dueño atiende la taquilla.

**Why this priority**: P2 junto con el alta de operarios, y por la misma razón: el trabajo no está
bloqueado sin esto —F3 podría registrar movimientos sin turno— pero el turno es lo que después
permite saber quién estaba atendiendo y agrupar los ingresos del día. Cuanto más tarde llegue, más
movimientos quedan sin turno asociado y peor sale el primer reporte.

**Independent Test**: Se prueba entera creando dos turnos con horarios y días distintos, asignando
personas a cada uno, y comprobando que el sistema informa correctamente qué turno corresponde a un
momento dado y quién debería estar atendiendo, sin que nadie haya abierto ningún turno ni
registrado ningún movimiento.

**Acceptance Scenarios**:

1. **Given** un establecimiento sin turnos, **When** su administrador crea "Mañana" de 07:00 a
   15:00 de lunes a viernes y le asigna a una persona, **Then** el turno queda activo y el sistema
   informa que esa persona cubre ese horario esos días.
2. **Given** un establecimiento con turnos de mañana y tarde, **When** se consulta quién cubre las
   16:00 de un miércoles, **Then** el sistema responde el turno de la tarde y su gente.
3. **Given** un turno nocturno de 22:00 a 06:00, **When** se consulta a las 02:00 del martes,
   **Then** el sistema lo reporta vigente, entendiendo que empezó el lunes.
4. **Given** un establecimiento que abre distinto los sábados, **When** su administrador declara un
   turno propio para ese día, **Then** ese turno rige el sábado y los demás no.
5. **Given** un turno con una persona asignada, **When** el administrador se asigna también a sí
   mismo, **Then** el sistema lo acepta: el administrador puede atender la taquilla.
6. **Given** un turno activo, **When** el administrador lo marca inactivo, **Then** deja de regir
   sin desaparecer, y los movimientos que ya lo referencian siguen siendo explicables.
7. **Given** el administrador del establecimiento A, **When** intenta ver o modificar los turnos de
   B, **Then** el sistema responde igual que si B no existiera.
8. **Given** un turno en edición, **When** se intenta asignar a una persona que no pertenece al
   establecimiento, **Then** el sistema lo rechaza.

---

### User Story 5 - Aplicar convenios a clientes habituales (Priority: P3)

El administrador registra convenios: un descuento para los vehículos de una empresa vecina, o para
una placa concreta que estaciona todos los días.

**Why this priority**: P3 porque es la única parte de F2 que un parqueadero puede operar sin tener.
Un local que cobra tarifa plena a todo el mundo funciona; uno sin tarifas, no. Se entrega al final
para que un retraso acá no bloquee a F3.

**Independent Test**: Se prueba registrando un convenio por empresa y otro por placa, y
comprobando que el sistema informa qué descuento corresponde a una placa dada, sin cobrar nada.

**Acceptance Scenarios**:

1. **Given** un establecimiento con tarifas, **When** su administrador registra un convenio de 20%
   para una empresa y le asocia tres placas, **Then** el sistema informa ese descuento para esas
   tres placas.
2. **Given** una placa sin convenio, **When** se consulta su descuento, **Then** el sistema informa
   que no tiene ninguno.
3. **Given** un convenio con fecha de vencimiento pasada, **When** se consulta su descuento,
   **Then** el sistema informa que no está vigente.
4. **Given** el administrador del establecimiento A, **When** consulta los convenios,
   **Then** no ve ninguno del establecimiento B, ni siquiera para una placa que exista en ambos.

---

### Edge Cases

- ¿Qué pasa con una tarifa que se modifica mientras hay vehículos adentro que entraron bajo la
  anterior? (resuelto en FR-021: se conserva la versión y su vigencia).
- ¿Qué pasa si el establecimiento queda suspendido mientras su administrador edita la
  configuración? (resuelto en FR-057).
- ¿Qué ocurre si un tipo de vehículo tiene capacidad declarada pero no tiene tarifa? El
  establecimiento no está listo para recibirlo, y el sistema debe decirlo antes de que F3 lo
  descubra en la taquilla.
- ¿Qué pasa si el tope diario es menor que el valor por hora?
- ¿Qué pasa si un horario declara la hora de cierre igual a la de apertura?
- ¿Qué pasa si se registra la misma placa en dos convenios del mismo establecimiento?
- Una bicicleta que entra y sale dentro de las horas cerradas: si el establecimiento no cobra las
  horas cerradas no hay jornada que cobrar, y el importe es cero. ¿Se acepta un cobro de cero o hay
  un mínimo?
- ¿Qué pasa si el horario del establecimiento cambia mientras hay vehículos adentro que entraron
  bajo el anterior?
- ¿Qué pasa si dos turnos del mismo establecimiento se solapan en horario? ¿Es un error o una
  configuración legítima —dos personas cubriendo la hora pico— que el sistema debe permitir?
- Horas de atención sin ningún turno que las cubra: el sistema avisa, no lo impide.
- ¿Qué pasa si se desactiva un turno mientras alguien lo está cubriendo? (F3 hereda esta pregunta).
- ¿Qué pasa si el administrador se bloquea a sí mismo o da de baja su propia cuenta?

## Requirements *(mandatory)*

### Tarifas

Parquivo no es un sistema con tarifas predefinidas: es un **motor de tarifas configurable**. La
aplicación aporta la lógica del cálculo; cada establecimiento aporta sus precios, sus intervalos y
sus jornadas. Todos los importes que aparecen abajo son ilustrativos.

Hay **dos modelos de cobro**, y no son variantes del mismo: se calculan distinto y se topan
distinto.

**Modelo por minuto** — para vehículos motorizados. El valor crece minuto a minuto y queda acotado
por abajo y por arriba:

```
valor = minutos × valor_por_minuto
si valor < tarifa_minima → tarifa_minima
si valor > tarifa_plena  → tarifa_plena
```

**Modelo por intervalos** — para bicicletas. Cualquier fracción de intervalo cobra el intervalo
entero, y el tope se aplica **por jornada tarifaria**, no una sola vez sobre toda la estadía:

```
intervalos = techo(minutos_de_la_jornada / duracion_del_intervalo)
valor_de_la_jornada = min(intervalos × valor_del_intervalo, tarifa_plena)
valor = suma de las jornadas
```

- **FR-001**: El sistema MUST ofrecer los dos modelos de cobro y MUST asociar cada tipo de vehículo
  a uno de ellos.
- **FR-002**: El modelo por minuto MUST configurarse con tres valores por tipo de vehículo: tarifa
  mínima, valor por minuto y tarifa plena.
- **FR-003**: El modelo por intervalos MUST configurarse con tres valores: duración del intervalo
  en minutos, valor del intervalo y tarifa plena de la jornada.
- **FR-004**: En el modelo por minuto, el sistema MUST cobrar la tarifa mínima cuando el valor
  calculado quede por debajo de ella, y la tarifa plena cuando lo supere.
- **FR-005**: En el modelo por intervalos, cualquier fracción de intervalo MUST cobrar el intervalo
  completo. Con intervalos de 30 minutos, 31 minutos cobran dos.
- **FR-006**: Cada tipo de vehículo MUST poder tener sus propios valores. Un mismo establecimiento
  cobra distinto por un automóvil que por una motocicleta.
- **FR-007**: El sistema MUST rechazar una tarifa mínima mayor que la tarifa plena, porque ninguna
  estadía podría cobrarse.
- **FR-008**: El sistema MUST rechazar una duración de intervalo menor o igual a cero.
- **FR-009**: El sistema MUST calcular el tiempo de permanencia por su cuenta a partir de los
  momentos de entrada y de salida. Quien atiende la taquilla MUST NOT tener que calcular nada.
- **FR-010**: Los importes MUST expresarse en pesos colombianos sin decimales, que es la unidad en
  que se cobra en el país.
- **FR-011**: El sistema MUST NOT traer ninguna tarifa precargada ni suponer valores habituales. Un
  establecimiento nuevo nace sin tarifas y debe declararlas.
- **FR-012**: El sistema MUST permitir que un establecimiento tenga tarifas para unos tipos de
  vehículo y no para otros, e informar cuáles le faltan antes de operar.
- **FR-013**: Los dos modelos MUST estar declarados como datos y no como código, de modo que
  agregar un tercer modelo en el futuro no obligue a reescribir los existentes. El propietario ya
  anticipó que las reglas podrán cambiar según lo pida cada cliente.

#### La jornada tarifaria

- **FR-014**: El sistema MUST dividir la permanencia en **jornadas tarifarias** y aplicar la tarifa
  plena a cada una por separado. Sin esto, una bicicleta guardada tres días pagaría lo mismo que
  una guardada una tarde.
- **FR-015**: En un establecimiento con horario, la jornada MUST ir de la apertura al cierre, y el
  tiempo con el establecimiento cerrado MUST NOT cobrarse.
- **FR-016**: En un establecimiento de 24 horas, la jornada MUST reiniciarse a las 00:00.
- **FR-017**: El sistema MUST calcular correctamente una permanencia que abarque varias jornadas,
  incluidas las que empiezan un día y terminan otro.

- **FR-018**: Cada tarifa MUST declarar el **alcance de su plena**: si topa toda la estadía o si se
  reinicia en cada jornada. El sistema MUST NOT aplicar un alcance por defecto invisible: es la
  diferencia entre que un carro guardado tres días pague una plena o tres, y quien vende el servicio
  tiene que haberlo decidido a conciencia.
- **FR-019**: Cada establecimiento MUST declarar si **cobra las horas en que estuvo cerrado** a los
  vehículos que se quedaron adentro. La regla vale para todos sus tipos de vehículo, porque un
  operario no puede explicar por qué una bicicleta y un carro que pasaron la misma noche se cobran
  con criterios distintos.
- **FR-020**: Cuando el establecimiento cobra las horas cerradas, las jornadas MUST ser contiguas y
  cubrir toda la permanencia sin huecos. Cuando no las cobra, el tiempo entre el cierre y la
  apertura siguiente MUST quedar fuera del cálculo.

#### Versionado

- **FR-021**: Modificar una tarifa MUST conservar la versión anterior junto con el periodo en que
  estuvo vigente, sin sobrescribirla. Es la única forma de que un vehículo que entró ayer se cobre
  con la tarifa que regía al entrar, y de que el historial siga siendo explicable meses después
  (Principio IV).
- **FR-022**: El sistema MUST NOT permitir borrar una tarifa que estuvo vigente. Se cierra su
  vigencia; no se destruye.

#### El calculador

- **FR-023**: El cálculo del valor MUST ser una operación pura sobre la configuración: dados un
  momento de entrada, uno de salida y la tarifa vigente, devuelve el importe. MUST poder ejercitarse
  con momentos inventados, sin que exista ningún vehículo ni ningún movimiento.
- **FR-024**: El calculador MUST entregar, además del importe, el desglose que lo justifica —minutos
  cobrables, jornadas, qué tope se aplicó—, para que el operario pueda explicarle a un cliente por
  qué paga lo que paga.
- **FR-025**: El sistema MUST poder informar el **total parcial** de un vehículo que todavía está
  adentro, con la misma operación y tomando el momento actual como salida.

### Horarios

El horario dejó de ser un dato informativo al aparecer la jornada tarifaria: **el cobro de
bicicletas depende de él**, porque las horas con el establecimiento cerrado no se cobran y la plena
se aplica por jornada. Un horario mal declarado ya no produce sólo un cartel equivocado, produce un
cobro equivocado.


- **FR-026**: El sistema MUST permitir declarar el horario de atención en tres formas: abierto las
  24 horas, un horario igual todos los días, o un horario propio por día de la semana.
- **FR-027**: El sistema MUST admitir horarios que crucen la medianoche.
- **FR-028**: El sistema MUST permitir declarar días de cierre completo.
- **FR-029**: El sistema MUST poder responder, para un momento dado, si el establecimiento está
  dentro de su horario de atención.
- **FR-030**: El horario MUST interpretarse en la zona horaria de Colombia, sin exponer al
  administrador ninguna elección de zona horaria.

### Capacidad

- **FR-031**: El sistema MUST permitir declarar cuántos cupos tiene el establecimiento para cada
  tipo de vehículo.
- **FR-032**: El sistema MUST rechazar capacidades negativas.
- **FR-033**: La capacidad declarada MUST ser un dato de configuración; contar cuántos cupos están
  ocupados pertenece a F3 y no forma parte de esta feature.

### Turnos

- **FR-034**: El sistema MUST permitir al administrador de un establecimiento crear, editar y
  desactivar los turnos de su propio establecimiento.
- **FR-035**: Un turno MUST tener nombre, hora de inicio, hora de fin, los días de la semana en que
  funciona, las personas asignadas y un estado activo o inactivo.
- **FR-036**: El nombre del turno MUST ser texto libre del establecimiento. "Mañana", "Tarde",
  "Turno 1" y "Nocturno" son todos válidos: cada parqueadero nombra sus turnos como los nombra su
  gente.
- **FR-037**: El sistema MUST NOT traer ningún turno precargado ni suponer horarios habituales. Un
  establecimiento nuevo nace sin turnos, y uno solo que cubra todo el día es una configuración tan
  válida como cinco.
- **FR-038**: El sistema MUST admitir turnos que crucen la medianoche. Un turno de 22:00 a 06:00
  empieza un día y termina al siguiente, y a las 02:00 del martes el turno vigente es el que
  arrancó el lunes.
- **FR-039**: El sistema MUST permitir que un día de la semana tenga una configuración de turnos
  distinta de los demás, para el establecimiento que abre diferente los sábados.
- **FR-040**: El sistema MUST permitir asignar varias personas a un mismo turno, y una misma
  persona a varios turnos.
- **FR-041**: El sistema MUST permitir asignar a un turno tanto a operarios como a administradores
  del establecimiento, porque en muchos parqueaderos el administrador atiende la taquilla.
- **FR-042**: El sistema MUST rechazar la asignación de una persona que no pertenece al
  establecimiento.
- **FR-043**: El sistema MUST poder informar, para un momento dado, qué turno está vigente y
  quiénes lo cubren, sin que nadie lo haya abierto.
- **FR-044**: Desactivar un turno MUST NOT borrarlo. Deja de regir y se conserva, porque los
  movimientos que F3 registre bajo ese turno tienen que seguir siendo explicables después
  (Principio IV).
- **FR-045**: Los turnos MUST estar delimitados por establecimiento, como toda la configuración.
- **FR-046**: El sistema MUST rechazar un turno cuya hora de inicio sea igual a la de fin, porque
  no expresa ninguna duración; un turno de veinticuatro horas se declara como tal, no con horas
  iguales.

- **FR-047**: El horario de atención y los turnos MUST ser declaraciones independientes. El
  horario dice cuándo el establecimiento abre al público; el turno, quién lo cubre. El sistema
  MUST NOT derivar uno del otro ni exigir que coincidan.
- **FR-048**: El sistema MUST avisar al administrador cuando queden horas dentro del horario de
  atención sin ningún turno activo que las cubra. Es un aviso, no un impedimento: se puede declarar
  el horario antes de organizar al equipo, y hay que poder guardar una configuración a medias.
- **FR-049**: El sistema MUST permitir turnos que se extiendan fuera del horario de atención, sin
  advertir por ello. Es lo normal: alguien entra media hora antes a abrir y contar la caja.

### Operarios

- **FR-050**: Un administrador de establecimiento MUST poder dar de alta cuentas de operario en su
  propio establecimiento.
- **FR-051**: Un administrador de establecimiento MUST NOT poder crear cuentas de administrador
  general, ni cuentas en otro establecimiento.
- **FR-052**: Un administrador de establecimiento MUST poder bloquear, desbloquear, restablecer la
  contraseña y dar de baja a las cuentas de su propio establecimiento.
- **FR-053**: Un administrador de establecimiento MUST poder nombrar administrador a otra persona
  de su propio establecimiento. Es la misma razón por la que se le delega el alta de operarios: el
  dueño de un local no debería tener que llamar a la plataforma para poner de administrador a su
  encargado de confianza.
- **FR-054**: Nombrar administrador MUST NOT permitir salir del propio establecimiento ni crear
  cuentas de administrador general. La facultad amplía el rol dentro del local, nunca el ámbito.
- **FR-055**: Todo administrador MUST poder ejecutar además cualquier operación de operario. Hay
  parqueaderos donde el administrador atiende la taquilla él mismo, así que los roles no son
  compartimentos separados sino niveles que acumulan: el operario hace lo suyo, el administrador de
  parqueadero hace lo suyo y lo del operario, y el administrador general todo lo anterior. Ninguna
  operación de taquilla puede quedar autorizada únicamente para el rol de operario.
- **FR-056**: FR-055 MUST NOT ampliar el ámbito. Que un administrador pueda registrar una entrada
  no significa que pueda registrarla en otro establecimiento: el rol decide qué operaciones, el
  ámbito decide sobre cuál establecimiento.

### Estado del establecimiento y aislamiento

- **FR-057**: Con el establecimiento suspendido, el sistema MUST impedir toda modificación de la
  configuración, y MUST permitir consultarla. Es coherente con el modo restringido ya definido en
  F1: se puede cerrar lo pendiente, no tomar trabajo nuevo ni cambiar las reglas.
- **FR-058**: Toda entidad de configuración MUST pertenecer a exactamente un establecimiento y
  estar delimitada por su identificador.
- **FR-059**: Toda consulta o escritura de configuración MUST resolver el establecimiento desde la
  sesión, nunca desde un parámetro que el cliente pueda manipular.
- **FR-060**: Una solicitud de configuración de otro establecimiento MUST responder de forma
  indistinguible de una cuyo recurso no existe, y MUST quedar registrada como acceso denegado.
- **FR-061**: El administrador general MUST poder consultar Y modificar la configuración de
  cualquier establecimiento, para poder dar soporte a un cliente que no se maneja bien con el
  sistema.
- **FR-062**: Toda modificación hecha por el administrador general sobre configuración ajena MUST
  quedar registrada con su autor y el momento, y MUST distinguirse de un cambio hecho por el propio
  establecimiento. Sin esa distinción, el administrador del local vería aparecer cambios que él no
  hizo y sin forma de saber quién los hizo.

### Convenios

- **FR-063**: El sistema MUST permitir registrar convenios de descuento asociados a una empresa o a
  placas concretas.
- **FR-064**: Un convenio MUST poder tener fecha de inicio y de vencimiento, y el sistema MUST
  distinguir los vigentes de los que ya no lo están.
- **FR-065**: El sistema MUST poder informar qué descuento corresponde a una placa dada en un
  momento dado, sin aplicarlo a ningún cobro.
- **FR-066**: Los convenios MUST estar delimitados por establecimiento: la misma placa puede tener
  convenio en un local y ninguno en otro.
- **FR-067**: El sistema MUST resolver de forma determinista el caso de una placa alcanzada por más
  de un convenio vigente, sin depender del orden de registro.
- **FR-068**: Un descuento MUST estar acotado entre 0% y 100%.

### Key Entities

- **Tipo de vehículo**: la clase de vehículo que un parqueadero puede recibir. Es catálogo de
  plataforma para que todos los establecimientos hablen el mismo idioma.
- **Modelo de cobro**: la forma de calcular. Hay dos —por minuto con mínima y plena, y por
  intervalos con plena por jornada— y están declarados como datos para que agregar un tercero no
  obligue a tocar los existentes.
- **Tarifa**: los valores concretos de un tipo de vehículo en un establecimiento, bajo el modelo que
  le corresponde, con su periodo de vigencia. Versionada: al cambiar, la anterior se cierra y se
  conserva.
- **Jornada tarifaria**: el tramo sobre el que se aplica la tarifa plena, cuando la tarifa declara
  que su plena es por jornada. Va de la apertura al
  cierre en un establecimiento con horario, y de medianoche a medianoche en uno de 24 horas.
- **Horario de atención**: cuándo abre el establecimiento, por día de la semana.
- **Capacidad**: cuántos cupos declara el establecimiento por tipo de vehículo.
- **Turno**: una franja de trabajo del establecimiento, con nombre propio, horario, días en que
  funciona y estado. Se desactiva, nunca se borra.
- **Asignación a turno**: el vínculo entre una persona del establecimiento y un turno. Una persona
  puede cubrir varios turnos y un turno puede tener varias personas.
- **Convenio**: un acuerdo de descuento de un establecimiento, con su vigencia y las placas o la
  empresa a la que alcanza.
- **Placa en convenio**: la matrícula concreta que un convenio cubre.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador que recibe su establecimiento recién creado puede dejarlo listo para
  operar —tarifa, horario y capacidad de al menos un tipo de vehículo— en menos de 10 minutos, sin
  ayuda de nadie de la plataforma.
- **SC-002**: El 100% de los intentos de leer o modificar la configuración de otro establecimiento
  son denegados, y el 100% queda registrado.
- **SC-003**: Cambiar una tarifa conserva el 100% de las versiones anteriores con su periodo de
  vigencia; ninguna se pierde ni se sobrescribe.
- **SC-004**: El sistema responde correctamente si el establecimiento está abierto en cualquier
  momento consultado, incluidos los horarios que cruzan la medianoche.
- **SC-005**: Un establecimiento suspendido rechaza el 100% de las modificaciones de configuración
  y permite el 100% de las consultas.
- **SC-006**: Un administrador de establecimiento puede incorporar a un operario nuevo y verlo
  entrar al sistema en menos de 3 minutos.
- **SC-007**: Ninguna regla de cobro queda escrita en el código: dos establecimientos con tarifas
  distintas conviven sin ninguna modificación del sistema.
- **SC-011**: El calculador devuelve el importe correcto en los casos límite del modelo por minuto
  —por debajo de la mínima, entre ambos topes, y por encima de la plena— y del modelo por
  intervalos —fracción de intervalo, plena alcanzada, y permanencia repartida en varias jornadas—.
- **SC-012**: Dos establecimientos con decisiones opuestas sobre el alcance de la plena y sobre el
  cobro de horas cerradas producen importes distintos para la misma permanencia, sin ninguna
  modificación del sistema.
- **SC-013**: Una bicicleta que atraviesa una noche con el establecimiento cerrado paga las
  jornadas que estuvo abierto y nada por las horas cerradas.
- **SC-014**: Todo importe calculado viene acompañado del desglose que lo justifica, de modo que el
  operario pueda explicarle a un cliente por qué paga esa cifra.
- **SC-008**: Un administrador puede dejar organizada la semana de su equipo —los turnos y quién
  cubre cada uno— en menos de 5 minutos, y el sistema responde correctamente qué turno rige en
  cualquier momento consultado, incluidos los nocturnos que cruzan la medianoche.
- **SC-009**: Dos establecimientos con organizaciones de turno completamente distintas —uno con un
  solo turno de todo el día, otro con tres y días especiales— conviven sin ninguna modificación del
  sistema.
- **SC-010**: Toda la configuración de F2 se puede definir y verificar sin registrar un solo
  movimiento de vehículo.

## Assumptions

- Los importes se manejan en pesos colombianos sin decimales, por ser la moneda del negocio.
- La zona horaria es la de Colombia y no se ofrece elegirla, porque todos los establecimientos
  previstos operan en el país.
- El catálogo de tipos de vehículo lo define la plataforma. Un establecimiento elige cuáles recibe,
  pero no inventa nombres propios: si cada local escribiera el suyo, los reportes comparativos
  entre establecimientos dejarían de ser posibles.
- Los convenios se identifican por placa. Un convenio "por empresa" es, en la práctica, un conjunto
  de placas agrupadas bajo un nombre.
- **No hay periodo de gracia inicial gratuito.** Es frecuente en Colombia dar diez o quince
  minutos libres antes de empezar a cobrar, pero no se pidió y no se agrega por cuenta propia: sería
  alcance inventado. Si hace falta, encaja como un parámetro más de la regla de fracción y conviene
  decidirlo antes de `/speckit-plan`, porque después toca el motor de cobro de F3.
- La configuración no se versiona entera: sólo las tarifas, que son las que un movimiento pasado
  necesita poder reconstruir. Cambiar un horario o una capacidad no requiere conservar el valor
  anterior.

## Dependencies

- F1 completa: autenticación, roles, aislamiento por establecimiento, estados y ciclo de vida de
  cuentas.
- Ninguna dependencia con F3 en adelante. F2 se entrega y se verifica sola.
