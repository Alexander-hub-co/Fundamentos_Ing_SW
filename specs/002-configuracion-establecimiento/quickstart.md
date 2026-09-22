# Guía de verificación — F2

Cómo comprobar que la configuración del establecimiento funciona. Ninguno de estos pasos necesita un
vehículo ni un movimiento: es el criterio SC-010 y también la forma de saber que F2 y F3 quedaron
bien separadas.

## Antes de empezar

```bash
npm run db:migrate         # aplica el esquema y siembra el catálogo de tipos
npm run db:migrate:test    # la base de pruebas va aparte
npm run dev
```

Se entra como administrador de un establecimiento. Si sólo existe la cuenta de plataforma, se crea
una desde `/cuentas` y se le asigna un parqueadero.

## 1. El calculador, sin tocar la aplicación

Es la pieza de más riesgo, así que se verifica primero y aislada:

```bash
npx vitest run --project unit
```

Los casos que deben pasar son los ejemplos de la especificación, con los números de
[spec.md](spec.md) — 5 minutos que cobran la mínima, 250 que topan en la plena, 31 minutos de bici
que cobran dos intervalos, y la bicicleta que atraviesa la noche cerrada y paga $4.500.

Si algo falla aquí, no tiene sentido seguir: todo lo demás se apoya en esto.

## 2. Declarar una tarifa y ver que se versiona

En `/configuracion/tarifas`, declarar una tarifa de automóvil. Guardar. Cambiar el valor por minuto
y guardar otra vez.

**Qué comprobar**: la pantalla muestra la nueva como vigente y la anterior con su periodo cerrado.
La anterior no desapareció — es lo que permitirá cobrar mañana un vehículo que entró hoy.

## 3. Comprobar el cálculo desde la configuración

La pantalla de tarifas ofrece probar con tiempos de ejemplo. Introducir una entrada y una salida y
verificar que el importe viene con su desglose: minutos, jornadas y qué tope se aplicó.

**Qué comprobar**: el desglose explica la cifra. Si sólo muestra un número, falta lo que permite al
operario responderle a un cliente.

## 4. Horario y jornada

En `/configuracion/horario`, declarar de 7:00 a 20:00 de lunes a sábado, sin cobrar horas cerradas.

**Qué comprobar**: la pantalla advierte que el horario afecta al cobro. Después, probar en el
calculador una bicicleta que entra a las 19:30 y sale a las 7:10 del día siguiente: deben verse dos
jornadas y ninguna cobrada por las horas cerradas.

Cambiar a 24 horas y repetir: ahora las jornadas se cortan a medianoche.

## 5. Turnos

En `/configuracion/turnos`, crear "Mañana" de 7:00 a 15:00 de lunes a viernes y asignar a alguien.
Crear "Nocturno" de 22:00 a 6:00.

**Qué comprobar**:
- El calendario semanal muestra quién cubre cada día.
- Consultando las 2:00 de un martes, el turno vigente es el nocturno que arrancó el lunes.
- Si el horario de atención deja horas sin ningún turno, aparece un aviso — y **deja guardar
  igual**: es aviso, no impedimento.
- El administrador puede asignarse a sí mismo.

## 6. Equipo

Desde la cuenta del administrador del establecimiento, dar de alta un operario en `/equipo`.

**Qué comprobar**: nace con código legible bajo la sigla del establecimiento, con contraseña
temporal, y puede entrar. El formulario no ofrece el rol de administrador general.

Comprobar también que **sobre la propia cuenta no aparecen acciones**: nadie puede bloquearse ni
degradarse a sí mismo, porque quedaría fuera de su local sin quien lo restituya.

Una contraseña de menos de diez caracteres debe rechazarse, tanto al crear como al restablecer.

## 7. Convenios

En `/configuracion/convenios`, registrar uno con 20% y agregarle una placa. Después usar
**Comprobar una placa** con esa misma placa escrita de otra forma —`abc 123`, `ABC-123`—.

**Qué comprobar**: las tres formas dan el mismo resultado, porque la placa se guarda normalizada.
Una placa sin convenio dice que se le cobra tarifa plena. Al vencer el convenio, la placa deja de
tener descuento pero el convenio sigue en la lista: hay que poder explicar un cobro pasado.

## 8. Aislamiento

```bash
npx vitest run --project aislamiento
```

Debe haber una prueba negativa por cada tabla nueva. Y a mano: entrar como administrador del
establecimiento A y pedir por URL una tarifa de B — la respuesta debe ser idéntica a la de un
recurso inexistente, y en `/panel` del administrador general debe aparecer el intento registrado.

## 9. Suspensión

Desde la plataforma, suspender el establecimiento. Volver a entrar como su administrador.

**Qué comprobar**: toda la configuración se puede consultar y ninguna se puede modificar.

## Todo junto

```bash
npm run typecheck && npm run lint && npm test && npx next build
```

Al cierre de F2 esto da **378 pruebas en verde** y **23 rutas**.

## Cuentas para probar

- Administración de la plataforma: `admin@parquivo.co`
- Administración de un establecimiento: `admin.centro@parquivo.co`

Las pantallas de configuración son del establecimiento: entrando como administrador general
redirigen al panel, que es lo esperado.
