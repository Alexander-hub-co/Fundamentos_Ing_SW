# Feature Specification: Parquivo

**Feature Branch**: `001-gestion-parqueaderos`

**Created**: 2026-08-15

**Status**: Draft

**Input**: User description: "Plataforma multi-parqueadero: autenticación, roles, tenencia y gestión de parqueaderos por el administrador general"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Dar de alta un parqueadero y su administrador (Priority: P1)

El administrador general registra un nuevo establecimiento en la plataforma, le asigna una
persona responsable y esa persona puede entrar a administrarlo.

**Why this priority**: Sin esto no existe ningún parqueadero, y por lo tanto ninguna otra
funcionalidad del producto tiene dónde ocurrir. Es la primera unidad de valor entregable: con
sólo esta historia, la plataforma ya permite incorporar un cliente.

**Independent Test**: Se prueba completa creando un parqueadero desde el panel general,
asignándole un administrador, e iniciando sesión con esa cuenta para confirmar que accede a su
establecimiento.

**Acceptance Scenarios**:

1. **Given** un administrador general autenticado, **When** registra un parqueadero con sus
   datos básicos, **Then** el establecimiento queda creado en estado activo y aparece en el
   listado general.
2. **Given** un parqueadero recién creado, **When** el administrador general le asigna una
   persona como administradora, **Then** esa persona recibe acceso al establecimiento y a
   ningún otro.
3. **Given** un administrador de parqueadero con credenciales válidas, **When** inicia sesión,
   **Then** accede directamente al panel de su establecimiento sin poder elegir otro.
4. **Given** un administrador general, **When** registra un parqueadero, **Then** el sistema le
   asigna un código interno único que nunca cambia y por el cual queda identificado.

---

### User Story 2 - Acceso aislado por establecimiento (Priority: P1)

Cualquier usuario asociado a un parqueadero opera únicamente sobre los datos de ese
establecimiento, y no existe camino —ni por navegación, ni por manipulación de identificadores,
ni por búsqueda— que le permita alcanzar los datos de otro.

**Why this priority**: Es el Principio I de la constitución, declarado no negociable. Es la
única falla del sistema que no admite reparación posterior: si un cliente ve los ingresos de
otro, la confianza no se recupera con un parche. Debe existir desde la primera línea, no
añadirse después.

**Independent Test**: Se prueba creando dos parqueaderos con usuarios distintos e intentando,
desde la sesión del primero, alcanzar deliberadamente los recursos del segundo por identificador
directo. Toda tentativa debe fallar.

**Acceptance Scenarios**:

1. **Given** un administrador del Parqueadero A autenticado, **When** solicita un recurso
   perteneciente al Parqueadero B usando su identificador directo, **Then** el sistema deniega
   el acceso y el resultado es indistinguible de que el recurso no exista.
2. **Given** un administrador del Parqueadero A, **When** consulta cualquier listado del
   sistema, **Then** el resultado contiene exclusivamente registros de A, sin necesidad de que
   el usuario aplique ningún filtro.
3. **Given** un usuario sin parqueadero asignado, **When** intenta acceder a cualquier recurso
   operativo, **Then** el sistema deniega el acceso.
4. **Given** un administrador general, **When** consulta los establecimientos, **Then** sí
   accede a todos, y ese privilegio queda registrado como acción auditable.

---

### User Story 3 - Suspender y reactivar un establecimiento (Priority: P2)

El administrador general suspende un parqueadero cuya cuenta dejó de estar al día. El
establecimiento entra en modo restringido —puede cerrar lo que tiene abierto pero no tomar
trabajo nuevo— y vuelve a la normalidad cuando la situación se regulariza.

**Why this priority**: Es la única palanca que tiene el administrador general para hacer valer el
cobro, que ocurre fuera del sistema. No es necesaria para operar un parqueadero, por eso va
después de P1, pero sí para sostener la plataforma comercialmente.

**Independent Test**: Se prueba suspendiendo un establecimiento activo, verificando que sus
usuarios quedan limitados a cerrar lo pendiente, reactivándolo y confirmando que recuperan el
acceso pleno con toda su información intacta.

**Acceptance Scenarios**:

1. **Given** un parqueadero activo, **When** el administrador general lo suspende, **Then** sus
   usuarios entran en modo restringido y ven un mensaje que explica el motivo y qué pueden
   seguir haciendo.
2. **Given** un parqueadero suspendido con movimientos abiertos, **When** un operario registra
   la salida de uno de ellos, **Then** la operación se completa y el cobro se registra
   normalmente.
3. **Given** un parqueadero suspendido, **When** un operario intenta registrar una entrada
   nueva, **Then** el sistema la rechaza indicando que el establecimiento está suspendido.
4. **Given** un parqueadero suspendido, **When** el administrador general lo reactiva, **Then**
   sus usuarios recuperan el acceso pleno inmediatamente y ningún dato se perdió durante la
   suspensión.
5. **Given** un parqueadero suspendido, **When** el administrador general consulta su
   información, **Then** puede verla completa, porque la suspensión afecta a los usuarios del
   establecimiento, no a la visibilidad global.
6. **Given** cualquier establecimiento, **When** se cambia su estado, **Then** queda registrado
   quién lo hizo, cuándo y con qué motivo, y ese registro sobrevive a cambios de estado
   posteriores.
7. **Given** un establecimiento en estado pendiente, **When** sus usuarios operan, **Then** el
   acceso es idéntico al de un establecimiento activo: el estado señala una situación comercial,
   no una restricción operativa.

---

### User Story 4 - Gestionar el acceso y el ciclo de vida de las cuentas (Priority: P2)

El administrador general administra las personas que tienen acceso a la plataforma: las crea,
les restablece la contraseña, las bloquea cuando corresponde, las da de baja y anonimiza sus
datos personales cuando su titular lo exige. El sistema, por su parte, defiende esas cuentas de
los intentos de adivinación de contraseña.

**Why this priority**: Necesario para operar la plataforma con más de un cliente, pero el
producto ya entrega valor con P1 aunque la gestión de usuarios sea mínima.

**Independent Test**: Se prueba creando una cuenta, bloqueándola, verificando que no puede
iniciar sesión, y desbloqueándola.

**Acceptance Scenarios**:

1. **Given** un administrador general, **When** crea una cuenta con contraseña temporal y le
   asigna un rol, **Then** la persona puede iniciar sesión con los permisos de ese rol y ninguno
   más.
2. **Given** una cuenta que nunca inició sesión, **When** su titular entra por primera vez con la
   contraseña temporal, **Then** el sistema le exige definir una contraseña nueva antes de
   permitirle cualquier otra acción.
3. **Given** una persona que olvidó su contraseña, **When** el administrador general se la
   restablece, **Then** puede entrar con la temporal nueva y se le vuelve a exigir el cambio.
4. **Given** una cuenta bloqueada, **When** su titular intenta iniciar sesión, **Then** el
   acceso se deniega y se le informa que la cuenta está bloqueada.
5. **Given** una cuenta con sesión activa, **When** el administrador general la bloquea,
   **Then** la sesión en curso deja de tener acceso sin esperar a que expire.
6. **Given** el único administrador de un parqueadero, **When** se intenta bloquearlo o darlo de
   baja, **Then** el sistema advierte que el establecimiento quedaría sin responsable y exige
   confirmación explícita.
7. **Given** una cuenta que acumula varios intentos fallidos seguidos, **When** se intenta otra
   vez, **Then** cada intento nuevo tarda más que el anterior, y tras esperar el titular puede
   volver a entrar sin que nadie intervenga.
8. **Given** un titular que exige la supresión de sus datos personales, **When** el administrador
   general anonimiza su cuenta, **Then** sus datos personales dejan de ser recuperables y la
   cuenta ya no puede autenticarse.
9. **Given** una cuenta anonimizada con movimientos históricos atribuidos, **When** se consulta
   ese histórico, **Then** los registros siguen existiendo y atribuidos a esa cuenta, sin revelar
   quién era su titular.

---

### User Story 5 - Panel global del estado de la plataforma (Priority: P3)

El administrador general ve de un vistazo cuántos establecimientos hay activos, cuántos
suspendidos y cuántas cuentas existen.

**Why this priority**: Es visibilidad, no capacidad operativa. Todo lo que muestra se puede
consultar por otros medios; el panel sólo lo hace cómodo.

**Independent Test**: Se prueba creando establecimientos en distintos estados y verificando que
los contadores del panel coinciden con la realidad.

**Acceptance Scenarios**:

1. **Given** una plataforma con establecimientos en los cuatro estados, **When** el administrador
   general abre el panel, **Then** ve un contador por cada estado y el total de cuentas, y la
   suma de los cuatro contadores iguala el total de establecimientos registrados.
2. **Given** el panel abierto, **When** cambia el estado de un establecimiento, **Then** los
   contadores reflejan el cambio en la siguiente consulta.
3. **Given** una plataforma con cuentas anonimizadas, **When** el administrador general consulta
   el total de cuentas, **Then** las anonimizadas no se cuentan, porque ya no representan a
   ninguna persona.

---

### Edge Cases

- ¿Qué ocurre con un operario que está en medio de su turno, con vehículos dentro, cuando su
  establecimiento es suspendido? Entra en modo restringido: puede cerrar los movimientos
  abiertos y cobrarlos, pero no registrar entradas nuevas.
- ¿Qué ocurre si se intenta dar de baja un parqueadero que ya tiene historial de movimientos?
  El Principio IV prohíbe destruir el historial: la baja es lógica y los registros se conservan.
- ¿Qué ocurre si una persona debe administrar dos establecimientos? No está soportado: necesita
  una cuenta por establecimiento. La asignación se modela como entidad propia para que
  habilitarlo más adelante sea trabajo de interfaz y no migración de datos.
- ¿Qué ocurre si alguien intenta registrarse por su cuenta como parqueadero nuevo? No existe
  registro público: el alta es siempre manual, ejecutada por el administrador general.
- ¿Qué ocurre si por error se da de alta dos veces el mismo parqueadero real? El sistema lo
  permite y los trata como dos establecimientos independientes, porque el identificador es un
  código interno sin anclaje externo. Detectarlo y corregirlo es responsabilidad operativa del
  administrador general; la corrección es dar de baja el duplicado, nunca borrarlo.
- ¿Qué ocurre si un usuario nunca cambia su contraseña temporal? No puede hacer nada más: el
  cambio se exige antes de conceder acceso a cualquier otra funcionalidad.
- ¿Qué ocurre si un operario se equivoca varias veces al escribir su contraseña? Cada intento
  siguiente tarda más, pero la cuenta nunca queda bloqueada: esperando puede volver a entrar sin
  depender de nadie.
- ¿Qué ocurre con los movimientos históricos de una persona cuya cuenta fue anonimizada? Siguen
  atribuidos a esa cuenta como entidad y los reportes por empleado siguen cuadrando; lo que se
  pierde es la posibilidad de saber quién era.
- ¿Qué ocurre si el último administrador de un establecimiento es bloqueado o dado de baja?
  El sistema advierte y exige confirmación explícita.
- ¿Qué ocurre si dos administradores generales editan el mismo establecimiento a la vez? El
  último cambio confirmado prevalece y queda registrado quién lo hizo.
- ¿Qué ocurre si alguien intenta alcanzar un recurso de otro establecimiento sustituyendo el
  identificador en la petición? Se deniega, y la respuesta no revela si el recurso existe.
- ¿Qué ocurre al reactivar un establecimiento cuyos usuarios fueron bloqueados individualmente?
  El bloqueo de cuenta y la suspensión de establecimiento son independientes y ambos deben
  levantarse.

## Requirements *(mandatory)*

### Functional Requirements

**Identidad y acceso**

- **FR-001**: El sistema MUST permitir a una persona autenticarse con credenciales propias antes
  de acceder a cualquier funcionalidad.
- **FR-002**: El sistema MUST reconocer exactamente tres roles: administrador general de la
  plataforma, administrador de parqueadero y operario de taquilla.
- **FR-003**: El sistema MUST evaluar los permisos en cada operación del lado del servidor.
  Ocultar una opción en la interfaz NUNCA constituye control de acceso.
- **FR-004**: El sistema MUST terminar el acceso efectivo de una sesión en curso cuando la
  cuenta asociada es bloqueada o su establecimiento suspendido, sin esperar a que la sesión
  expire por tiempo.
- **FR-005**: El sistema MUST registrar cada intento de acceso denegado por violación de ámbito,
  con la cuenta, el recurso solicitado y el momento.
- **FR-006**: El sistema MUST aplicar una demora creciente entre intentos de inicio de sesión
  fallidos consecutivos sobre la misma identidad. Los primeros 3 intentos no tienen penalización;
  a partir del cuarto la espera se duplica en cada intento (2, 4, 8, 16 segundos) **con un tope
  de 30 segundos**. La demora se cuenta por correo intentado, no por cuenta existente, para que
  el mecanismo no revele qué correos están registrados.
- **FR-007**: Esa demora MUST NOT derivar nunca en un bloqueo permanente de la cuenta. El acceso
  MUST restablecerse por el mero transcurso del tiempo, sin intervención del administrador
  general. El bloqueo administrativo de cuentas (FR-036) es un mecanismo distinto y deliberado.
- **FR-008**: El sistema MUST registrar cada intento de inicio de sesión fallido con la cuenta
  afectada, el origen de la petición y el momento.

**Aislamiento entre establecimientos**

- **FR-009**: El sistema MUST resolver el establecimiento activo de un usuario a partir de su
  sesión autenticada, y NUNCA a partir de un valor que el cliente pueda enviar o modificar.
- **FR-010**: Toda consulta de datos operativos MUST estar delimitada por el establecimiento
  resuelto; una consulta sin ámbito resuelto MUST fallar en lugar de devolver todos los
  registros.
- **FR-011**: El sistema MUST responder a las solicitudes de recursos de otro establecimiento de
  forma indistinguible de un recurso inexistente, sin revelar su existencia.
- **FR-012**: Todo acceso a datos operativos MUST ocurrir dentro de una transacción que fije el
  ámbito antes de cualquier consulta. Una consulta ejecutada fuera de ese marco MUST ser tratada
  como defecto, no como caso admisible: es la condición de la que depende que FR-010 se cumpla de
  verdad y no sólo por convención.
- **FR-013**: Únicamente el rol de administrador general MUST poder operar sin ámbito de
  establecimiento, y ese privilegio MUST ser explícito en cada punto donde se ejerce.

**Gestión de establecimientos**

- **FR-014**: Un administrador general MUST poder registrar un establecimiento con sus datos
  identificatorios básicos.
- **FR-015**: El sistema MUST NOT exponer ningún registro público de establecimientos. El alta
  es exclusivamente manual, ejecutada por un administrador general autenticado.
- **FR-016**: El sistema MUST asignar a cada establecimiento, en el momento del alta, un código
  interno único generado por la plataforma. Ese código MUST ser inmutable durante toda la vida
  del establecimiento y MUST ser el identificador por el que se lo referencia internamente.
- **FR-017**: El sistema MUST NOT depender de ningún identificador externo al negocio para
  garantizar unicidad. En consecuencia, el sistema NO puede detectar por sí mismo que un mismo
  parqueadero real sea dado de alta dos veces; evitar esa duplicación es responsabilidad del
  administrador general al momento del alta.
- **FR-018**: Un administrador general MUST poder editar los datos de cualquier establecimiento.
- **FR-019**: Un administrador general MUST poder asignar y retirar personas administradoras de
  un establecimiento.
- **FR-020**: Una cuenta MUST estar asignada a un solo establecimiento. El sistema MUST rechazar
  la asignación de una cuenta ya vinculada a otro establecimiento.
- **FR-021**: Un administrador general MUST poder consultar el listado completo de
  establecimientos con su estado actual y sus personas responsables.
- **FR-022**: Un administrador de parqueadero MUST poder consultar y editar los datos de su
  propio establecimiento, y de ningún otro.

**Estado de cuenta y suspensión**

- **FR-023**: Cada establecimiento MUST tener en todo momento exactamente un estado, entre cuatro
  valores mutuamente excluyentes: activo, pendiente, suspendido y dado de baja. No existe ninguna
  otra marca de estado o archivado en paralelo.
- **FR-024**: El estado `pendiente` MUST comportarse, a efectos de acceso, de forma idéntica al
  estado `activo`. Existe para representar una cuenta con pago vencido que todavía no se decidió
  suspender, de modo que la decisión comercial sea visible antes de tener consecuencias
  operativas. Todos los cambios de estado son manuales, ejecutados por el administrador general:
  el sistema NUNCA cambia el estado de un establecimiento por su cuenta.
- **FR-025**: Un administrador general MUST poder suspender y reactivar un establecimiento.
- **FR-026**: Todo cambio de estado de un establecimiento MUST registrar quién lo ejecutó, cuándo
  y con qué motivo. El registro MUST conservarse aunque el establecimiento cambie de estado
  después.
- **FR-027**: Un establecimiento suspendido MUST entrar en modo restringido, conservando la
  totalidad de su información. El modo restringido MUST permitir cerrar los movimientos que ya
  estén abiertos y cobrarlos, y MUST impedir el registro de movimientos nuevos.
- **FR-028**: El modo restringido MUST impedir además el acceso a la configuración del
  establecimiento y a los reportes, limitando al operario a cerrar lo pendiente.
- **FR-029**: La reactivación de un establecimiento MUST restituir el acceso pleno de sus
  usuarios sin pérdida ni alteración de información.
- **FR-030**: El sistema MUST informar a un usuario cuyo acceso fue restringido por suspensión
  cuál es el motivo y qué puede seguir haciendo, sin exponer datos comerciales de la cuenta.

**Gestión de cuentas**

- **FR-031**: Un administrador general MUST poder crear cuentas de usuario y asignarles un rol.
- **FR-032**: Al crear una cuenta, el administrador general MUST establecer una contraseña
  temporal inicial. La entrega de esa contraseña a su titular ocurre fuera del sistema.
- **FR-033**: El sistema MUST exigir el cambio de contraseña en el primer inicio de sesión de una
  cuenta, antes de conceder acceso a cualquier otra funcionalidad.
- **FR-034**: Un administrador general MUST poder restablecer la contraseña de cualquier cuenta a
  una nueva temporal, lo que MUST volver a exigir el cambio en el siguiente inicio de sesión.
- **FR-035**: El sistema MUST NOT ofrecer recuperación de contraseña autogestionada por el propio
  usuario en esta feature. La recuperación pasa siempre por el administrador general.
- **FR-036**: Un administrador general MUST poder bloquear y desbloquear cuentas.
- **FR-037**: Un administrador general MUST poder dar de baja cuentas.
- **FR-038**: El sistema MUST advertir y exigir confirmación explícita antes de bloquear o dar
  de baja a la única persona administradora de un establecimiento.
- **FR-039**: El bloqueo de una cuenta y la suspensión de un establecimiento MUST ser condiciones
  independientes; levantar una no levanta la otra.

**Baja de establecimientos e historial**

- **FR-040**: La baja de un establecimiento MUST ser lógica: consiste en llevarlo al estado
  "dado de baja". Deja de estar operativo y de aparecer en los listados activos, pero su
  información se conserva íntegra.
- **FR-041**: El estado "dado de baja" MUST comportarse como terminal para la operación: sus
  usuarios pierden todo acceso, y salir de él MUST requerir una reactivación explícita del
  administrador general hacia el estado activo.
- **FR-042**: El sistema MUST impedir la destrucción física de establecimientos y de las cuentas
  referenciadas por registros históricos. La vía para atender una solicitud de supresión de datos
  personales es la anonimización (FR-043), no el borrado.

**Datos personales y derecho de supresión**

- **FR-043**: El sistema MUST identificar explícitamente qué campos de una cuenta constituyen
  datos personales de su titular, de modo que puedan tratarse como conjunto.
- **FR-044**: Un administrador general MUST poder anonimizar una cuenta: sus datos personales se
  sustituyen por un marcador que no permite reconstruir al titular, mientras el registro y todas
  sus referencias históricas permanecen intactos.
- **FR-045**: La anonimización MUST ser irreversible y MUST NOT romper ninguna referencia
  existente. Un movimiento histórico atribuido a una cuenta anonimizada MUST seguir siendo
  atribuible a ella como entidad, aunque su titular ya no sea identificable.
- **FR-046**: Una cuenta anonimizada MUST NOT poder autenticarse ni recuperar el acceso.
- **FR-047**: Los registros de intentos de inicio de sesión y de accesos denegados MUST tener un
  período de retención definido, transcurrido el cual se eliminan automáticamente. El valor
  inicial es **12 meses**: suficiente para investigar un incidente y acotado para no conservar
  datos personales indefinidamente. Es configuración de plataforma, no de establecimiento.
- **FR-048**: La especificación MUST declarar quién responde por cada categoría de datos
  personales. En F1: **la plataforma responde por los datos de las cuentas de usuario**, porque es
  quien decide su finalidad y su tratamiento. Los datos de los clientes finales de cada
  parqueadero —que aparecen a partir de F3— pertenecen a una categoría distinta, donde el
  establecimiento responde y la plataforma sólo trata por encargo. La distinción MUST resolverse
  antes de que exista el primer dato de cliente final.

**Panel general**

- **FR-049**: Un administrador general MUST poder consultar el número de establecimientos en cada
  uno de los cuatro estados —activo, pendiente, suspendido y dado de baja— y el total de cuentas.
  Ningún estado queda fuera del recuento: un establecimiento siempre suma exactamente a un
  contador, de modo que la suma de los cuatro iguala el total registrado.
- **FR-050**: El total de cuentas MUST excluir las cuentas anonimizadas, que ya no representan a
  ninguna persona, e informarlas por separado si se consultan.

- **FR-051**: El código del establecimiento MUST derivarse de su nombre y ser legible: "Parqueadero
  Centro Histórico" da `PCH`. Los códigos aleatorios anteriores cumplían la unicidad pero no se
  podían leer, recordar ni comparar de un vistazo, que es para lo que sirve un identificador que
  se muestra en pantalla.
- **FR-052**: Cada cuenta MUST tener un código legible formado por la sigla de su establecimiento
  y un correlativo propio de ese establecimiento: `PCH-001`, `PCH-002`. Una cuenta sin
  establecimiento se numera bajo la sigla de la plataforma. El objetivo declarado por el
  propietario es distinguir de un vistazo a los empleados de un local de los de otro, sin abrir
  ninguna ficha.
- **FR-053**: El código legible MUST ser un identificador de presentación, no una llave: la clave
  primaria y las referencias entre tablas siguen siendo el identificador interno, de modo que el
  código nunca se use como referencia.

### Key Entities

- **Establecimiento (Parqueadero)**: La unidad de tenencia de la plataforma. Representa un
  parqueadero cliente. Se identifica por un código interno único e inmutable generado en el alta;
  además tiene datos descriptivos, un estado de cuenta y una o varias personas responsables. Es
  la frontera de aislamiento: todo dato operativo del producto cuelga de él.
- **Cuenta de usuario**: Una persona con acceso a la plataforma. Tiene credenciales, un rol y
  una condición de bloqueo independiente del estado de su establecimiento. Sus campos personales
  están declarados como tales, de modo que puedan anonimizarse en bloque sin tocar el resto del
  registro ni sus referencias históricas.
- **Asignación**: El vínculo entre una cuenta y el establecimiento sobre el que opera, junto con
  el rol que ejerce allí. Es lo que determina el ámbito de cada sesión.
- **Estado de cuenta del establecimiento**: La condición comercial que habilita o bloquea el
  acceso operativo de sus usuarios. Toma exactamente uno de cuatro valores excluyentes: activo,
  pendiente, suspendido y dado de baja. Es el único eje de estado del establecimiento; no
  convive con banderas de archivado paralelas.
- **Registro de acceso denegado**: La constancia de un intento de operación fuera de ámbito, con
  cuenta, recurso y momento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los intentos de acceso a datos de otro establecimiento son denegados,
  verificado sobre el conjunto completo de operaciones que exponen datos.
- **SC-002**: Un administrador general puede dejar un parqueadero nuevo operativo, con su
  responsable habilitado, en menos de 3 minutos desde que empieza.
- **SC-003**: Una persona administradora recién asignada consigue iniciar sesión y llegar al
  panel de su establecimiento en su primer intento, sin asistencia.
- **SC-004**: La suspensión de un establecimiento aplica el modo restringido a sus usuarios en
  menos de 1 minuto desde que se confirma, incluyendo a quienes tuvieran sesión abierta.
- **SC-005**: Ningún vehículo que ya estuviera dentro al momento de la suspensión queda sin
  posibilidad de registrar su salida y su cobro.
- **SC-006**: Tras suspender y reactivar un establecimiento, el 100% de su información queda
  idéntica a la previa a la suspensión.
- **SC-007**: Con 1.000 establecimientos registrados, el listado general y el panel se muestran
  completos en menos de 2 segundos.
- **SC-008**: Ningún listado del sistema devuelve un registro fuera del ámbito del usuario que
  lo consulta, verificado con datos de al menos dos establecimientos poblados.
- **SC-009**: Ninguna cuenta queda inaccesible de forma permanente por intentos fallidos de
  inicio de sesión: tras la espera correspondiente, su titular siempre puede volver a intentar
  sin intervención del administrador general.
- **SC-010**: Un intento de adivinación automatizada sobre la misma identidad no consigue más de
  **2 intentos por minuto** sostenidos, una vez alcanzado el tope de demora.

## Clarifications

### Session 2026-08-15

- **P: ¿Los parqueaderos se auto-registran o los da de alta el administrador general?**
  El contexto del proyecto afirmaba ambas cosas, y son dos productos distintos.
  **R: Sólo alta manual.** No existe registro público. Queda fuera del MVP toda la superficie
  asociada: página de registro, verificación de identidad y cola de aprobación. → FR-015

- **P: ¿Una misma persona puede administrar más de un establecimiento?**
  El contexto decía que un parqueadero tiene "uno o varios administradores", pero no aclaraba la
  relación inversa.
  **R: Una cuenta pertenece a un solo establecimiento.** Quien administre dos necesita dos
  cuentas. La asignación se mantiene modelada como entidad propia, de modo que habilitar varias
  sedes por persona en el futuro sea trabajo de interfaz —un selector de sede activa— y no una
  migración del modelo de datos. → FR-020

- **P: ¿Qué ocurre con un turno en curso cuando se suspende el establecimiento?**
  Cortar el acceso de inmediato deja sin salida a los vehículos que ya están adentro.
  **R: Modo restringido.** El operario puede cerrar y cobrar los movimientos abiertos, pero no
  registrar entradas nuevas, y pierde el acceso a configuración y reportes. La presión de cobro
  se mantiene —el negocio deja de recibir ingresos nuevos— sin que los clientes del parqueadero
  paguen por un conflicto comercial ajeno. → FR-027, FR-028

- **P: ¿Un parqueadero dado de baja es un cuarto estado, o la baja es una marca independiente
  del estado comercial?** El requisito de estados declaraba tres valores mientras que el de baja
  lógica introducía un cuarto sin incluirlo en esa lista: una contradicción interna de la
  especificación.
  **R: Cuarto estado.** Un solo campo con cuatro valores excluyentes —activo, pendiente,
  suspendido, dado de baja— y ninguna bandera de archivado en paralelo. Cada operación evalúa
  una sola condición, lo que elimina la clase de error donde se chequea un eje y se olvida el
  otro. → FR-023, FR-040, FR-041

- **P: ¿Cómo recibe sus credenciales un usuario recién creado y cómo recupera el acceso si
  olvida la contraseña?** La spec exigía autenticarse pero no decía cómo llegaba la credencial a
  su dueño, ni qué ocurría al perderla.
  **R: Contraseña temporal fijada por el administrador general**, entregada fuera del sistema, con
  cambio obligatorio en el primer ingreso y restablecimiento a cargo del administrador general.
  No hay recuperación autogestionada. Esto mantiene el envío de correo fuera del alcance de F1:
  la plataforma no depende de ningún proveedor externo para incorporar un cliente.
  → FR-032, FR-033, FR-034, FR-035

- **P: ¿Qué dato identifica de forma única a un parqueadero?** La redacción original rechazaba el
  alta de un establecimiento con "identificador de negocio ya existente" sin que la spec definiera
  nunca cuál era ese dato, de modo que la validación no era implementable ni testeable.
  **R: Un código interno generado por la plataforma**, único e inmutable, sin depender de ningún
  identificador externo como el NIT. **Contrapartida aceptada explícitamente:** al no anclarse a
  ningún dato del mundo real, el sistema no puede detectar por sí mismo que un mismo parqueadero
  sea dado de alta dos veces; evitarlo queda como responsabilidad del administrador general.
  El requisito original de rechazo de duplicados se reemplazó, no se conservó.
  → FR-016, FR-017

- **P: ¿Qué hace el sistema ante intentos fallidos repetidos de inicio de sesión?** La
  especificación exigía autenticación pero no definía ninguna defensa contra adivinación de
  contraseñas, en un producto donde una cuenta comprometida da acceso a la caja de un cliente.
  **R: Demora progresiva, nunca bloqueo permanente.** Cada fallo consecutivo aumenta la espera
  del intento siguiente, lo que vuelve inviable el ataque automatizado sin dejar jamás a un
  operario fuera de servicio por un error de tipeo. Es una decisión deliberadamente distinta del
  bloqueo administrativo de cuentas, que sigue existiendo como acción manual del administrador
  general. Pesó el hecho de que, sin recuperación autogestionada, un bloqueo automático
  convertiría cualquier equivocación nocturna en una taquilla detenida.
  → FR-006, FR-007, FR-008

- **P: ¿Qué hace el sistema ante una solicitud de supresión de datos personales?** FR-042 prohíbe
  destruir cuentas referenciadas por registros históricos, por el Principio IV, mientras que el
  régimen de habeas data reconoce al titular el derecho a exigir la supresión de sus datos. Las
  dos obligaciones no podían cumplirse a la vez tal como estaba redactada la especificación.
  **R: Anonimización, no borrado.** Los campos personales de la cuenta se sustituyen por un
  marcador irreversible y el registro sobrevive con todas sus referencias intactas. El histórico
  financiero no se rompe y el dato personal desaparece de verdad. Exige declarar desde el diseño
  qué campos son personales, que es precisamente lo que resulta caro de añadir más tarde.
  → FR-043, FR-044, FR-045, FR-046

## Assumptions

- La identidad de una cuenta es su correo electrónico, usado exclusivamente como identificador
  único de inicio de sesión. El sistema NO envía correo en esta feature: no hay invitaciones,
  notificaciones ni recuperación por correo, de modo que F1 no depende de ningún proveedor
  externo de envío.
- La autenticación es por sesión con credenciales propias. No se contempla inicio de sesión
  federado ni con proveedores externos en esta feature.
- "Eliminar un parqueadero" significa baja lógica, no destrucción de datos. Lo impone el
  Principio IV de la constitución, que prohíbe destruir historial.
- El cobro a los parqueaderos ocurre **fuera del sistema**, en efectivo o por transferencia
  móvil. La plataforma no procesa pagos, no conoce importes y no tiene forma de saber si un
  establecimiento pagó. En consecuencia, **todo cambio de estado es una decisión humana** del
  administrador general, y no existe ni existirá un proceso automático que suspenda o reactive
  por impago.
- El estado "pendiente" es, por lo tanto, una marca de gestión: sirve para que el administrador
  general recuerde a quién le debe cobrar sin cortarle el servicio todavía. No lleva fecha de
  vencimiento porque no hay ningún proceso esperando esa fecha.
- No existen planes comerciales. La plataforma no impone límites por plan —cantidad de
  operarios, de establecimientos o de movimientos— ni tiene que contarlos. Si en el futuro se
  introdujeran, serían una feature nueva con su propia especificación.
- No hay facturación ni pasarela de pagos en ninguna feature planificada.
- La gestión de operarios por parte del administrador de parqueadero pertenece a F2. F1 sólo
  cubre las cuentas que administra el administrador general.
- El modo restringido (FR-027, FR-028) se define en esta feature como estado y como regla de
  autorización, pero los movimientos que menciona no existen hasta F3. F1 debe dejar el punto de
  control listo y verificable; F3 lo honra cuando aparezcan las entradas y salidas. Los
  escenarios 2 y 3 de la historia 3 sólo son verificables de extremo a extremo una vez
  implementada F3.
- Existe al menos una cuenta de administrador general creada durante la instalación del sistema;
  su creación no ocurre a través de la interfaz.
