# Contratos del dominio

## 1. El campo único

**`resolverPlaca(contexto, placa, ahora)`** — la función que hace posible que un solo campo
sirva para las dos cosas.

Devuelve una de tres respuestas, y quien llama debe distinguirlas antes de hacer nada:

- **entrada** — el vehículo no está adentro. Trae el tipo derivado de la placa, la tarifa
  que se le aplicaría y el convenio que la cubre, para el aviso de confirmación (FR-013).
  Trae también si ese tipo carece de tarifa declarada (FR-007).
- **salida** — ya está adentro. Trae el movimiento, el tiempo transcurrido y el cobro
  calculado con su desglose completo, más los convenios de sello que se pueden confirmar.
- **rechazada** — la placa no tiene forma de placa. Con el motivo, para que se corrija.

Nunca devuelve "no sé". Una placa que no encaja en ningún formato conocido se rechaza
explícitamente; no se clasifica por defecto ni se adivina (FR-004).

## 2. Los dos extremos

**`registrarEntrada(contexto, placa, ahora)`** — crea el movimiento. Deriva el tipo, asigna
el código legible, atribuye la sesión de turno abierta si la hay. Falla si la placa ya está
adentro, traduciendo el choque del motor a un mensaje que se entienda.

**`registrarSalida(contexto, movimientoId, ahora, sellos)`** — cierra el movimiento. Pide
el cobro al cálculo que ya existe, guarda la copia embebida del desglose, y atribuye la
sesión de turno del momento de la salida.

`sellos` son los convenios de sello que quien atiende confirmó. El conteo de aplicaciones
previas lo resuelve esta función consultando el historial —es el consumidor que faltaba
para el contrato de los convenios—, no quien la llama.

**`registrarCortesia(contexto, movimientoId, motivo, ahora)`** — cierra sin cobrar. Exige
motivo, guarda quién la otorgó y **cuánto se habría cobrado**, calculándolo igual que si se
fuera a cobrar. Sin ese número no se puede medir lo que las cortesías cuestan.

## 3. La corrección

**`emitirCorreccion(contexto, movimientoId, importeCorregido, motivo)`**

Autorizada para el administrador del establecimiento y para quien tenga la delegación
vigente. La comprobación vive en la puerta de autorización, no en la pantalla: ocultar un
botón no es control de acceso.

**`otorgarDelegacion` / `revocarDelegacion`** — sólo el administrador. La operación viene de
una lista cerrada con un único valor.

## 4. Los turnos y la ocupación

**`abrirSesion(contexto, turnoId, ahora)`** — copia las horas programadas del turno y
registra la real. Falla si esa persona ya tiene una sesión abierta.

**`cerrarSesion(contexto, sesionId, ahora)`** — registra la hora real de cierre. Se permite
aunque queden vehículos adentro: son del establecimiento, no del turno.

**`sesionAbiertaDe(contexto, usuarioId)`** — a qué sesión atribuir un movimiento. Devuelve
nulo sin error: la ausencia de sesión no impide operar (FR-023).

**`ocupacionActual(contexto)`** — cuántos hay adentro por tipo y cuántos caben. No inventa
un máximo para los tipos sin capacidad declarada.

## 5. El comprobante

**`comprobanteDe(contexto, movimientoId)`** — los datos a imprimir. Sirve igual para la
primera emisión y para reemitir: es una lectura, no cambia nada.

**`marcarComprobanteEmitido(contexto, movimientoId)`** — lo llama la máquina de la taquilla
cuando la impresión salió. Que sea un paso aparte es lo que permite que un fallo de
impresión no deshaga el registro (D2).

**`movimientosSinComprobante(contexto)`** — los pendientes. Sin esta lista el aviso se
pierde en cuanto llega el vehículo siguiente.

## 6. Garantías que deben probarse

- Una placa nunca está adentro dos veces, ni ante dos peticiones simultáneas.
- Un movimiento cerrado no se puede modificar ni borrar, ni siquiera con una consulta
  directa: lo impide el motor, no la disciplina de quien escribe el código.
- El importe que cobra la taquilla coincide con el que arroja el comprobador de convenios
  para la misma permanencia, tarifa y convenios.
- Un movimiento cobrado sigue mostrando el mismo importe y el mismo desglose después de
  cambiar tarifas y convenios.
- Un operario de A no alcanza ningún movimiento de B.
- Un operario sin delegación vigente no emite correcciones, aunque la pantalla se las
  ofreciera.
- Con el establecimiento suspendido no entra nadie y todos los que están adentro pueden
  salir.
