# Especificación de Requisitos de Software (SRS) — Simplificado

**Proyecto:** Parquivo — Sistema de gestión para parqueaderos
**Asignatura:** Fundamentos de Ingeniería de Software (12946) · 2026-2
**Autor del sistema:** Cristian Quevedo

---

## 1. Introducción

### 1.1 Propósito

Este documento especifica qué debe hacer Parquivo. Está dirigido al equipo de
desarrollo, al docente de la asignatura y a cualquier persona que necesite
entender el alcance del sistema sin leer el código.

### 1.2 Alcance

Parquivo administra parqueaderos. Una sola instalación atiende a varios
establecimientos simultáneamente, y cada uno mantiene sus tarifas, horarios,
turnos, convenios e historial completamente separados de los demás.

**Dentro del alcance:** registro de entradas y salidas de vehículos y
bicicletas, cálculo de cobros, tarifas versionadas, convenios, horarios,
capacidad, turnos, historial inmutable, correcciones, reportes y gestión de
cuentas por establecimiento.

**Fuera del alcance:** pasarela de pagos en línea, facturación electrónica,
reconocimiento automático de placas por cámara y aplicación móvil nativa.

### 1.3 Definiciones

| Término | Significado |
|---|---|
| Establecimiento | Un parqueadero concreto. Es la frontera de aislamiento de datos |
| Movimiento | El paso completo de un vehículo: su entrada y su salida |
| Ficha | El tique que identifica a una bicicleta, que no tiene placa |
| Convenio | Acuerdo que otorga un descuento a ciertos vehículos |
| Jornada tarifaria | Tramo de tiempo sobre el que se aplica el tope de tarifa plena |
| Cortesía | Salida autorizada sin cobro, con motivo registrado |
| Sesión de turno | Cada vez que alguien abre y cierra su turno en la taquilla |

---

## 2. Descripción general

### 2.1 Perspectiva del producto

Aplicación web cliente-servidor con persistencia en base de datos relacional.
El aislamiento entre establecimientos se impone en la propia base de datos
mediante seguridad a nivel de fila, no en el código de la aplicación.

### 2.2 Funciones principales

| Módulo | Responsable | Qué cubre |
|---|---|---|
| **M1** · Plataforma y gestión de parqueaderos | Administrador general | Ver sección 3.1 |
| **M2** · Configuración del establecimiento | Administrador de parqueadero | Ver sección 3.2 |
| **M3** · Convenios y descuentos | Administrador de parqueadero | Ver sección 3.3 |
| **M4** · Taquilla — vehículos | Operario | Ver sección 3.4 |
| **M5** · Taquilla — bicicletas y fichas | Operario | Ver sección 3.5 |

### 2.3 Usuarios del sistema

| Rol | Quién es | Qué puede hacer |
|---|---|---|
| Administrador general | Quien opera la plataforma | Crear establecimientos y cuentas, suspender servicios, ver el panel global |
| Administrador de parqueadero | El dueño o encargado de un establecimiento | Configurar tarifas, horarios, turnos y convenios; gestionar su equipo; ver reportes. Además puede atender en taquilla |
| Operario | Quien atiende la caseta | Registrar entradas y salidas, cobrar, abrir y cerrar su turno, y consultar únicamente lo suyo |

### 2.4 Restricciones

- Los importes se expresan en pesos colombianos sin decimales.
- Las fechas y horas se interpretan en la zona horaria de Colombia.
- El sistema debe operar sin conexión a servicios externos durante la atención
  en taquilla.
- Ningún valor de negocio —tarifas, horarios, capacidades— puede estar escrito
  en el código.

### 2.5 Supuestos y dependencias

- Cada establecimiento declara su configuración antes de poder cobrar.
- La impresión de tiques depende de una impresora térmica local; su ausencia
  no debe impedir la operación.

---

## 3. Requisitos específicos

Cada módulo agrupa sus historias de usuario y sus requisitos funcionales. La
numeración `FR-xxx` empieza de nuevo en cada módulo.


### 3.1 M1 · Plataforma y gestión de parqueaderos

**Actor principal:** Administrador general  

#### Historias de usuario (5)

**HU-1.1 · Dar de alta un parqueadero y su administrador** — prioridad P1

El administrador general registra un nuevo establecimiento en la plataforma, le asigna una
persona responsable y esa persona puede entrar a administrarlo.

**HU-1.2 · Acceso aislado por establecimiento** — prioridad P1

Cualquier usuario asociado a un parqueadero opera únicamente sobre los datos de ese
establecimiento, y no existe camino —ni por navegación, ni por manipulación de
identificadores, ni por búsqueda— que le permita alcanzar los datos de otro.

**HU-1.3 · Suspender y reactivar un establecimiento** — prioridad P2

El administrador general suspende un parqueadero cuya cuenta dejó de estar al día. El
establecimiento entra en modo restringido —puede cerrar lo que tiene abierto pero no tomar
trabajo nuevo— y vuelve a la normalidad cuando la situación se regulariza.

**HU-1.4 · Gestionar el acceso y el ciclo de vida de las cuentas** — prioridad P2

El administrador general administra las personas que tienen acceso a la plataforma: las
crea, les restablece la contraseña, las bloquea cuando corresponde, las da de baja y
anonimiza sus datos personales cuando su titular lo exige. El sistema, por su parte,
defiende esas cuentas de los intentos de adivinación de contraseña.

**HU-1.5 · Panel global del estado de la plataforma** — prioridad P3

El administrador general ve de un vistazo cuántos establecimientos hay activos, cuántos
suspendidos y cuántas cuentas existen.

#### Requisitos funcionales (53)

- **FR-001** — El sistema MUST permitir a una persona autenticarse con credenciales propias antes de acceder a cualquier funcionalidad.
- **FR-002** — El sistema MUST reconocer exactamente tres roles: administrador general de la plataforma, administrador de parqueadero y operario de taquilla.
- **FR-003** — El sistema MUST evaluar los permisos en cada operación del lado del servidor. Ocultar una opción en la interfaz NUNCA constituye control de acceso.
- **FR-004** — El sistema MUST terminar el acceso efectivo de una sesión en curso cuando la cuenta asociada es bloqueada o su establecimiento suspendido, sin esperar a que la sesión expire por tiempo.
- **FR-005** — El sistema MUST registrar cada intento de acceso denegado por violación de ámbito, con la cuenta, el recurso solicitado y el momento.
- **FR-006** — El sistema MUST aplicar una demora creciente entre intentos de inicio de sesión fallidos consecutivos sobre la misma identidad. Los primeros 3 intentos no tienen penalización; a partir del cuarto la espera se duplica en cada intento (2, 4, 8, 16 segundos) **con un tope de 30 segundos**. La demora se cuenta por correo intentado, no por cuenta existente, para que el mecanismo no revele qué correos están registrados.
- **FR-007** — Esa demora MUST NOT derivar nunca en un bloqueo permanente de la cuenta. El acceso MUST restablecerse por el mero transcurso del tiempo, sin intervención del administrador general. El bloqueo administrativo de cuentas (FR-036) es un mecanismo distinto y deliberado.
- **FR-008** — El sistema MUST registrar cada intento de inicio de sesión fallido con la cuenta afectada, el origen de la petición y el momento.
- **FR-009** — El sistema MUST resolver el establecimiento activo de un usuario a partir de su sesión autenticada, y NUNCA a partir de un valor que el cliente pueda enviar o modificar.
- **FR-010** — Toda consulta de datos operativos MUST estar delimitada por el establecimiento resuelto; una consulta sin ámbito resuelto MUST fallar en lugar de devolver todos los registros.
- **FR-011** — El sistema MUST responder a las solicitudes de recursos de otro establecimiento de forma indistinguible de un recurso inexistente, sin revelar su existencia.
- **FR-012** — Todo acceso a datos operativos MUST ocurrir dentro de una transacción que fije el ámbito antes de cualquier consulta. Una consulta ejecutada fuera de ese marco MUST ser tratada como defecto, no como caso admisible: es la condición de la que depende que FR-010 se cumpla de verdad y no sólo por convención.
- **FR-013** — Únicamente el rol de administrador general MUST poder operar sin ámbito de establecimiento, y ese privilegio MUST ser explícito en cada punto donde se ejerce.
- **FR-014** — Un administrador general MUST poder registrar un establecimiento con sus datos identificatorios básicos.
- **FR-015** — El sistema MUST NOT exponer ningún registro público de establecimientos. El alta es exclusivamente manual, ejecutada por un administrador general autenticado.
- **FR-016** — El sistema MUST asignar a cada establecimiento, en el momento del alta, un código interno único generado por la plataforma. Ese código MUST ser inmutable durante toda la vida del establecimiento y MUST ser el identificador por el que se lo referencia internamente.
- **FR-017** — El sistema MUST NOT depender de ningún identificador externo al negocio para garantizar unicidad. En consecuencia, el sistema NO puede detectar por sí mismo que un mismo parqueadero real sea dado de alta dos veces; evitar esa duplicación es responsabilidad del administrador general al momento del alta.
- **FR-018** — Un administrador general MUST poder editar los datos de cualquier establecimiento.
- **FR-019** — Un administrador general MUST poder asignar y retirar personas administradoras de un establecimiento.
- **FR-020** — Una cuenta MUST estar asignada a un solo establecimiento. El sistema MUST rechazar la asignación de una cuenta ya vinculada a otro establecimiento.
- **FR-021** — Un administrador general MUST poder consultar el listado completo de establecimientos con su estado actual y sus personas responsables.
- **FR-022** — Un administrador de parqueadero MUST poder consultar y editar los datos de su propio establecimiento, y de ningún otro.
- **FR-023** — Cada establecimiento MUST tener en todo momento exactamente un estado, entre cuatro valores mutuamente excluyentes: activo, pendiente, suspendido y dado de baja. No existe ninguna otra marca de estado o archivado en paralelo.
- **FR-024** — El estado `pendiente` MUST comportarse, a efectos de acceso, de forma idéntica al estado `activo`. Existe para representar una cuenta con pago vencido que todavía no se decidió suspender, de modo que la decisión comercial sea visible antes de tener consecuencias operativas. Todos los cambios de estado son manuales, ejecutados por el administrador general: el sistema NUNCA cambia el estado de un establecimiento por su cuenta.
- **FR-025** — Un administrador general MUST poder suspender y reactivar un establecimiento.
- **FR-026** — Todo cambio de estado de un establecimiento MUST registrar quién lo ejecutó, cuándo y con qué motivo. El registro MUST conservarse aunque el establecimiento cambie de estado después.
- **FR-027** — Un establecimiento suspendido MUST entrar en modo restringido, conservando la totalidad de su información. El modo restringido MUST permitir cerrar los movimientos que ya estén abiertos y cobrarlos, y MUST impedir el registro de movimientos nuevos.
- **FR-028** — El modo restringido MUST impedir además el acceso a la configuración del establecimiento y a los reportes, limitando al operario a cerrar lo pendiente.
- **FR-029** — La reactivación de un establecimiento MUST restituir el acceso pleno de sus usuarios sin pérdida ni alteración de información.
- **FR-030** — El sistema MUST informar a un usuario cuyo acceso fue restringido por suspensión cuál es el motivo y qué puede seguir haciendo, sin exponer datos comerciales de la cuenta.
- **FR-031** — Un administrador general MUST poder crear cuentas de usuario y asignarles un rol.
- **FR-032** — Al crear una cuenta, el administrador general MUST establecer una contraseña temporal inicial. La entrega de esa contraseña a su titular ocurre fuera del sistema.
- **FR-033** — El sistema MUST exigir el cambio de contraseña en el primer inicio de sesión de una cuenta, antes de conceder acceso a cualquier otra funcionalidad.
- **FR-034** — Un administrador general MUST poder restablecer la contraseña de cualquier cuenta a una nueva temporal, lo que MUST volver a exigir el cambio en el siguiente inicio de sesión.
- **FR-035** — El sistema MUST NOT ofrecer recuperación de contraseña autogestionada por el propio usuario en esta feature. La recuperación pasa siempre por el administrador general.
- **FR-036** — Un administrador general MUST poder bloquear y desbloquear cuentas.
- **FR-037** — Un administrador general MUST poder dar de baja cuentas.
- **FR-038** — El sistema MUST advertir y exigir confirmación explícita antes de bloquear o dar de baja a la única persona administradora de un establecimiento.
- **FR-039** — El bloqueo de una cuenta y la suspensión de un establecimiento MUST ser condiciones independientes; levantar una no levanta la otra.
- **FR-040** — La baja de un establecimiento MUST ser lógica: consiste en llevarlo al estado "dado de baja". Deja de estar operativo y de aparecer en los listados activos, pero su información se conserva íntegra.
- **FR-041** — El estado "dado de baja" MUST comportarse como terminal para la operación: sus usuarios pierden todo acceso, y salir de él MUST requerir una reactivación explícita del administrador general hacia el estado activo.
- **FR-042** — El sistema MUST impedir la destrucción física de establecimientos y de las cuentas referenciadas por registros históricos. La vía para atender una solicitud de supresión de datos personales es la anonimización (FR-043), no el borrado.
- **FR-043** — El sistema MUST identificar explícitamente qué campos de una cuenta constituyen datos personales de su titular, de modo que puedan tratarse como conjunto.
- **FR-044** — Un administrador general MUST poder anonimizar una cuenta: sus datos personales se sustituyen por un marcador que no permite reconstruir al titular, mientras el registro y todas sus referencias históricas permanecen intactos.
- **FR-045** — La anonimización MUST ser irreversible y MUST NOT romper ninguna referencia existente. Un movimiento histórico atribuido a una cuenta anonimizada MUST seguir siendo atribuible a ella como entidad, aunque su titular ya no sea identificable.
- **FR-046** — Una cuenta anonimizada MUST NOT poder autenticarse ni recuperar el acceso.
- **FR-047** — Los registros de intentos de inicio de sesión y de accesos denegados MUST tener un período de retención definido, transcurrido el cual se eliminan automáticamente. El valor inicial es **12 meses**: suficiente para investigar un incidente y acotado para no conservar datos personales indefinidamente. Es configuración de plataforma, no de establecimiento.
- **FR-048** — La especificación MUST declarar quién responde por cada categoría de datos personales. En F1: **la plataforma responde por los datos de las cuentas de usuario**, porque es quien decide su finalidad y su tratamiento. Los datos de los clientes finales de cada parqueadero —que aparecen a partir de F3— pertenecen a una categoría distinta, donde el establecimiento responde y la plataforma sólo trata por encargo. La distinción MUST resolverse antes de que exista el primer dato de cliente final.
- **FR-049** — Un administrador general MUST poder consultar el número de establecimientos en cada uno de los cuatro estados —activo, pendiente, suspendido y dado de baja— y el total de cuentas. Ningún estado queda fuera del recuento: un establecimiento siempre suma exactamente a un contador, de modo que la suma de los cuatro iguala el total registrado.
- **FR-050** — El total de cuentas MUST excluir las cuentas anonimizadas, que ya no representan a ninguna persona, e informarlas por separado si se consultan.
- **FR-051** — El código del establecimiento MUST derivarse de su nombre y ser legible: "Parqueadero Centro Histórico" da `PCH`. Los códigos aleatorios anteriores cumplían la unicidad pero no se podían leer, recordar ni comparar de un vistazo, que es para lo que sirve un identificador que se muestra en pantalla.
- **FR-052** — Cada cuenta MUST tener un código legible formado por la sigla de su establecimiento y un correlativo propio de ese establecimiento: `PCH-001`, `PCH-002`. Una cuenta sin establecimiento se numera bajo la sigla de la plataforma. El objetivo declarado por el propietario es distinguir de un vistazo a los empleados de un local de los de otro, sin abrir ninguna ficha.
- **FR-053** — El código legible MUST ser un identificador de presentación, no una llave: la clave primaria y las referencias entre tablas siguen siendo el identificador interno, de modo que el código nunca se use como referencia.

### 3.2 M2 · Configuración del establecimiento

**Actor principal:** Administrador de parqueadero  

#### Historias de usuario (5)

**HU-2.1 · Definir cuánto cobra el parqueadero** — prioridad P1

El administrador del establecimiento define, para cada tipo de vehículo que recibe, cuánto
cuesta estacionar. Para carros y motos declara tres valores —tarifa mínima, valor por minuto
y tarifa plena—; para bicicletas, la duración del intervalo, cuánto vale cada intervalo y el
máximo por jornada. Después puede comprobar el cálculo con tiempos de ejemplo antes de que
llegue el primer cliente.

**HU-2.2 · Declarar cuándo abre y cuánto cabe** — prioridad P1

El administrador declara el horario de atención de su parqueadero —abierto las 24 horas, un
horario fijo, o uno distinto por día de la semana— y cuántos cupos tiene para cada tipo de
vehículo.

**HU-2.3 · Armar el equipo de la taquilla** — prioridad P2

El administrador del establecimiento da de alta a sus operarios de taquilla, les entrega una
contraseña temporal, y puede bloquearlos o darlos de baja cuando alguien deja de trabajar
ahí.

**HU-2.4 · Organizar quién trabaja y cuándo** — prioridad P2

El administrador del establecimiento crea los turnos de su parqueadero —con su nombre, su
horario y los días en que funcionan— y asigna a cada uno las personas que lo cubren. Puede
incluirse a sí mismo, porque en muchos parqueaderos el dueño atiende la taquilla.

**HU-2.5 · Aplicar convenios a clientes habituales** — prioridad P3

El administrador registra convenios: un descuento para los vehículos de una empresa vecina,
o para una placa concreta que estaciona todos los días.

#### Requisitos funcionales (68)

- **FR-001** — El sistema MUST ofrecer los dos modelos de cobro y MUST asociar cada tipo de vehículo a uno de ellos.
- **FR-002** — El modelo por minuto MUST configurarse con tres valores por tipo de vehículo: tarifa mínima, valor por minuto y tarifa plena.
- **FR-003** — El modelo por intervalos MUST configurarse con tres valores: duración del intervalo en minutos, valor del intervalo y tarifa plena de la jornada.
- **FR-004** — En el modelo por minuto, el sistema MUST cobrar la tarifa mínima cuando el valor calculado quede por debajo de ella, y la tarifa plena cuando lo supere.
- **FR-005** — En el modelo por intervalos, cualquier fracción de intervalo MUST cobrar el intervalo completo. Con intervalos de 30 minutos, 31 minutos cobran dos.
- **FR-006** — Cada tipo de vehículo MUST poder tener sus propios valores. Un mismo establecimiento cobra distinto por un automóvil que por una motocicleta.
- **FR-007** — El sistema MUST rechazar una tarifa mínima mayor que la tarifa plena, porque ninguna estadía podría cobrarse.
- **FR-008** — El sistema MUST rechazar una duración de intervalo menor o igual a cero.
- **FR-009** — El sistema MUST calcular el tiempo de permanencia por su cuenta a partir de los momentos de entrada y de salida. Quien atiende la taquilla MUST NOT tener que calcular nada.
- **FR-010** — Los importes MUST expresarse en pesos colombianos sin decimales, que es la unidad en que se cobra en el país.
- **FR-011** — El sistema MUST NOT traer ninguna tarifa precargada ni suponer valores habituales. Un establecimiento nuevo nace sin tarifas y debe declararlas.
- **FR-012** — El sistema MUST permitir que un establecimiento tenga tarifas para unos tipos de vehículo y no para otros, e informar cuáles le faltan antes de operar.
- **FR-013** — Los dos modelos MUST estar declarados como datos y no como código, de modo que agregar un tercer modelo en el futuro no obligue a reescribir los existentes. El propietario ya anticipó que las reglas podrán cambiar según lo pida cada cliente.
- **FR-014** — El sistema MUST dividir la permanencia en **jornadas tarifarias** y aplicar la tarifa plena a cada una por separado. Sin esto, una bicicleta guardada tres días pagaría lo mismo que una guardada una tarde.
- **FR-015** — En un establecimiento con horario, la jornada MUST ir de la apertura al cierre, y el tiempo con el establecimiento cerrado MUST NOT cobrarse.
- **FR-016** — En un establecimiento de 24 horas, la jornada MUST reiniciarse a las 00:00.
- **FR-017** — El sistema MUST calcular correctamente una permanencia que abarque varias jornadas, incluidas las que empiezan un día y terminan otro.
- **FR-018** — Cada tarifa MUST declarar el **alcance de su plena**: si topa toda la estadía o si se reinicia en cada jornada. El sistema MUST NOT aplicar un alcance por defecto invisible: es la diferencia entre que un carro guardado tres días pague una plena o tres, y quien vende el servicio tiene que haberlo decidido a conciencia.
- **FR-019** — Cada establecimiento MUST declarar si **cobra las horas en que estuvo cerrado** a los vehículos que se quedaron adentro. La regla vale para todos sus tipos de vehículo, porque un operario no puede explicar por qué una bicicleta y un carro que pasaron la misma noche se cobran con criterios distintos.
- **FR-020** — Cuando el establecimiento cobra las horas cerradas, las jornadas MUST ser contiguas y cubrir toda la permanencia sin huecos. Cuando no las cobra, el tiempo entre el cierre y la apertura siguiente MUST quedar fuera del cálculo.
- **FR-021** — Modificar una tarifa MUST conservar la versión anterior junto con el periodo en que estuvo vigente, sin sobrescribirla. Es la única forma de que un vehículo que entró ayer se cobre con la tarifa que regía al entrar, y de que el historial siga siendo explicable meses después (Principio IV).
- **FR-022** — El sistema MUST NOT permitir borrar una tarifa que estuvo vigente. Se cierra su vigencia; no se destruye.
- **FR-023** — El cálculo del valor MUST ser una operación pura sobre la configuración: dados un momento de entrada, uno de salida y la tarifa vigente, devuelve el importe. MUST poder ejercitarse con momentos inventados, sin que exista ningún vehículo ni ningún movimiento.
- **FR-024** — El calculador MUST entregar, además del importe, el desglose que lo justifica —minutos cobrables, jornadas, qué tope se aplicó—, para que el operario pueda explicarle a un cliente por qué paga lo que paga.
- **FR-025** — El sistema MUST poder informar el **total parcial** de un vehículo que todavía está adentro, con la misma operación y tomando el momento actual como salida.
- **FR-026** — El sistema MUST permitir declarar el horario de atención en tres formas: abierto las 24 horas, un horario igual todos los días, o un horario propio por día de la semana.
- **FR-027** — El sistema MUST admitir horarios que crucen la medianoche.
- **FR-028** — El sistema MUST permitir declarar días de cierre completo.
- **FR-029** — El sistema MUST poder responder, para un momento dado, si el establecimiento está dentro de su horario de atención.
- **FR-030** — El horario MUST interpretarse en la zona horaria de Colombia, sin exponer al administrador ninguna elección de zona horaria.
- **FR-031** — El sistema MUST permitir declarar cuántos cupos tiene el establecimiento para cada tipo de vehículo.
- **FR-032** — El sistema MUST rechazar capacidades negativas.
- **FR-033** — La capacidad declarada MUST ser un dato de configuración; contar cuántos cupos están ocupados pertenece a F3 y no forma parte de esta feature.
- **FR-034** — El sistema MUST permitir al administrador de un establecimiento crear, editar y desactivar los turnos de su propio establecimiento.
- **FR-035** — Un turno MUST tener nombre, hora de inicio, hora de fin, los días de la semana en que funciona, las personas asignadas y un estado activo o inactivo.
- **FR-036** — El nombre del turno MUST ser texto libre del establecimiento. "Mañana", "Tarde", "Turno 1" y "Nocturno" son todos válidos: cada parqueadero nombra sus turnos como los nombra su gente.
- **FR-037** — El sistema MUST NOT traer ningún turno precargado ni suponer horarios habituales. Un establecimiento nuevo nace sin turnos, y uno solo que cubra todo el día es una configuración tan válida como cinco.
- **FR-038** — El sistema MUST admitir turnos que crucen la medianoche. Un turno de 22:00 a 06:00 empieza un día y termina al siguiente, y a las 02:00 del martes el turno vigente es el que arrancó el lunes.
- **FR-039** — El sistema MUST permitir que un día de la semana tenga una configuración de turnos distinta de los demás, para el establecimiento que abre diferente los sábados.
- **FR-040** — El sistema MUST permitir asignar varias personas a un mismo turno, y una misma persona a varios turnos.
- **FR-041** — El sistema MUST permitir asignar a un turno tanto a operarios como a administradores del establecimiento, porque en muchos parqueaderos el administrador atiende la taquilla.
- **FR-042** — El sistema MUST rechazar la asignación de una persona que no pertenece al establecimiento.
- **FR-043** — El sistema MUST poder informar, para un momento dado, qué turno está vigente y quiénes lo cubren, sin que nadie lo haya abierto.
- **FR-044** — Desactivar un turno MUST NOT borrarlo. Deja de regir y se conserva, porque los movimientos que F3 registre bajo ese turno tienen que seguir siendo explicables después (Principio IV).
- **FR-045** — Los turnos MUST estar delimitados por establecimiento, como toda la configuración.
- **FR-046** — El sistema MUST rechazar un turno cuya hora de inicio sea igual a la de fin, porque no expresa ninguna duración; un turno de veinticuatro horas se declara como tal, no con horas iguales.
- **FR-047** — El horario de atención y los turnos MUST ser declaraciones independientes. El horario dice cuándo el establecimiento abre al público; el turno, quién lo cubre. El sistema MUST NOT derivar uno del otro ni exigir que coincidan.
- **FR-048** — El sistema MUST avisar al administrador cuando queden horas dentro del horario de atención sin ningún turno activo que las cubra. Es un aviso, no un impedimento: se puede declarar el horario antes de organizar al equipo, y hay que poder guardar una configuración a medias.
- **FR-049** — El sistema MUST permitir turnos que se extiendan fuera del horario de atención, sin advertir por ello. Es lo normal: alguien entra media hora antes a abrir y contar la caja.
- **FR-050** — Un administrador de establecimiento MUST poder dar de alta cuentas de operario en su propio establecimiento.
- **FR-051** — Un administrador de establecimiento MUST NOT poder crear cuentas de administrador general, ni cuentas en otro establecimiento.
- **FR-052** — Un administrador de establecimiento MUST poder bloquear, desbloquear, restablecer la contraseña y dar de baja a las cuentas de su propio establecimiento.
- **FR-053** — Un administrador de establecimiento MUST poder nombrar administrador a otra persona de su propio establecimiento. Es la misma razón por la que se le delega el alta de operarios: el dueño de un local no debería tener que llamar a la plataforma para poner de administrador a su encargado de confianza.
- **FR-054** — Nombrar administrador MUST NOT permitir salir del propio establecimiento ni crear cuentas de administrador general. La facultad amplía el rol dentro del local, nunca el ámbito.
- **FR-055** — Todo administrador MUST poder ejecutar además cualquier operación de operario. Hay parqueaderos donde el administrador atiende la taquilla él mismo, así que los roles no son compartimentos separados sino niveles que acumulan: el operario hace lo suyo, el administrador de parqueadero hace lo suyo y lo del operario, y el administrador general todo lo anterior. Ninguna operación de taquilla puede quedar autorizada únicamente para el rol de operario.
- **FR-056** — FR-055 MUST NOT ampliar el ámbito. Que un administrador pueda registrar una entrada no significa que pueda registrarla en otro establecimiento: el rol decide qué operaciones, el ámbito decide sobre cuál establecimiento.
- **FR-057** — Con el establecimiento suspendido, el sistema MUST impedir toda modificación de la configuración, y MUST permitir consultarla. Es coherente con el modo restringido ya definido en F1: se puede cerrar lo pendiente, no tomar trabajo nuevo ni cambiar las reglas.
- **FR-058** — Toda entidad de configuración MUST pertenecer a exactamente un establecimiento y estar delimitada por su identificador.
- **FR-059** — Toda consulta o escritura de configuración MUST resolver el establecimiento desde la sesión, nunca desde un parámetro que el cliente pueda manipular.
- **FR-060** — Una solicitud de configuración de otro establecimiento MUST responder de forma indistinguible de una cuyo recurso no existe, y MUST quedar registrada como acceso denegado.
- **FR-061** — El administrador general MUST poder consultar Y modificar la configuración de cualquier establecimiento, para poder dar soporte a un cliente que no se maneja bien con el sistema.
- **FR-062** — Toda modificación hecha por el administrador general sobre configuración ajena MUST quedar registrada con su autor y el momento, y MUST distinguirse de un cambio hecho por el propio establecimiento. Sin esa distinción, el administrador del local vería aparecer cambios que él no hizo y sin forma de saber quién los hizo.
- **FR-063** — El sistema MUST permitir registrar convenios de descuento asociados a una empresa o a placas concretas.
- **FR-064** — Un convenio MUST poder tener fecha de inicio y de vencimiento, y el sistema MUST distinguir los vigentes de los que ya no lo están.
- **FR-065** — El sistema MUST poder informar qué descuento corresponde a una placa dada en un momento dado, sin aplicarlo a ningún cobro.
- **FR-066** — Los convenios MUST estar delimitados por establecimiento: la misma placa puede tener convenio en un local y ninguno en otro.
- **FR-067** — El sistema MUST resolver de forma determinista el caso de una placa alcanzada por más de un convenio vigente, sin depender del orden de registro.
- **FR-068** — Un descuento MUST estar acotado entre 0% y 100%.

### 3.3 M3 · Convenios y descuentos

**Actor principal:** Administrador de parqueadero  

#### Historias de usuario (2)

**HU-3.1 · Declarar los convenios que el establecimiento realmente tiene** — prioridad P1

La administradora de un parqueadero tiene cuatro acuerdos distintos y hoy sólo puede
expresar uno. Necesita declarar los cuatro sin que nadie toque el código: el fruver de al
lado que sella el ticket a cambio de una hora, la carnicería que hace lo mismo con media
hora, la clienta frecuente a la que se le cobra la mitad, y el vecino con mensualidad al que
no se le cobra la salida. Cada convenio se declara respondiendo dos preguntas —cuándo aplica
y qué hace— más los límites que quiera ponerle.

**HU-3.2 · Comprobar el efecto antes de que llegue el cliente** — prioridad P2

La administradora acaba de declarar un convenio y quiere saber qué va a cobrar de verdad, no
confiar en que entendió bien. Escribe una permanencia de ejemplo, elige qué convenios
aplicarían, y ve el total con el desglose de cómo se llegó a él.

#### Requisitos funcionales (20)

- **FR-001** — El sistema MUST permitir declarar, para cada convenio, exactamente una forma de activación entre dos: por sello (alguien lo confirma en el momento de la salida) y por placa (la placa figura en la lista del convenio). No existe una activación que aplique a todos los vehículos: ningún acuerdo real la necesita, y el Principio V prohíbe construirla sin una especificación que la respalde.
- **FR-002** — El sistema MUST permitir declarar, para cada convenio, exactamente un beneficio entre: minutos gratis, porcentaje sobre el total, tarifa fija, o sin cobro.
- **FR-003** — El sistema MUST exigir los parámetros que el beneficio declarado necesita y MUST rechazar los que no le corresponden, de modo que no pueda existir un convenio con un beneficio de porcentaje y un valor en minutos.
- **FR-004** — El sistema MUST permitir declarar un tope en pesos por convenio, que limita cuánto puede descontar ese convenio en una sola salida.
- **FR-005** — El sistema MUST conservar la vigencia por fechas y el estado activo que ya existen, y MUST evaluar ambos en el instante de la salida.
- **FR-006** — El sistema MUST convertir los convenios que ya existen a activación por placa con beneficio de porcentaje, conservando su valor, sus placas y su vigencia, sin que ningún administrador tenga que volver a declararlos.
- **FR-007** — El sistema MUST restar los minutos gratis del tiempo cobrable ANTES de aplicar la tarifa, no del importe resultante, porque el valor de un minuto depende de la tarifa, de la tarifa plena y de la tarifa mínima, y por lo tanto una hora gratis no equivale a un monto fijo.
- **FR-008** — El sistema MUST aplicar los beneficios en un orden único y declarado: primero los de tiempo, luego la tarifa, luego los de porcentaje, luego los topes.
- **FR-009** — El sistema MUST tratar la tarifa fija y el sin cobro como determinantes del total, ignorando el resto de beneficios, y MUST dejar constancia de ello en el desglose.
- **FR-010** — El sistema MUST garantizar que el total nunca sea negativo.
- **FR-011** — La regla de redondeo MUST ser configuración declarada por establecimiento, no una constante del sistema, porque el Principio II la nombra explícitamente entre lo que cada parqueadero decide. Las opciones MUST ser exactamente tres: sin redondeo más allá del peso, a la cincuentena y a la centena. Las dos últimas existen porque en Colombia apenas circulan monedas por debajo de cincuenta pesos, y un parqueadero no puede devolver un sencillo que no tiene.
- **FR-012** — El sistema MUST producir, junto al total, un desglose que nombre el importe base, cada beneficio aplicado, cuánto restó cada uno y si alguno fue recortado por su tope.
- **FR-013** — El sistema MUST producir el mismo total para la misma permanencia, la misma tarifa y los mismos convenios, cuantas veces se calcule y en cualquier momento futuro.
- **FR-014** — El cálculo MUST funcionar sin acceso a ningún servicio externo.
- **FR-015** — Los administradores MUST poder comprobar el efecto de sus convenios sobre una permanencia de ejemplo, eligiendo cuáles aplicarían, y ver el desglose completo.
- **FR-016** — Un convenio MUST pertenecer a exactamente un establecimiento, y ningún administrador de establecimiento MUST poder ver, aplicar ni modificar los convenios de otro.
- **FR-017** — Una placa MUST poder pertenecer a lo sumo a un convenio por establecimiento, para que la respuesta a "qué descuento le corresponde a esta placa" sea única.
- **FR-018** — El sistema MUST definir, como contrato para la funcionalidad de taquilla, que toda salida guarde una copia de los convenios aplicados —su nombre, su activación, su beneficio y el valor descontado— y no sólo una referencia a ellos, de modo que cambiar un convenio mañana no altere lo que ya se cobró.
- **FR-019** — El sistema MUST exponer, para una placa y un instante dados, qué convenios se aplican solos —los de activación por placa— y qué convenios requieren la confirmación de un sello, cada uno con su nombre, para que la pantalla de taquilla se arme a partir de esa información.
- **FR-020** — El sistema MUST NOT contener ninguna condición que mencione un convenio o un comercio concreto. Declarar un convenio nuevo MUST bastar para que aparezca donde corresponde.

### 3.4 M4 · Taquilla — vehículos

**Actor principal:** Operario  

#### Historias de usuario (3)

**HU-4.1 · El ciclo completo de un vehículo** — prioridad P1

Un operario atiende la taquilla con carros esperando detrás. Llega uno, escribe la placa,
pulsa Enter y el carro está adentro. Horas después el mismo carro sale: escribe la misma
placa, el sistema reconoce que ya está adentro, le muestra cuánto tiempo lleva y cuánto debe
pagar, y con otra pulsación el movimiento queda cerrado y cobrado.

**HU-4.2 · Saber quién atendió y en qué turno** — prioridad P2

El administrador necesita saber quién estaba en la taquilla cuando ocurrió cada movimiento.
El operario abre su turno al llegar y lo cierra al irse; el sistema guarda la hora real
además de la programada, porque casi nunca coinciden.

**HU-4.3 · Ver cuántos hay adentro** — prioridad P3

El operario y el administrador quieren saber cuántos vehículos hay adentro por tipo y
cuántos caben. La capacidad ya se declara desde la fase anterior; hasta ahora no había nada
contra qué contrastarla.

#### Requisitos funcionales (30)

- **FR-001** — El sistema MUST resolver, a partir de la placa escrita, si corresponde registrar una entrada o una salida, sin que el operario elija entre las dos.
- **FR-002** — Registrar la entrada de un carro o de una moto MUST requerir exactamente un dato: la placa. MUST NOT existir un selector manual de tipo de vehículo.
- **FR-003** — El tipo MUST derivarse del último carácter de la placa: dígito es carro, letra es moto. Esta regla MUST vivir aislada y probada, y MUST poder cambiar sin tocar el flujo de registro.
- **FR-004** — Una placa que no corresponda a ningún formato válido conocido MUST rechazarse con un error explícito. MUST NOT clasificarse por defecto ni adivinarse.
- **FR-005** — Las placas MUST normalizarse antes de compararse, de modo que "abc 123" y "ABC-123" sean el mismo vehículo.
- **FR-006** — El sistema MUST impedir que una misma placa esté adentro dos veces a la vez.
- **FR-007** — El sistema MUST avisar antes de registrar la entrada de un vehículo cuyo tipo no tenga tarifa declarada, porque no se le va a poder cobrar la salida.
- **FR-008** — Al registrar la salida, el sistema MUST calcular el importe reutilizando el cálculo que ya existe, sin reimplementarlo: tarifa vigente, horario del establecimiento, convenios aplicables y regla de redondeo.
- **FR-009** — El sistema MUST aplicar solos los convenios de activación por placa que cubran esa placa y estén vigentes en el instante de la salida.
- **FR-010** — El sistema MUST ofrecer un control por cada convenio de activación por sello vigente, rotulado con el nombre del convenio, para que quien atiende confirme el que traiga el ticket. MUST NOT existir ninguna condición en el código que mencione un convenio o un comercio concreto.
- **FR-011** — El sistema MUST contar cuántas veces se aplicó ya cada convenio ese día a esa placa —día calendario del establecimiento, contra el día de la salida— y usar ese número al calcular, de modo que los límites diarios declarados surtan efecto.
- **FR-012** — La pantalla MUST mostrar el desglose y no sólo el total: el importe base, cada convenio con su efecto, los que no se aplicaron y por qué, y el redondeo.
- **FR-013** — Antes de confirmar una entrada, el sistema MUST mostrar la tarifa que se va a aplicar; si la placa tiene convenio, MUST nombrar el convenio.
- **FR-014** — El sistema MUST mostrar, mientras el vehículo sigue adentro, cuánto tiempo lleva y cuánto pagaría si saliera en ese momento.
- **FR-015** — Un movimiento finalizado MUST NOT modificarse ni eliminarse. Las correcciones MUST registrarse como asientos nuevos que referencian el original.
- **FR-016** — Todo movimiento MUST registrar el operario de entrada, el operario de salida y las marcas de tiempo de ambos eventos.
- **FR-017** — El importe cobrado MUST almacenarse junto con una COPIA de la tarifa y de los convenios aplicados en ese instante, no una referencia. Cambiar una tarifa mañana MUST NOT alterar lo que ya se cobró.
- **FR-018** — Suspender o dar de baja un establecimiento MUST NOT destruir su historial de movimientos.
- **FR-019** — Los importes MUST almacenarse como enteros, nunca en punto flotante, y las marcas de tiempo MUST guardarse sin ambigüedad de zona horaria.
- **FR-020** — Los operarios MUST poder abrir y cerrar una sesión de turno desde la taquilla.
- **FR-021** — Una sesión MUST guardar la hora real de apertura y de cierre además de la programada por el turno, porque casi nunca coinciden y la diferencia es justamente lo que hay que poder revisar.
- **FR-022** — Cada movimiento MUST quedar atribuido a la sesión de turno abierta en el momento de cada extremo. La entrada y la salida MUST poder pertenecer a sesiones distintas.
- **FR-023** — La ausencia de sesión abierta MUST NOT impedir registrar movimientos. El movimiento queda sin turno: no se puede dejar un vehículo afuera porque nadie abrió una sesión.
- **FR-024** — El sistema MUST permitir cerrar una sesión aunque queden vehículos adentro.
- **FR-025** — Los operarios de taquilla MUST poder registrar entradas y salidas de su establecimiento, y de ningún otro.
- **FR-026** — Los administradores de establecimiento MUST poder hacer además todo lo que hace un operario, porque hay parqueaderos donde el administrador trabaja en taquilla.
- **FR-027** — Con el establecimiento suspendido, el sistema MUST impedir entradas nuevas y MUST permitir cerrar las que ya están adentro.
- **FR-028** — El sistema MUST poder decir cuántos vehículos hay adentro por tipo.
- **FR-029** — El sistema MUST contrastar ese conteo con la capacidad declarada cuando exista, y MUST NOT inventar un máximo cuando no se declaró.
- **FR-030** — Superar la capacidad MUST avisar sin impedir. Quien está en la taquilla ve el vehículo y sabe si cabe mejor que el sistema.

### 3.5 M5 · Taquilla — bicicletas y fichas

**Actor principal:** Operario

#### Historias de usuario (5)

**HU-5.1 · Recibir una bicicleta y entregar su ficha** — prioridad P1

Llega un cliente con una bicicleta. El operario le pide la cédula y el teléfono y los
escribe, el sistema asigna el número de ficha que sigue, y sale el tique impreso con ese
número. La cédula no es burocracia: **es lo que permite devolverle la bicicleta a alguien
que perdió el tique**, que es el caso que ocurre de verdad. Sin ella, un tique perdido deja
la bicicleta sin forma de vincularla a nadie.

**HU-5.2 · Devolver la bicicleta y cobrar** — prioridad P1

El cliente vuelve con el tique. El operario escribe el número de ficha, el sistema muestra
desde cuándo está la bicicleta y cuánto se le cobra, se cobra, y el número queda libre para
la siguiente.

**HU-5.3 · Declarar la capacidad de bicicletas** — prioridad P2

El administrador declara cuántas bicicletas caben en el establecimiento. Ese número define
hasta dónde llegan los números de ficha y cuándo el sistema deja de recibir.

**HU-5.4 · El cliente perdió el tique** — prioridad P2

El cliente vuelve sin el papel. El operario busca por la cédula que se registró al recibir
la bicicleta, encuentra qué número tiene esa persona, le entrega la bicicleta y cierra el
movimiento dejando registrado que se cerró sin tique.

**HU-5.5 · Se acabaron los cupos** — prioridad P3

Todas las bicicletas que caben están adentro y llega otro cliente.

> **Qué es una ficha.** Una ficha **no** es un tarjetón físico con inventario propio. Es el
> tique impreso del movimiento, donde en lugar de la placa dice «Ficha 3». Cuántas hay es
> la capacidad de bicicletas que el establecimiento declaró, y un número está libre cuando
> ningún movimiento abierto lo sostiene. De ahí que no exista ni dar de baja una ficha ni
> cobrar su reposición: no hay nada físico que reponer.

#### Requisitos funcionales (23)

- **FR-001** — El sistema MUST permitir que cada establecimiento declare cuántas bicicletas caben, y ese número MUST definir el rango de los números de ficha, desde 1 en adelante
- **FR-002** — El sistema MUST permitir cambiar esa capacidad sin alterar los movimientos ya registrados
- **FR-003** — El sistema MUST considerar libre todo número de ficha que no esté sostenido por un movimiento abierto
- **FR-004** — El sistema MUST asignar automáticamente el número de ficha libre que sigue al recibir una bicicleta, sin que el operario tenga que elegirlo
- **FR-005** — El sistema MUST garantizar que dos bicicletas no reciban el mismo número a la vez, incluso si dos operarios reciben simultáneamente
- **FR-006** — El sistema MUST rechazar la recepción cuando no quede ningún número libre, con un mensaje que diga que no hay cupo y no un error técnico
- **FR-007** — El sistema MUST mostrar en la taquilla cuántos cupos de bicicleta quedan
- **FR-008** — El sistema MUST registrar la recepción como un movimiento con las mismas garantías que uno de vehículo: turno, operario, hora y copia embebida de lo que se aplicó
- **FR-009** — El sistema MUST emitir un tique con el número de ficha destacado, con el mismo mecanismo de impresión y de pendientes que el de los vehículos
- **FR-010** — Los operarios MUST poder resolver la devolución escribiendo el número de ficha
- **FR-011** — El sistema MUST calcular el cobro con la tarifa de bicicleta vigente, por el mismo motor que cobra los vehículos
- **FR-012** — El sistema MUST liberar el número de ficha al cerrar el movimiento
- **FR-013** — El sistema MUST rechazar un número que no corresponde a ningún movimiento abierto, sin registrar nada
- **FR-014** — El sistema MUST permitir cerrar sin cobro, con motivo obligatorio, igual que la cortesía de vehículos
- **FR-015** — Los operarios MUST poder buscar un movimiento de bicicleta abierto por la cédula de quien la dejó, para cuando el cliente vuelve sin el tique
- **FR-016** — El sistema MUST registrar que un movimiento se cerró sin tique, con el operario que lo autorizó y la hora
- **FR-017** — Cerrar sin tique MUST cobrar la permanencia normalmente y MUST NOT sumar ningún valor adicional: el tique es papel impreso y no hay nada que reponer
- **FR-018** — El sistema MUST usar el número de ficha como identificador del movimiento de una bicicleta; la cédula es la vía de recuperación, no el identificador
- **FR-019** — El sistema MUST distinguir sin ambigüedad un número de ficha de una placa cuando ambos se escriben en el mismo campo
- **FR-020** — El alcance de las fichas MUST limitarse a las bicicletas. Las motocicletas tienen placa y siguen entrando por el flujo que ya existe
- **FR-021** — El sistema MUST tratar la cédula, el teléfono y la nota de la bicicleta como datos personales, con el mismo régimen que ya se aplica a las cuentas: se anonimizan cuando corresponde y no salen en ningún listado que no los necesite
- **FR-022** — El sistema MUST mostrar al operario, en la pantalla de recepción, para qué se piden esos datos, de modo que pueda decírselo al cliente
- **FR-023** — El sistema MUST purgar cédula y teléfono de los movimientos cerrados según el mismo plazo de retención que ya rige para el resto del historial, conservando el movimiento y su cobro

---

## 4. Requisitos no funcionales

Cada uno es comprobable: la columna de verificación dice cómo se demuestra que
el sistema cumple.

### 4.1 Seguridad

| ID | Requisito | Verificación |
|---|---|---|
| **RNF-01** | El sistema debe imponer el aislamiento entre establecimientos en la propia base de datos, mediante políticas de seguridad a nivel de fila forzadas | Con dos establecimientos cargados, una sesión de uno obtiene cero registros del otro en las siete entidades operativas |
| **RNF-02** | El sistema debe verificar los permisos en el servidor antes de ejecutar cada operación | Una solicitud enviada directamente al servidor, sin pasar por la interfaz, con un rol no autorizado, es rechazada |
| **RNF-03** | El sistema debe almacenar las contraseñas cifradas con un algoritmo de hash de un solo sentido | La columna de contraseña no contiene ningún texto legible |
| **RNF-04** | El sistema debe aplicar una demora creciente entre intentos fallidos de inicio de sesión, sin llegar a bloquear la cuenta de forma permanente | Tras varios fallos la demora crece hasta un tope de 30 segundos, y luego el acceso se restablece |
| **RNF-05** | El sistema debe registrar cada uso del privilegio de administrador general con el motivo, la cuenta y la fecha | Toda operación de plataforma deja una fila en la tabla de auditoría |

### 4.2 Privacidad

| ID | Requisito | Verificación |
|---|---|---|
| **RNF-06** | El sistema debe eliminar la cédula y el teléfono de los movimientos cerrados una vez transcurridos 12 meses, conservando el importe y la fecha | Un movimiento con fecha anterior al plazo queda sin datos personales y con su cobro intacto |

### 4.3 Disponibilidad y resiliencia

| ID | Requisito | Verificación |
|---|---|---|
| **RNF-07** | El sistema debe permitir registrar entradas y cobrar salidas aunque la impresora esté fuera de servicio, dejando los comprobantes pendientes en una lista | Con la impresora desconectada, el movimiento se registra y aparece en la lista de pendientes |
| **RNF-08** | El sistema debe resolver el cálculo del cobro sin conexión a ningún servicio externo | El cálculo produce el mismo resultado con la red desconectada |

### 4.4 Accesibilidad y usabilidad

| ID | Requisito | Verificación |
|---|---|---|
| **RNF-09** | El sistema debe presentar todos los textos con una relación de contraste mínima de 4,5:1 sobre su fondo, y de 3:1 en los contornos de los controles, en los temas claro y oscuro | Cálculo de luminancia sobre cada par de colores de la paleta |
| **RNF-10** | El sistema debe permitir operar la taquilla completa con teclado, confirmando la placa con la tecla Enter | Se completa un ciclo de entrada y salida sin usar el ratón |

### 4.5 Localización

| ID | Requisito | Verificación |
|---|---|---|
| **RNF-11** | El sistema debe interpretar y mostrar todas las fechas en la zona horaria de Colombia, con independencia de la configuración del navegador | Un cobro de las 21:00 aparece en el día correcto aunque el navegador esté en otra zona |
| **RNF-12** | El sistema debe expresar todos los importes en pesos colombianos sin decimales | Ningún importe almacenado ni mostrado contiene fracciones |

### 4.6 Mantenibilidad

| ID | Requisito | Verificación |
|---|---|---|
| **RNF-13** | El sistema debe declarar los permisos de cada operación en un único módulo, de modo que añadir una operación sin declarar quién puede ejecutarla produzca un error de compilación | Se agrega una operación sin permiso declarado y el compilador la rechaza |
| **RNF-14** | El sistema debe mantener una suite de pruebas automatizadas que se ejecute contra una base de datos real | `npx vitest run` ejecuta 712 pruebas en aproximadamente tres minutos |

---

## 5. Trazabilidad

| Documento | Dónde está |
|---|---|
| Historias de usuario con criterios de aceptación | [`Docs/Entrega-1/historias-de-usuario.md`](../Entrega-1/historias-de-usuario.md) |
| Casos de uso con flujos alternativos | [`Docs/Entrega-1/casos-de-uso.md`](../Entrega-1/casos-de-uso.md) |
| Modelo de características y reglas de composición | [`Docs/Entrega-1/feature-model.md`](../Entrega-1/feature-model.md) |
| Hoja de ruta y decisiones de arquitectura | [`Docs/Arquitectura/roadmap.md`](../Arquitectura/roadmap.md) |
| Guía de uso por rol | [`Docs/UserGuide/`](../UserGuide/) |
| Reparto en sprints y responsables | [`Docs/Entrega-1/calendario.md`](../Entrega-1/calendario.md) |
