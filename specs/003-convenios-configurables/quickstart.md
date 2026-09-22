# Cómo comprobar que esto funciona

**Alcance**: historias 1 y 2. El asistente de IA (historia 3) no forma parte de esta
entrega, así que no hay nada suyo que comprobar.

## Antes de empezar

Hace falta PostgreSQL corriendo y el establecimiento de pruebas con **al menos una tarifa
declarada**: un convenio descuenta sobre un cobro que tiene que existir primero.

```
npx next dev
```

Entrar como administrador de establecimiento e ir a Convenios.

## Recorrido 1 — Declarar los cuatro acuerdos reales

Declarar uno por uno y comprobar que la lista los muestra con su activación y su beneficio
en palabras:

| Nombre | Activación | Beneficio | Valor |
|---|---|---|---|
| Fruver La Esquina | sello | minutos gratis | 60 |
| Carnicería | sello | minutos gratis | 30 |
| Cliente frecuente | placa | porcentaje | 50 |
| Mensualidad Torre B | placa | sin cobro | — |

**Esperado**: los cuatro quedan vigentes. A los dos de placa se les puede agregar placas; a
los de sello, no.

**Comprobar además que el sistema se niega** cuando corresponde: guardar un porcentaje sin
valor, guardar un límite diario de cero, y dejar el límite sin elegir. Los tres deben
fallar con un mensaje que diga qué falta, no con un error del motor.

## Recorrido 2 — El comprobador

Con una tarifa de $700 cada 15 minutos:

1. **Minutos gratis salen del tiempo, no del importe.** Permanencia de 5 horas con el
   convenio del fruver. Esperado: el desglose muestra los minutos cobrables antes y
   después, y el total corresponde a 4 horas —no al total de 5 horas menos un monto fijo.
2. **No hay saldo a favor.** Permanencia de 40 minutos con 60 minutos gratis. Esperado:
   total cero, nunca negativo.
3. **Los porcentajes se suman.** Dos convenios del 50 % y del 20 %. Esperado: descuento del
   70 %, y el desglose muestra el aporte de cada uno por separado.
4. **La suma se acota.** Tres convenios del 40 %. Esperado: descuento del 100 %, total
   cero, y el desglose dice que la suma se recortó.
5. **El límite diario.** Convenio limitado a una vez al día; poner "aplicaciones previas
   hoy: 1". Esperado: no se aplica, y el desglose dice que se descartó por límite diario
   —no lo omite en silencio.
6. **El tope en pesos.** Convenio con tope de $5.000 sobre un descuento que sin tope sería
   de $9.000. Esperado: descuenta $5.000 y el desglose lo dice.
7. **La tarifa fija manda.** Un convenio de tarifa fija junto a uno de minutos gratis.
   Esperado: el total lo determina la tarifa fija, y el de minutos aparece en el desglose
   como desplazado.

## Recorrido 3 — El redondeo

En la configuración del establecimiento, cambiar la regla y repetir un cobro que dé una
cifra quebrada.

**Esperado**: con "centena", $6.850 se convierte en **$6.800** y nunca en $6.900. El
redondeo puede favorecer al cliente; jamás al establecimiento.

## Recorrido 4 — Que nadie vea lo ajeno

Entrar como administrador de **otro** establecimiento. **Esperado**: ninguno de los
convenios anteriores aparece, ni por lista ni por identificador directo.

Entrar como administrador general y declarar un convenio para el primer establecimiento por
la vía de soporte. **Esperado**: el convenio aparece en el local con el administrador
general como autor, distinguible de los que declaró el propio establecimiento, y queda el
asiento en la auditoría.

## Recorrido 5 — La migración

Sobre una base que ya tenga convenios del modelo anterior, aplicar las migraciones.

**Esperado**: cada convenio sigue vigente, ahora como activación por placa con beneficio de
porcentaje, conservando su valor, sus placas y su vigencia. **Sin que nadie toque nada.**

## Automatizado

```
npx vitest run     # incluye la prueba de pureza del calculador y las de aislamiento
npx next build
```
