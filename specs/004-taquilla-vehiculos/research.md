# Investigación: taquilla de vehículos

**Fase 0.** El stack no se investiga: está decidido y en producción. Lo que sigue son las
decisiones que la especificación deja abiertas, empezando por la única con riesgo técnico
real.

---

## D1 — Cómo sale el comprobante impreso

**El problema, acotado por la realidad del campo.** Los parqueaderos usan impresoras
térmicas de factura conectadas de tres maneras según el local: cable USB, red con
dirección propia, y Bluetooth.

**El hallazgo que decide casi todo**: las tres obligan a lo mismo. Una impresora de red en
el local tiene una dirección privada, así que desde un servidor de fuera es tan
inalcanzable como una conectada por cable. **El trabajo tiene que salir desde la máquina de
la taquilla.** Eso elimina de entrada toda una familia de soluciones —imprimir desde el
servidor abriendo un socket contra la impresora— que sólo habría funcionado en los locales
de red y habría dejado tirados a los otros dos.

Quedan dos caminos, y los dos corren en la máquina de la taquilla.

**Decisión: imprimir por el sistema operativo, desde el navegador.**

La página genera el comprobante como un documento del ancho del rollo y se lo entrega al
sistema de impresión de la máquina. El sistema operativo ya sabe hablar con las tres
conexiones —es su trabajo— y la impresora ya está instalada allí, porque el local la usa
para otras cosas.

**Por qué éste y no un agente propio.** Un servicio local que hable el protocolo de las
impresoras directamente daría control total del formato y podría imprimir sin diálogo. A
cambio: es un producto aparte que hay que empaquetar para Windows, firmar, distribuir,
actualizar y depurar por teléfono con alguien que no sabe qué es un servicio. Y habría que
implementar tres transportes distintos —USB, red y Bluetooth— que es exactamente el trabajo
que el sistema operativo ya hizo. Para un producto que apenas está saliendo, montar un
canal de distribución de software de escritorio antes de tener el primer cliente es la
decisión que hunde el cronograma.

**El diálogo de impresión es el problema real de esta opción**, y hay que decirlo: un
cuadro de diálogo por cada vehículo frena la fila, que es justo lo que el Principio III
prohíbe. Los navegadores basados en Chromium admiten un modo de impresión silenciosa que
manda directo a la impresora predeterminada; se activa al arrancar el navegador. Eso
convierte el despliegue en "configurar el navegador de la taquilla una vez", que un local
sí puede hacer, en lugar de "instalar y mantener un programa".

**Lo que hay que verificar antes de comprometerse** (spike, primera tarea del plan): que el
modo silencioso funcione contra una térmica real de las tres conexiones, y que el ancho del
rollo se respete. Si el spike falla, la decisión se revisa aquí, no en medio de la
implementación.

### Resultado del primer ensayo (22/08/2026) — el supuesto que falló

**Lo que se probó**: una térmica de cable, en la máquina de desarrollo, que es Linux.

**No llegó a probarse la impresión**, y el motivo importa más que el resultado. D1 dice que
"el sistema operativo ya sabe hablar con las tres conexiones —es su trabajo— y la impresora
ya está instalada allí". La segunda mitad de esa frase es un SUPUESTO, y en esta máquina era
falso: la cola existía con el nombre `POS-80` pero apuntando a un PPD de plóter HP
DesignJet, con tamaño por defecto A4 y opciones de emulación PCL. CUPS generaba páginas A4
en lenguaje de plóter y se las mandaba a una térmica ESC/POS, que las escupía como texto
sin sentido. Ni una factura, muchas hojas de basura.

Y no había con qué arreglarlo: de los 16.914 modelos que ofrece `lpinfo -m` ninguno es
ESC/POS. Los paquetes `printer-driver-*` instalados son de láser e inkjet. **En Linux, estas
térmicas genéricas no traen driver de serie.**

**Qué cambia y qué no.**

- **D1 NO se invalida.** Lo que falló no es imprimir desde el navegador: es que el sistema
  no tenía cómo hablarle a la impresora. Con un driver correcto instalado, el camino de D1
  sigue siendo el mismo y sigue siendo el más barato.
- **Sí cambia el despliegue**, y hay que decirlo en el manual: "la impresora ya está
  instalada" vale en Windows, donde el fabricante entrega un driver y el equipo la ve como
  una impresora normal —y Windows es lo que hay en las casetas—, pero **no** vale en Linux.
  Instalar la impresora pasa a ser un paso explícito de la puesta en marcha, no un supuesto.
- **La próxima prueba debería hacerse en Windows**, que es donde va a correr el producto. Lo
  que se aprenda en Linux sobre drivers no se traslada.

**Lo que sí quedó probado**, porque el ensayo lo destapó: un fallo de tiempos hacía que
`print()` saliera sobre un marco vacío y el navegador cayera a imprimir la aplicación
entera. Estaba en el código de Parquivo, era real, y se corrigió: el contenido se carga
antes de insertar el marco, sólo se imprime un documento con la marca del ticket, y
`print()` se llama exactamente una vez.

**Alternativas consideradas**: imprimir desde el servidor (imposible para USB y Bluetooth,
y para la red privada); agente local propio (costo de distribución desproporcionado hoy);
generar un PDF y que la persona lo imprima a mano (dos pasos por vehículo, inaceptable en
la ruta crítica).

---

## D2 — La impresión no puede estar en el camino del registro

**Decisión**: registrar la entrada y emitir el comprobante son dos pasos separados. El
movimiento se guarda primero y se confirma; el comprobante se intenta después y su fallo
se informa sin deshacer nada.

**Razón**. Lo exige la especificación —un fallo de impresión no impide registrar la
entrada— pero además es lo único que funciona: la impresión ocurre en la máquina del
cliente, donde el servidor no puede saber si salió. Atarlas obligaría a esperar una
confirmación que puede no llegar nunca, con el vehículo en la puerta.

El movimiento lleva entonces un estado de comprobante —emitido o pendiente— que empieza en
pendiente y pasa a emitido cuando la máquina confirma. Un movimiento pendiente no es un
error: es trabajo por hacer, y por eso hay que poder listarlos (FR-007g).

---

## D3 — Cómo se guarda "lo que se cobró" sin que el histórico dependa de nada

**Decisión**: el movimiento cerrado guarda una copia embebida de la tarifa y de los
convenios aplicados, con los valores tal como estaban al cobrar, no identificadores que
apunten a filas vivas.

**Razón**. El Principio IV lo exige literalmente, y la razón es práctica: un reporte de
ingresos que cambia retroactivamente porque alguien editó una tarifa es un reporte
inservible, y en una disputa con un cliente el histórico es la única prueba.

Guardar identificadores no bastaría ni siquiera con las tarifas versionadas: los convenios
NO se versionan —se decidió así al especificarlos, precisamente porque esta copia iba a
existir— así que un convenio editado mañana cambiaría la explicación de un cobro de ayer.

**Qué se copia**: el importe base, el desglose completo tal como se le mostró a quien
atendió, y los datos de la tarifa que se usó. Es decir, lo que hace falta para reconstruir
la explicación sin consultar nada más.

---

## D4 — Que una placa no esté adentro dos veces

**Decisión**: una restricción única parcial en el motor —una sola fila abierta por placa y
establecimiento— y no un bloqueo de aplicación.

**Razón**. Es la misma clase de garantía que ya protege "una placa, un convenio por
establecimiento", y funciona por la misma razón: el motor la impone siempre, incluso ante
dos peticiones simultáneas, sin depender de que nadie recuerde comprobar antes.

El bloqueo de aviso que el proyecto ya usa para la numeración correlativa no aplica aquí.
Aquél existe porque hay que LEER el último número y escribir el siguiente, y entre lo uno y
lo otro cabe otra transacción. Acá no hay que leer nada: se intenta insertar y el motor
acepta o rechaza. Un bloqueo sería más lento y más frágil para la misma garantía.

**Consecuencia**: el choque de unicidad hay que traducirlo a un mensaje legible, como ya se
hace con las placas de convenio. Que el operario vea "ese carro ya está adentro" y no un
error del motor.

---

## D5 — Dónde vive la clasificación por placa

**Decisión**: un módulo puro nuevo, junto a la normalización de placas que ya existe, con
la regla del último carácter y una tabla que lleva del resultado al tipo del catálogo.

**Razón**. La constitución pide que la regla viva aislada y probada, no dispersa en la
interfaz, y que pueda evolucionar sin tocar el flujo de registro. Ya hay un módulo de
placas con `normalizarPlaca` y `esPlacaPlausible`, escrito para los convenios y comentado
como "lo usa el dominio y también la taquilla": es su sitio natural.

**Lo que falta y hay que decidir**: la regla da "carro" o "moto", pero el sistema trabaja
con tipos del catálogo, que se identifican por código —`automovil`, `motocicleta`—. La
correspondencia entre el resultado de la regla y el código del catálogo es el único punto
donde ambos mundos se tocan, y debe estar en un solo lugar para que cambiar la regla no
obligue a buscarla por todas partes.

---

## D6 — Cómo se delega el permiso de corregir

**Decisión**: una tabla de delegaciones por establecimiento, con quién otorga, a quién,
cuándo y qué operación; y la comprobación dentro de la puerta de autorización que ya
existe, no repartida por las pantallas.

**Razón**. La constitución 1.1.0 lo admite pero lo acota con cuatro reglas, y las cuatro se
cumplen por construcción con esta forma: la operación es un valor de una lista cerrada, el
registro de quién y cuándo son columnas, la revocación es borrar la fila o marcarla, y el
ámbito lo impone la misma política de aislamiento que protege el resto.

Que la comprobación viva en la puerta de autorización y no en cada pantalla es lo que
impide que la delegación se convierta en "ocultar un botón", que la constitución prohíbe
expresamente.

---

## D7 — Qué identifica un movimiento para el cliente

**Decisión**: un código legible con la sigla del establecimiento y un correlativo, como ya
tienen los parqueaderos y las cuentas.

**Razón**. Lo pide la especificación y responde a una preferencia ya establecida del
proyecto. La razón operativa es concreta: alguien va a tener que leer ese código en voz
alta por teléfono, o escribirlo a mano cuando el papel térmico se borre —que se borra, es
lo que hace el papel térmico—. Un identificador largo y aleatorio no sirve para eso.

Generar un correlativo SÍ exige leer el último y escribir el siguiente, así que aquí el
bloqueo de aviso que el proyecto ya usa es la herramienta correcta, a diferencia de D4.
