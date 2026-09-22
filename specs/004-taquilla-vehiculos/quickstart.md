# Cómo comprobar que la taquilla funciona

## Antes de empezar

Un establecimiento activo con tarifas declaradas para automóvil y motocicleta. Conviene
tener también un convenio de sello y uno por placa, para el recorrido 3.

```
npx next dev
```

Entrar como operario o como administrador del establecimiento e ir a la taquilla.

## Recorrido 1 — El ciclo, que es la funcionalidad entera

1. **Un dato y ya.** Escribir una placa terminada en dígito y confirmar. **Esperado**:
   entra como automóvil, sin que nadie eligiera el tipo. Sale el comprobante con el código
   legible, la placa, la hora y la tarifa.
2. **La misma placa, otra cosa.** Escribirla de nuevo. **Esperado**: el sistema no ofrece
   otra entrada; reconoce que está adentro y muestra el tiempo y el importe.
3. **La moto.** Repetir con una placa terminada en letra. **Esperado**: entra como
   motocicleta.
4. **La placa imposible.** Escribir `XX`. **Esperado**: se rechaza con un motivo, y no se
   clasifica por defecto.
5. **El duplicado.** Con un carro adentro, intentar registrarlo otra vez desde otra
   pestaña. **Esperado**: se rechaza con un mensaje legible, no con un error del motor.
6. **Cerrar y cobrar.** Confirmar la salida. **Esperado**: el importe coincide con el que
   da el comprobador de convenios para esa misma permanencia.

## Recorrido 2 — Cuando la impresora no coopera

Apagar la impresora, o cancelar el diálogo.

**Esperado**: la entrada **se registra igual**, la pantalla avisa que el comprobante no
salió, y el movimiento aparece en la lista de pendientes. Volver a encenderla y emitirlo
desde ahí: no se crea ningún movimiento nuevo.

Es la prueba que importa más de todas las de esta funcionalidad, porque es la situación
operativa más probable.

## Recorrido 3 — Los convenios, cobrando de verdad

Con un convenio de sello de 60 minutos y otro por placa del 50 %:

1. Sacar un vehículo cuya placa esté en el convenio por placa. **Esperado**: el descuento
   se aplica solo y se nombra.
2. Tocar el botón del convenio de sello. **Esperado**: descuenta y el desglose muestra el
   aporte de cada uno por separado.
3. Con un convenio limitado a una vez al día, sacar el mismo vehículo dos veces el mismo
   día. **Esperado**: la segunda vez no se aplica, y el desglose dice por qué.

## Recorrido 4 — Cortesía y corrección

1. Cerrar una salida como cortesía sin escribir motivo. **Esperado**: no deja.
2. Con motivo. **Esperado**: cierra en cero, guarda quién la otorgó y cuánto se habría
   cobrado, y se distingue de un cobro que dio cero.
3. Como operario, intentar corregir un movimiento cerrado. **Esperado**: no puede.
4. Como administrador, delegarle el permiso a ese operario y repetir. **Esperado**: ahora
   sí, y queda registrado quién lo autorizó.
5. Revocar la delegación. **Esperado**: no puede emitir más, y las que emitió se conservan.

## Recorrido 5 — Turnos y ocupación

Abrir un turno, registrar movimientos, cerrarlo. **Esperado**: cada movimiento queda
atribuido a esa sesión, y la sesión guarda la hora real además de la programada.

Registrar una entrada **sin** ninguna sesión abierta. **Esperado**: se registra igual, sin
turno. No se deja un carro afuera porque nadie abrió una sesión.

Mirar la ocupación. **Esperado**: coincide con los movimientos sin salida, por tipo.

## Recorrido 6 — Que nadie vea lo ajeno

Como operario de **otro** establecimiento, buscar esas placas. **Esperado**: no aparece
nada, ni por listado ni yendo directo al identificador.

## Automatizado

```
npx vitest run
npx next build
```
