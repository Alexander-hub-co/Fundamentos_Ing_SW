# Investigación — Taquilla de bicicletas y fichas

Tres decisiones que hay que cerrar antes de escribir código. Ninguna es de impresión: eso
ya se decidió en F3 y se reutiliza tal cual.

---

## D1 — Cómo se garantiza que dos operarios no entreguen la misma ficha

**El problema.** Dos taquillas reciben bicicletas en el mismo segundo. Las dos consultan
"¿cuál es la primera ficha disponible?", las dos leen "la 7", y las dos la entregan. El
cliente que vuelve con la ficha 7 se lleva la bicicleta de otro.

Es el mismo problema que la placa duplicada, y el proyecto ya lo resolvió una vez, así que
la respuesta empieza por ahí en vez de inventar otra.

**Lo que ya existe.** `movimiento_una_placa_adentro` es un índice único parcial sobre
`(parqueadero_id, placa) where salida_en is null`. Su comentario dice exactamente por qué:
"comprobar y después insertar dejaría una rendija entre lo uno y lo otro". La garantía no
está en el código sino en la base, así que sobrevive a cualquier código futuro.

**Decisión: la misma técnica, más una elección de dónde vive el estado.**

1. **La garantía** es un índice único parcial sobre `(parqueadero_id, ficha_id) where
   salida_en is null`. Dos recepciones simultáneas de la misma ficha chocan en la base; la
   segunda falla y se traduce a "esa ficha ya está entregada".
2. **La elección** de cuál ficha entregar usa `FOR UPDATE SKIP LOCKED` al buscar la primera
   disponible. Sin esto, la segunda transacción escogería la misma ficha y fallaría contra
   el índice; con esto la salta y toma la siguiente, así que el operario no ve ningún error
   y la fila no se detiene.

**El punto fino: "entregada" NO se guarda.** La tentación es poner en la ficha un estado con
cuatro valores —disponible, entregada, perdida, dada de baja— y mantenerlo. Se descarta:
"entregada" es *derivable* de tener un movimiento abierto, y guardar algo derivable crea la
posibilidad de que las dos versiones difieran. El día que difieran, una ficha quedará
entregada para siempre sin bicicleta, o disponible con una bicicleta encima.

Así que la ficha guarda sólo lo que NO se puede derivar: `activa`, `perdida`,
`dada_de_baja`. "Entregada" se pregunta. El vocabulario de cuatro estados de la
especificación se conserva de cara al usuario, que es donde tiene sentido; simplemente se
calcula en vez de almacenarse.

**Alternativas consideradas**: un `pg_advisory_xact_lock` por establecimiento, como el que
ya se usa para los correlativos —funciona, pero serializa TODAS las recepciones del local y
acá no hace falta, porque el índice ya da la garantía—; y comprobar en la aplicación antes
de insertar, que es precisamente la rendija que el índice cierra.

---

## D2 — Cómo se guarda una cédula sin convertir esto en un archivo de datos personales

**El problema.** La clarificación decidió pedir cédula y teléfono al recibir la bicicleta,
para poder devolverla cuando el cliente pierde el tarjetón. Eso es tratamiento de datos
personales, y en Colombia cae bajo la Ley 1581 de 2012: hay que decir para qué se piden,
usarlos sólo para eso, y no conservarlos más de lo necesario.

**Lo que ya existe y se reutiliza.** El sistema ya trata datos personales en dos sitios y
con dos mecanismos distintos, y los dos aplican acá:

- `anonimizarCuenta` reemplaza los campos personales de una cuenta conservando el registro,
  porque el historial no se puede borrar (Principio IV).
- `purgarAuditoriaVencida` borra `intento_login` y `acceso_denegado` pasado
  `RETENCION_MESES`, con el argumento explícito de "evitar acumular indefinidamente
  información de personas".

**Decisión: la cédula y el teléfono son columnas del movimiento, y se purgan como la
auditoría, pero SIN borrar el movimiento.**

- Viven en `movimiento`, no en una tabla de clientes. Es deliberado: una tabla de clientes
  sería una entidad con vida propia que habría que mantener, y no se necesita ninguna.
- Al pasar `RETENCION_MESES` desde el cierre, las tres columnas personales —cédula,
  teléfono y la nota de la bicicleta— se ponen en nulo. El movimiento y su cobro se
  conservan intactos, porque son el historial contable que el Principio IV protege y que los
  reportes de F5 necesitan.
- La nota de la bicicleta entra en la purga aunque parezca inocua: "negra, marca Trek,
  calcomanía de la universidad" describe a una persona tanto como su teléfono.

**El conflicto que hay que nombrar.** Purgar la cédula rompe la propuesta de teléfono
conocido para clientes que llevan más de `RETENCION_MESES` sin volver. Es correcto que se
rompa: alguien que no vuelve en un año no es un cliente cuyos datos haya razón de conservar.
La consecuencia práctica es que ese cliente vuelve a dar su teléfono una vez, y eso no es un
defecto sino la finalidad cumpliéndose.

**Lo que NO se hace, y por qué**: no se cifra ni se convierte en resumen la cédula. Hay que
poder buscar por ella —es su única razón de ser— y un resumen permitiría buscar pero
volvería imposible mostrarle al operario a quién corresponde. Cifrarla con clave en el mismo
servidor no agrega protección real frente al riesgo que importa acá, que es la acumulación,
y la acumulación se ataca con la purga. Tampoco se pide correo, dirección ni nombre: sólo
lo que la finalidad declarada necesita.

**Lo que se agrega y es nuevo**: una frase en la pantalla de recepción que diga para qué se
piden los datos, de modo que el operario pueda decírselo al cliente. Es lo mínimo que la ley
pide y cuesta un párrafo.

---

## D3 — Si el número de ficha cabe en el campo único de la taquilla

**El problema.** El Principio III fija que la taquilla resuelve con un solo campo. Si las
bicicletas necesitan otra pantalla, ese principio se rompe la primera vez que se extiende.

**El dato que lo decide.** `clasificarPorPlaca` acepta placas de 5 a 8 caracteres
alfanuméricos, y toda placa colombiana lleva letras: tres para carros y motos. Un número de
ficha, en cambio, es sólo dígitos y rara vez pasa de tres.

**Decisión: el mismo campo, con una regla que no puede confundirse.** Lo que se escribe
compuesto **únicamente por dígitos** es un número de ficha. Lo que lleva alguna letra es una
placa. No hay solapamiento posible, porque una placa sin letras no existe.

**Pero la recepción de una bicicleta NO cabe en el campo, y hay que decirlo.** Escribir "7"
puede significar "devuelvo la ficha 7", y eso el campo lo resuelve. No puede significar
"recibo una bicicleta", porque recibir exige cédula y teléfono, que no caben en un campo de
una línea.

Entonces el reparto queda así, y es honesto con el principio en vez de forzarlo:

- **Devolver** —la operación frecuente, la que ocurre con fila— va por el campo único, con
  un dato y Enter. Igual que una placa.
- **Recibir** es una acción explícita con su formulario, porque necesita datos que ninguna
  pantalla puede adivinar.

El Principio III protege la ruta crítica, no la simetría. La ruta crítica de una bicicleta
es la devolución, y ésa queda en un dato.

**Alternativa considerada**: prefijar las fichas al escribirlas, como `F7`, para poder
recibir y devolver desde el campo. Se descarta porque obliga a quien atiende a escribir un
carácter que no está impreso en el tarjetón —el tarjetón dice "7"— y porque de todos modos
no resuelve dónde se escriben la cédula y el teléfono.
