<!--
SYNC IMPACT REPORT
==================
Cambio de versión: 1.0.0 → 1.1.0
Motivo del bump: MINOR. Se amplía materialmente la guía de "Roles y autorización"
para admitir la delegación de operaciones nombradas.

Qué cambió y por qué:
  La sección decía que existen "exactamente tres niveles". Al especificar la
  taquilla apareció una necesidad real que no cabía: un administrador quiere
  poder autorizar a un operario de confianza a emitir correcciones de cobro, sin
  convertirlo en administrador. Dos operarios con capacidades distintas es, en la
  práctica, un cuarto nivel, y la redacción anterior lo prohibía.

  Se eligió enmendar y no reinterpretar. La alternativa —argumentar que una
  delegación no es un nivel— habría dejado el principio intacto en el papel y sin
  efecto en la práctica, que es exactamente lo que este documento existe para
  evitar.

Qué riesgo se acepta:
  La autorización deja de leerse en un solo campo. Se acota con tres condiciones
  escritas en la propia sección: las operaciones delegables son una lista cerrada
  y explícita, cada delegación registra quién la otorgó y a quién, y el rol base
  sigue siendo uno de los tres. Un permiso delegable que no esté en esa lista no
  existe.

Secciones modificadas:
  - Restricciones Adicionales y Requisitos de Seguridad → "Roles y autorización"

---
Cambio de versión anterior: (ninguna) → 1.0.0
Motivo del bump: MAJOR inicial. Ratificación de la constitución del proyecto.

Principios añadidos:
  - I.   Aislamiento Multi-Parqueadero (NO NEGOCIABLE)
  - II.  Configurable por Establecimiento, Cero Valores Quemados
  - III. La Taquilla es la Ruta Crítica
  - IV.  Integridad e Inmutabilidad del Historial
  - V.   Alcance Deliberado (YAGNI)

Secciones añadidas:
  - Restricciones Adicionales y Requisitos de Seguridad
  - Flujo de Desarrollo y Puertas de Calidad
  - Governance

Secciones eliminadas: ninguna (documento inicial)

TODOs diferidos:
  - TODO(STACK_TECNOLOGICO): la elección de stack se decide en /speckit-plan, no aquí.
  - TODO(SOLUCION_IMPRESION): el mecanismo de impresión térmica se resuelve como
    decisión técnica en /speckit-plan; el Principio VI-bis de la sección de
    restricciones sólo fija la regla de que no se asuma control directo del navegador.
-->

# Constitución de Parquivo

Esta constitución gobierna el desarrollo de una plataforma web multi-establecimiento para la
operación de parqueaderos. Sus principios son vinculantes: prevalecen sobre preferencias
individuales, sobre la conveniencia de implementación y sobre cualquier documento posterior que
no la enmiende explícitamente.

## Core Principles

### I. Aislamiento Multi-Parqueadero (NO NEGOCIABLE)

Cada parqueadero es un entorno de datos independiente. Todo dato operativo —vehículos,
bicicletas, fichas, movimientos, tickets, tarifas, convenios, empleados, ingresos y reportes—
pertenece a exactamente un parqueadero y MUST estar delimitado por su identificador.

Reglas no negociables:

- Todo acceso a datos MUST resolver el parqueadero activo desde la sesión autenticada del
  usuario, NUNCA desde un parámetro que el cliente pueda manipular.
- El comportamiento por defecto es denegar. Una consulta sin ámbito de parqueadero resuelto es
  un error de programa, no un caso que devuelva todos los registros.
- Sólo el rol de administrador general puede operar sin ámbito de parqueadero, y ese privilegio
  MUST ser explícito en cada punto donde se ejerce.
- Toda funcionalidad que lea o escriba datos operativos MUST acompañarse de una prueba negativa
  que demuestre que un usuario del Parqueadero A no puede alcanzar datos del Parqueadero B.

Racional: un solo escape de ámbito expone los ingresos y la operación de un cliente a otro. Es
el único fallo del sistema que no admite reparación posterior, porque la confianza perdida no
se recupera con un parche.

### II. Configurable por Establecimiento, Cero Valores Quemados

Ningún parámetro de negocio puede vivir en el código. Tarifas, fracciones, topes diarios,
horarios, cantidad de fichas de bicicleta, reglas de redondeo, descuentos y condiciones de
convenio MUST ser configuración por parqueadero, almacenada y editable por su administrador.

Reglas no negociables:

- Está prohibido un literal numérico de precio, duración de cobro o cantidad de fichas en el
  código fuente. Los valores por defecto, si existen, MUST vivir en datos de inicialización
  marcados como tales y ser sobrescribibles.
- El motor de cobro MUST poder expresar modelos distintos (hora, fracción, día, tope diario,
  tarifa por tipo de vehículo) sin cambios en el código; añadir un modelo nuevo puede requerir
  código, pero cambiar los valores de uno existente NUNCA.
- Dos parqueaderos con configuraciones distintas MUST producir cobros distintos para el mismo
  movimiento, y esto MUST estar cubierto por pruebas.

Racional: la plataforma se vende a cualquier parqueadero. Cada supuesto quemado en el código es
un cliente que no se puede atender sin desplegar una versión nueva.

### III. La Taquilla es la Ruta Crítica

La interfaz del operario se optimiza para velocidad de registro por encima de cualquier otra
consideración de diseño. El operario registra vehículos de forma continua y bajo presión de
fila.

Reglas no negociables:

- Registrar la entrada de un carro o una moto MUST requerir exactamente una entrada de datos: la
  placa. MUST NOT existir un selector manual de tipo de vehículo; el tipo se deriva de la placa.
- La bicicleta SÍ tiene su propia acción explícita, porque no posee placa.
- Ninguna configuración administrativa se expone en la vista de taquilla.
- Toda función nueva que se proponga añadir a la pantalla de taquilla MUST justificar por qué no
  puede vivir en el panel administrativo.

Racional: cada clic adicional se multiplica por cientos de vehículos al día y por cada
establecimiento. La simplicidad aquí no es estética, es el producto.

### IV. Integridad e Inmutabilidad del Historial

Los movimientos son registros de auditoría financiera, no filas de trabajo mutables.

Reglas no negociables:

- Un movimiento finalizado NUNCA se modifica ni se elimina físicamente. Las correcciones se
  registran como asientos nuevos que referencian el original.
- Todo movimiento MUST registrar el operario de entrada, el operario de salida y las marcas de
  tiempo de ambos eventos.
- El monto cobrado MUST almacenarse junto con una copia de la tarifa y del convenio aplicados en
  el instante del cobro, no sólo una referencia a ellos. Si mañana el administrador cambia la
  tarifa, el histórico MUST seguir reflejando lo que realmente se cobró.
- Suspender o eliminar un parqueadero NUNCA destruye su historial de movimientos.

Racional: el sistema maneja dinero. Un reporte de ingresos que cambia retroactivamente porque
alguien editó una tarifa es un reporte inservible, y en una disputa con un cliente el histórico
es la única prueba.

### V. Alcance Deliberado (YAGNI)

El MVP definido se construye completo antes de que cualquier funcionalidad futura entre al
alcance. La lista de posibilidades a futuro —QR, reconocimiento de placas por cámara, reservas,
pagos electrónicos, app móvil, facturación— es un registro de intenciones, no un backlog activo.

Reglas no negociables:

- Ninguna funcionalidad fuera del MVP se implementa "porque ya que estamos".
- Se permite y se fomenta dejar puntos de extensión en el diseño; NO se permite construir la
  extensión sin una especificación que la respalde.
- Cuando una decisión de arquitectura se tome pensando en escala futura, MUST documentarse por
  qué el costo presente está justificado.

Racional: el alcance descrito ya es grande. La forma habitual de que un proyecto así muera es
construir la funcionalidad número veinte antes de que la número uno funcione en producción.

## Restricciones Adicionales y Requisitos de Seguridad

**Roles y autorización.** Existen exactamente tres roles base: administrador general de la
plataforma, administrador de parqueadero y operario de taquilla. Toda cuenta tiene exactamente
uno. La autorización MUST evaluarse en el servidor en cada operación; ocultar un botón en la
interfaz NUNCA constituye control de acceso.

**Delegación de operaciones nombradas.** Un administrador de parqueadero MAY autorizar a una
persona concreta de su establecimiento a ejecutar una operación que su rol base no incluye. La
delegación NO crea un rol nuevo ni cambia el que la cuenta tiene.

Reglas no negociables:

- Las operaciones delegables MUST ser una lista cerrada y explícita en la especificación que
  las introduce. Una operación que no esté en esa lista NO es delegable, y ampliarla exige
  volver a la especificación.
- Toda delegación MUST registrar quién la otorgó, a quién y cuándo, y MUST poder revocarse.
- Una delegación MUST NOT alcanzar nunca fuera del establecimiento de quien la otorga: el
  Principio I no admite excepciones por esta vía.
- Ningún rol base MUST poder delegar una operación que él mismo no puede ejecutar.

Racional: la alternativa era obligar a ascender a administrador a quien sólo necesita hacer una
cosa más, y eso reparte poder de más por comodidad. Un parqueadero pequeño tiene un operario de
confianza en el turno de noche y ningún administrador despierto; negarle una corrección de cobro
hasta la mañana siguiente es una regla que la operación real termina saltándose por fuera del
sistema, que es el peor de los desenlaces.

**Clasificación de vehículo por placa.** El tipo se deriva del último carácter de la placa: si
termina en dígito es CARRO, si termina en letra es MOTO. Esta regla MUST implementarse como
regla de dominio aislada y probada, no dispersa en la interfaz. Una placa que no corresponda a
ningún formato válido conocido MUST rechazarse con un error explícito para que el operario la
corrija; NUNCA se clasifica por defecto ni se adivina. La regla MUST poder evolucionar sin tocar
el flujo de registro.

**Estado de suscripción.** El estado de la cuenta (activo, pendiente, suspendido) MUST evaluarse
en el servidor al autenticar y al ejecutar operaciones. Una cuenta suspendida pierde el acceso
operativo, pero sus datos permanecen intactos y su reactivación MUST ser inmediata y sin pérdida
de información.

**Impresión.** MUST NOT asumirse que una página web puede enviar trabajos directamente a una
impresora térmica local. Cualquier funcionalidad de impresión MUST diseñarse contra esa
restricción real del navegador y la solución elegida MUST documentarse como decisión técnica
antes de implementarse.

**Datos monetarios y temporales.** Los importes NUNCA se representan en punto flotante. Las
marcas de tiempo se almacenan sin ambigüedad de zona horaria, y el cálculo de permanencia es
responsabilidad exclusiva del sistema: el operario NUNCA calcula ni ajusta tiempo a mano.

## Flujo de Desarrollo y Puertas de Calidad

Este proyecto se desarrolla mediante Spec-Driven Development con Spec Kit. La especificación,
no el código, es la fuente de verdad.

- Toda funcionalidad MUST recorrer el ciclo `/speckit-specify` → `/speckit-clarify` →
  `/speckit-plan` → `/speckit-tasks` → `/speckit-implement` antes de considerarse terminada.
- `/speckit-clarify` MUST ejecutarse en cualquier funcionalidad que toque cobro, aislamiento de
  datos o autorización. Las ambigüedades en esas tres áreas no se resuelven adivinando.
- Ninguna implementación comienza sin `tasks.md` aprobado.
- Los principios I (aislamiento) y IV (integridad del historial) MUST verificarse con pruebas
  automatizadas, no con revisión visual.
- Todo cambio que introduzca una decisión no contemplada en la especificación MUST volver a la
  especificación antes de escribirse en código.

## Governance

Esta constitución prevalece sobre cualquier otra práctica, documento o preferencia del proyecto.
En caso de conflicto entre esta constitución y un plan, una tarea o una implementación, la
constitución gana y el artefacto en conflicto se corrige.

**Procedimiento de enmienda.** Toda modificación MUST quedar registrada en este archivo con su
justificación, actualizar el bloque de versión y anotarse en el Sync Impact Report de la
cabecera. Una enmienda que relaje un principio no negociable MUST declarar explícitamente qué
riesgo se acepta a cambio.

**Política de versionado.** Se aplica versionado semántico al documento:

- MAJOR: se elimina o redefine un principio de forma incompatible con lo anterior.
- MINOR: se añade un principio o una sección, o se amplía materialmente una guía existente.
- PATCH: aclaraciones, redacción y correcciones que no cambian el significado.

**Revisión de cumplimiento.** Cada ejecución de `/speckit-plan` y `/speckit-analyze` MUST
verificar el trabajo propuesto contra estos principios y reportar cualquier desviación como
bloqueante. La complejidad que contradiga el Principio V MUST justificarse por escrito o
eliminarse.

**Version**: 1.1.0 | **Ratified**: 2026-08-15 | **Last Amended**: 2026-08-19
