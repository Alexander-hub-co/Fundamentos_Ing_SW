# Guía del operario

**Parquivo** · Quien atiende la taquilla

---

## La taquilla tiene un solo campo

No hay que elegir entre «registrar entrada» y «registrar salida». Se escribe la
placa, se pulsa Enter, y el sistema decide cuál de las dos es según si ese
vehículo ya está adentro.

Tampoco hay que decir si es carro o moto. El sistema lo deduce del último
carácter de la placa: si termina en dígito es carro, si termina en letra es
moto.

Da igual cómo se escriba. `abc 123`, `ABC-123` y `abc123` son el mismo vehículo.

---

## Registrar una entrada

1. Escriba la placa y pulse Enter.
2. El sistema muestra el tipo de vehículo y la tarifa que se va a aplicar. Si
   esa placa tiene un convenio, se lo dice por su nombre.
3. Confirme.
4. Sale el comprobante.

**Si la placa no tiene un formato reconocible**, el sistema la rechaza y le dice
por qué. No adivina el tipo: prefiere que usted revise a cobrar mal.

**Si el tipo de vehículo no tiene tarifa declarada**, el sistema se lo advierte
antes de confirmar, porque a la salida no va a poder cobrarle.

**Si el vehículo ya está adentro**, el sistema no le ofrece una entrada nueva:
pasa directo a la salida, con el tiempo que lleva y lo que se le cobra.

**Si se pasó de la capacidad declarada**, el sistema le avisa pero no se lo
impide. Usted está viendo el vehículo y sabe mejor que el sistema si cabe.

---

## Cobrar una salida

1. Escriba la placa y pulse Enter.
2. El sistema calcula la permanencia y el importe, y aplica solos los convenios
   que se activan por placa.
3. Si hay convenios que se activan por sello, aparece un control por cada uno,
   con el nombre del comercio. Marque el que traiga el tique del cliente y el
   total se recalcula en el acto.
4. Revise el desglose: el importe base, cada convenio con su efecto, los que no
   se aplicaron y por qué, y el redondeo.
5. Cobre y confirme.

**Mientras el vehículo está adentro** usted puede consultar en cualquier momento
cuánto lleva y cuánto pagaría si saliera ahora.

**Para dejar salir sin cobrar** hay que escribir un motivo. Queda registrado
quién lo autorizó y cuánto se habría cobrado. No es desconfianza: es lo que
permite defender la decisión cuando alguien pregunte.

**Si la impresora no responde**, el movimiento queda registrado igual y el
comprobante pasa a la lista de pendientes. No se detiene la fila por una
impresora.

---

## Bicicletas

Las bicicletas no tienen placa, así que se identifican con un **número de
ficha** — que es el tique impreso, donde en lugar de la placa dice «Ficha 3».

### Recibir una bicicleta

1. Abra la recepción de bicicletas.
2. Escriba el nombre, el celular y la cédula de quien la deja.
3. El sistema asigna solo el número de ficha que sigue.
4. Confirme. Sale el tique con el número bien grande.

La cédula no es burocracia. Es lo que permite devolverle la bicicleta a alguien
que perdió el papel. Si el cliente pregunta para qué se le pide, la pantalla se
lo explica para que usted pueda decírselo.

**Si ya se cumplió la capacidad de bicicletas**, el sistema rechaza la recepción
y le dice que no hay cupo.

### Devolver una bicicleta

Escriba el número de ficha en el mismo campo de la taquilla. El sistema
distingue solo si es una ficha o una placa.

**Si el cliente perdió el tique**, busque el movimiento por la cédula que se
registró al recibir la bicicleta. Se cierra igual, queda constancia de que se
cerró sin tique, y **no se le cobra nada adicional**: el tique es papel impreso
y no hay nada que reponer.

---

## Su turno

**Abra el turno al llegar y ciérrelo al irse.** El sistema guarda la hora real
de apertura y de cierre, además de la programada. Casi nunca coinciden, y esa
diferencia es justamente lo que sirve para revisar.

Los movimientos que atienda quedan atribuidos a su turno. Una entrada y su
salida pueden pertenecer a turnos distintos: eso es normal, y así queda
registrado.

**Puede cerrar el turno aunque queden vehículos adentro.** Los vehículos son del
establecimiento, no de su turno.

**Si nadie abrió turno, se puede atender igual.** El movimiento queda sin turno
asociado. No se deja un carro afuera porque nadie fichó.

---

## Cuando algo no funciona

| Qué ve | Qué pasa | Qué hacer |
|---|---|---|
| «La placa no tiene un formato válido» | El sistema no reconoce el patrón | Revise que esté bien escrita. Si el vehículo tiene una placa fuera de lo común, avise al administrador |
| «Este tipo de vehículo no tiene tarifa» | Nadie declaró cuánto cobrarle | Puede registrar la entrada, pero avise al administrador antes de que ese vehículo salga |
| «El establecimiento está suspendido» | La cuenta del parqueadero tiene un problema | No se pueden registrar entradas nuevas. Las salidas sí: los vehículos que ya están adentro pueden salir y pagar |
| «No hay cupo de bicicletas» | Se llegó a la capacidad declarada | Hay que esperar a que salga una. Si pasa seguido, el administrador puede subir la capacidad |
| El comprobante no salió | La impresora no respondió | El movimiento quedó registrado. El comprobante está en pendientes y se puede reimprimir |
