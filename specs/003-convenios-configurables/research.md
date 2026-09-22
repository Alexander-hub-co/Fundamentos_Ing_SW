# Investigación: convenios y descuentos configurables

**Fase 0** · Alcance: historias 1 y 2. La historia 3 (asistente de IA) queda fuera por
decisión del propietario del producto, así que aquí no se evalúa ningún proveedor de
modelo ni se resuelve nada relacionado.

El stack no se investiga: está decidido y en producción. Lo que sigue son las tres
decisiones de diseño que la especificación deja abiertas y que hay que cerrar antes de
escribir código.

---

## D1 — De dónde salen los minutos gratis sin romper el calculador

**Decisión**: `calcularImporte` recibe un parámetro nuevo, `minutosGratis`, con valor por
defecto cero. Los minutos se consumen **desde el comienzo de la permanencia**, tramo por
tramo: si un tramo tiene menos minutos cobrables que los que quedan gratis, ese tramo
queda entero en cero y el sobrante pasa al siguiente.

**Razón**. La especificación exige (FR-007) que los minutos gratis se resten del *tiempo
cobrable* y no del importe, porque el valor de un minuto depende de la tarifa, de la plena
y de la mínima. Eso descarta la alternativa cómoda de calcular primero y descontar después.

Descartada también la de **mover la hora de salida hacia atrás**, que a primera vista
parece equivalente y no lo es: cuando el establecimiento no cobra las horas cerradas, una
parte de la permanencia no genera minutos cobrables, así que restarle sesenta minutos al
reloj puede no restar ningún minuto facturable. Se restan minutos *cobrables*, que es lo
que la persona entiende por "una hora gratis".

Se consumen desde el principio y no desde el final porque "la primera hora es gratis" es
la lectura natural del acuerdo, y porque con `alcancePlena: jornada` cada tramo se topa
por separado: elegir un extremo u otro cambia el resultado, así que hay que elegir uno y
escribirlo, no dejarlo al azar del recorrido.

**Alternativas consideradas**: descontar del importe final (viola FR-007); repartir los
minutos proporcionalmente entre tramos (nadie lo entendería al leer el desglose);
consumirlos desde el final (mismo costo de implementación, lectura menos natural).

**Consecuencia buena**: el parámetro es opcional y por defecto cero, así que ninguna de
las llamadas actuales a `calcularImporte` cambia, y las pruebas que ya existen siguen
valiendo tal cual.

---

## D2 — Dónde vive la regla de redondeo

**Decisión**: una tabla nueva por establecimiento, con una fila como máximo, que guarda la
política de cobro. Hoy sólo lleva la regla de redondeo. La ausencia de fila significa el
valor inicial, declarado como constante documentada en el dominio.

**Razón**. No va en `parqueadero` porque esa tabla la administra la plataforma —nombre,
dirección, estado de suscripción— y el redondeo lo decide el establecimiento. No va en
`horario_atencion` aunque allí ya viva `cobra_horas_cerradas`, porque el horario puede
declararse o no y el redondeo tiene que existir siempre; colgarlo del horario haría que un
establecimiento sin horario declarado no tuviera regla de redondeo.

Que la ausencia de fila valga como valor inicial repite el patrón que ya usa
`horarioDelCobro`, donde un establecimiento sin horario se trata como abierto veinticuatro
horas. Evita tener que crear filas al dar de alta un parqueadero y evita la rama "¿y si
falta?" desperdigada por el código: se resuelve una vez, en la lectura.

**El valor inicial es "al peso, truncando hacia abajo"**, y vive como constante nombrada y
documentada, no como un literal suelto. Truncar y no aproximar porque redondear hacia
arriba cobraría pesos que ningún cálculo produjo, y ése es el problema contable que la
especificación quiere evitar (FR-011b).

**Alternativas consideradas**: columna en `parqueadero` (mezcla lo que administra la
plataforma con lo que decide el local); columna en `horario_atencion` (deja sin regla a
quien no declaró horario); fila creada obligatoriamente al dar de alta (obliga a una
migración de datos y a mantener la invariante "toda fila existe" para siempre).

---

## D3 — Cómo llega la regla de redondeo al calculador sin ensuciarlo

**Decisión**: el calculador no lee la regla: la recibe. La función que compone tarifa y
convenios toma la regla como argumento, igual que hoy toma la tarifa y el horario.

**Razón**. `calcular.ts` es puro por diseño y hay una prueba que lo verifica leyendo sus
importaciones, precisamente para que no deje de serlo en silencio. Si el calculador
consultara la configuración, esa prueba fallaría —y con razón—: el motor de cobro dejaría
de poder probarse sin base de datos, que es lo que hoy permite tener el cobro cubierto sin
que exista un solo movimiento.

Quien lee la configuración es la capa de consulta, que ya sabe hacerlo. El calculador
recibe datos y devuelve datos.

---

## D4 — Cómo se expresa el vocabulario en el esquema

**Decisión**: dos enumeraciones nuevas —activación y beneficio— más una restricción CHECK
con una rama por beneficio, que exige los parámetros que ese beneficio necesita y anula
los que no le corresponden.

**Razón**. Es exactamente el patrón que ya usa la tabla de tarifas para sus tres modelos de
cobro. Repetirlo mantiene la coherencia y, sobre todo, mueve la validación al motor: no
existe forma de escribir un convenio con beneficio de porcentaje y un valor en minutos, ni
desde la aplicación ni desde una consulta a mano.

**Sobre las enumeraciones de PostgreSQL**: crear un tipo nuevo y usarlo en la misma
transacción es válido. La restricción que obligó a tratar las enumeraciones aparte en el
arranque de migraciones afecta sólo a `alter type … add value`, es decir a *añadir* valores
a un tipo que ya existe. Aquí se crean tipos nuevos, así que las migraciones normales
bastan y no hay que tocar el arranque.

---

## D5 — Cómo se migran los convenios que ya existen

**Decisión**: la migración traduce cada convenio existente a activación por placa con
beneficio de porcentaje, conservando su valor, y después elimina la columna vieja. Todo
dentro de la misma migración, sin pasos manuales.

**Razón**. FR-006 lo exige sin intervención humana, y es lo correcto: los convenios
existentes son datos de clientes, no un ensayo. Traducir y luego borrar la columna en un
solo paso evita el estado intermedio en el que ambas representaciones coexisten y alguien
tiene que recordar cuál es la buena.

---

## D6 — Si los convenios necesitan versionarse como las tarifas

**Decisión**: no.

**Razón**. Las tarifas se versionan por rango porque un vehículo que entró bajo una tarifa
anterior debe cobrarse con esa. Los convenios no necesitan lo mismo porque el Principio IV
se satisface por otra vía, ya prevista en la especificación (FR-018): cada salida guarda
una **copia** del convenio aplicado —nombre, activación, beneficio y valor descontado—, no
una referencia. Cambiar un convenio mañana no puede alterar lo que ya se cobró, porque lo
cobrado no lo consulta.

Versionarlo además sería duplicar la garantía y pagar dos veces por ella. Se anota aquí
para que la decisión conste y no se vuelva a discutir.

---

## D7 — Cómo se distingue un cambio hecho por soporte

**Decisión**: el convenio guarda quién lo declaró, como ya hace la tarifa. La puerta de
soporte que existe (`comoEstablecimiento`) acota el contexto al establecimiento pero
conserva el identificador del administrador general, así que el dato queda por sí solo.

**Razón**. FR-016b pide que el administrador del local pueda distinguir lo que él declaró
de lo que le declararon. No hace falta una marca especial de "hecho por soporte": basta
guardar el autor, porque un identificador que no pertenece al establecimiento **es** la
marca. Y el asiento de auditoría que la puerta ya escribe cubre el resto.
