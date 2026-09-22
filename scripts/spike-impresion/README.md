# Prueba de impresión térmica

**Estado: listo para correr.** Exige una impresora térmica real. La decisión que
verifica está en `specs/004-taquilla-vehiculos/research.md`, D1.

## Qué se está verificando

Que un navegador pueda mandar un comprobante a una impresora térmica de factura **sin
mostrar un diálogo**, delegando en el sistema operativo, que es lo único que sabe hablar
con las tres conexiones que hay en el campo: cable, red y Bluetooth.

Si esto no funciona, la alternativa es un agente instalado en la máquina de la taquilla, y
eso cambia el despliegue del producto entero.

## Antes de empezar

1. Conectar y encender la impresora, y comprobar que el sistema la ve:

   ```
   lpstat -p -d
   ```

   Si dice `deshabilitada ... Unplugged or turned off`, CUPS paró la cola cuando la
   desconectaron. Se reactiva sin apagar nada:

   ```
   cupsenable POS-80
   ```

2. **Ponerla como predeterminada.** Es imprescindible, no una comodidad: el modo
   silencioso manda a la predeterminada, y si no hay ninguna el navegador hace lo que
   puede. No hace falta `sudo`:

   ```
   lpoptions -d POS-80
   ```

   Se comprueba con `lpstat -d`, que debe nombrarla.

3. **Mirar el ancho del rollo.** El nombre suele delatarlo: una `POS-80` es de 80 mm. En
   Parquivo, Ajustes → Ancho del rollo tiene que coincidir, o el ticket sale angosto en
   mitad del papel.
4. **La primera prueba, SIN modo silencioso.** Con `--kiosk-printing` cada Ctrl+P sale
   directo al papel sin preguntar nada, y si algo está mal se descubre gastando rollo.
   Conviene empezar con Chrome normal, donde la vista previa muestra exactamente lo que
   va a salir: si en la previa se ve bien, ya se puede pasar al modo silencioso.

5. Después sí, arrancar el navegador en modo de impresión silenciosa:

   ```
   google-chrome --kiosk-printing
   ```

   En Windows es el mismo argumento, agregado al final del campo "Destino" del acceso
   directo de Chrome o Edge. Hay que **cerrar todas las ventanas del navegador antes**, o
   la nueva se pega a la sesión que ya estaba corriendo y el argumento no tiene efecto.

## Paso 1 — la página suelta (comprueba el mecanismo)

Abrir `comprobante.html` de esta carpeta y pulsar el botón. Es papel de muestra, sin
sistema de por medio: si esto falla, el problema es la impresora o el navegador, no
Parquivo.

**Y las muestras del ticket de verdad**, que salen del mismo código que imprime la
taquilla, así que lo que se ve en pantalla es exactamente lo que sale por el papel. Hay
dos juegos, uno por ancho de rollo; se usa el que corresponda a la impresora:

- `80mm-ticket-entrada.html` — el resguardo que el cliente se lleva
- `80mm-ticket-salida.html` — el recibo, con permanencia, desglose y total pagado
- `80mm-ticket-bicicleta.html` — el mismo ticket con "Ficha 7" en vez de una placa

Y los mismos tres con prefijo `58mm-`. Mirar el mismo ticket en los dos anchos es la
forma más rápida de ver cuál corresponde al rollo que hay puesto.

Se regeneran con `npx tsx scripts/muestra-ticket.ts` si el diseño cambia. Conviene
imprimir los tres: es la forma más barata de ver si el ancho, el cuerpo y la marca del pie
quedan legibles antes de ponerse a registrar vehículos de prueba.

## Paso 2 — el ticket de verdad (comprueba el producto)

1. En Parquivo, entrar a **Ajustes** y encender **"Imprimir el ticket de entrada"** y
   **"Imprimir el recibo de salida"** —se deciden por separado—. Ahí mismo está **Ancho del
   rollo**: dejarlo en 58 mm salvo que el rollo sea de 80.
2. Ir a **Taquilla**, escribir una placa y registrar la entrada. El ticket debería salir
   solo.
3. Buscar la misma placa y cobrarla. Debería salir el recibo, con el desglose.
4. Registrar otra entrada y sacarla con **"Salir sin cobrar"**, escribiendo un motivo. El
   papel debe decir SIN COBRO y el motivo.

Si la impresión automática no sale, el botón **"Imprimir ticket"** aparece igual junto al
mensaje de confirmación, y los que no salieron quedan en **"Tickets sin imprimir"**, arriba
del campo de placa, con su botón para reintentar.

## Qué mirar, y qué significa cada cosa

| Comprobación | Si falla |
|---|---|
| ¿Salió sin diálogo? | Un diálogo por vehículo frena la fila, que es lo que el Principio III prohíbe. Sin esto la opción no sirve para la taquilla |
| ¿El ancho del rollo se respetó, sin recortes a los lados? | Probar el otro ancho en Ajustes. Si ninguno cuadra, hay que ajustar el tamaño de página |
| ¿El texto se lee, con el tamaño puesto? | El papel de 58 mm es angosto; puede hacer falta subir el cuerpo o acortar campos |
| ¿La placa se lee de lejos? | Es lo que el cliente mira; si no se distingue, hay que agrandarla |
| ¿El desglose del cobro cabe sin partirse? | Si se parte feo, se recorta a total y descuento |
| ¿La marca del pie —CQS LABS, el contacto— se lee y no se parte mal? | Se ajusta el cuerpo o el corte de línea en `comprobante-html.ts` |
| ¿El corte de papel quedó donde debía? | Es cosmético, pero un comprobante que hay que cortar a mano se ve mal |
| ¿Reimprimir desde "Tickets sin imprimir" saca lo mismo, con el sello REIMPRESIÓN? | Si dice algo distinto del original, es un fallo grave y hay que parar |

## Lo que esta prueba NO cubre

Sólo se está probando **cable**. Red y Bluetooth quedan pendientes de tener esas
impresoras delante. El diseño no distingue entre las tres —para el navegador todas son "la
impresora predeterminada del sistema"—, así que lo esperable es que funcionen igual, pero
esperable no es comprobado.

## Después de correrlo

Escribir el resultado en `specs/004-taquilla-vehiculos/research.md`, bajo D1, con lo que
funcionó y lo que no. **Si falló lo primero de la tabla, parar y reevaluar el agente
local.**
