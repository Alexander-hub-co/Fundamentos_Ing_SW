# Guía del administrador

**Parquivo** · Quien gestiona un establecimiento

Esta guía cubre lo que solo usted puede hacer. Para atender la taquilla, vea la
[guía del operario](guia-del-operario.md): usted también puede hacer todo lo que
allí se describe.

---

## Antes de abrir: lo mínimo

Hay tres cosas que tienen que estar declaradas para que la taquilla funcione.

1. **Una tarifa vigente por cada tipo de vehículo que vaya a recibir.** Sin
   tarifa se puede registrar la entrada, pero no se puede cobrar la salida.
2. **El horario de atención**, si el cobro depende de él.
3. **Los operarios** que van a atender, con sus turnos.

---

## Tarifas

### Los dos modelos de cobro

Elija uno por cada tipo de vehículo.

**Por minuto.** Se declaran tres valores: la tarifa por minuto, la tarifa
mínima y el tope. Si el resultado queda por debajo de la mínima, se cobra la
mínima.

**Por intervalos.** Se declaran tres valores: cuánto dura el intervalo, cuánto
vale y el tope. Cualquier fracción de intervalo cobra el intervalo completo —
quince minutos de una hora cobran la hora.

### Reglas que el sistema no le va a dejar romper

- La tarifa mínima no puede superar a la plena.
- El intervalo no puede ser cero ni negativo.
- Una tarifa que estuvo vigente **no se borra**. Se cierra su vigencia y se
  activa la nueva.

Esto último no es rigidez: es lo que permite que un cobro de hace tres meses se
siga pudiendo explicar con la tarifa que regía ese día.

### Cambiar una tarifa

Declare los valores nuevos. El sistema cierra la vigencia de la versión
anterior y activa la nueva desde ese momento. Los movimientos ya cerrados no se
tocan: cada uno guarda su propia copia de lo que se le aplicó.

---

## Horario de atención

Se puede declarar de tres formas: abierto todo el día, con jornadas, o cerrado.

- **Los horarios pueden cruzar la medianoche.** Un parqueadero que abre a las
  diez de la noche y cierra a las seis de la mañana se declara tal cual.
- **Se pueden declarar días de cierre completo.**
- **El horario se interpreta en la hora de Colombia.** No hay que elegir zona
  horaria.

---

## Convenios

Un convenio es un acuerdo con un comercio vecino: quien compre allá paga menos
—o no paga— por el parqueadero.

### Cómo se activa

**Por placa.** Se declara qué placas cubre el convenio. El sistema lo aplica
solo al cobrar la salida, sin que el operario haga nada.

**Por sello.** El cliente trae el tique sellado por el comercio. El operario ve
un control con el nombre de ese comercio y lo marca. El total se recalcula en el
acto.

### Límites

Un convenio puede declarar cuántas veces al día se aplica a una misma placa. El
sistema lleva la cuenta contra el día calendario del establecimiento y deja de
aplicarlo cuando se agota.

### Por qué el desglose importa

El operario ve, y el cliente puede pedir, el detalle completo: el importe base,
cada convenio con su efecto, **los que no se aplicaron y por qué**, y el
redondeo. Esa última parte es la que evita discusiones: no es lo mismo «no se le
aplicó» que «ya lo usó hoy dos veces».

---

## Operarios y turnos

### Dar de alta un operario

Usted puede crear cuentas de operario en **su** establecimiento, y en ninguno
otro. También puede bloquearlas, desbloquearlas, restablecer su contraseña y
darlas de baja.

Puede además nombrar administrador a otra persona de su establecimiento — su
encargado de confianza, sin tener que llamar a nadie. Lo que **no** puede es
crear cuentas de administrador general ni cuentas fuera de su establecimiento.
La facultad amplía el rol dentro del local, nunca el ámbito.

### Turnos

Declare los turnos con su horario. Un turno puede extenderse fuera del horario
de atención sin que el sistema se queje: es lo normal que alguien entre media
hora antes a abrir y contar la caja.

El cuadrante le muestra quién trabaja cada día y le avisa si hay horas de
atención sin nadie asignado.

---

## Reportes

Usted ve el movimiento de **su** establecimiento: cuánto entró, por turno, por
operario y por periodo.

Un operario, en cambio, solo ve **lo suyo**: cuánto hizo en sus propios turnos.
No es una cortesía de la interfaz, es una regla que se evalúa en el servidor.

---

## Si el establecimiento queda suspendido

Cuando la cuenta del establecimiento pasa a suspendida:

- **No se pueden registrar entradas nuevas.**
- **Las salidas sí funcionan.** Los vehículos que ya están adentro pueden salir
  y pagar. Nadie se queda encerrado por un problema de facturación.
- **El historial no se toca.** Suspender o dar de baja un establecimiento no
  destruye ningún movimiento.
