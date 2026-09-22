# Investigación de diseño — F2

Cinco decisiones de modelado que la especificación deja abiertas y que el plan tiene que cerrar
antes de que se escriba código. El stack no está entre ellas: quedó fijado en F1 y aquí se hereda.

---

## D1. Cómo versionar las tarifas sin perder ninguna versión

**Decisión: rango temporal cerrado por arriba, con `vigente_hasta` nulo para la versión actual.**

Cada fila de tarifa lleva `vigente_desde` y `vigente_hasta`. La versión en curso tiene
`vigente_hasta` en nulo. Editar una tarifa no actualiza la fila: cierra la actual poniéndole
`vigente_hasta = ahora` e inserta una nueva con `vigente_desde = ahora`. Un índice único parcial
sobre `(parqueadero_id, tipo_vehiculo_id) WHERE vigente_hasta IS NULL` impide que existan dos
versiones abiertas del mismo par, que es el error que este diseño puede cometer.

**Por qué.** F3 tendrá que cobrar un vehículo que entró bajo una tarifa anterior, y el Principio IV
exige guardar junto al cobro una copia de la tarifa aplicada. Con rangos, "qué tarifa regía a las
14:32 del martes" es una consulta directa. La alternativa —un número de versión creciente— responde
"cuál fue la tercera" pero no "cuál regía en tal momento" sin recorrer el historial.

**Alternativas descartadas.**

- *Sobrescribir con tabla de auditoría aparte*: el historial queda en un formato distinto del que
  usa la consulta viva, así que reconstruir un cobro pasado se convierte en un ejercicio de
  arqueología en vez de una consulta.
- *Rango `tstzrange` de PostgreSQL con restricción de exclusión*: más elegante y garantiza la
  ausencia de solapes en la base. Se descarta porque Drizzle no lo expresa cómodamente y porque el
  índice único parcial ya cubre el único solape posible: dos versiones abiertas.

**Costo aceptado.** La tabla crece con cada cambio de precio. A escala de mil establecimientos que
cambian precios unas pocas veces al año, es irrelevante.

---

## D2. Cómo representar los dos modelos de cobro como datos

**Decisión: una tabla de tarifas con columnas para todos los parámetros, más una columna `modelo`
que discrimina cuáles aplican, y una restricción CHECK por modelo que exige exactamente los suyos.**

```
modelo = 'por_minuto'   → exige tarifa_minima, valor_minuto, tarifa_plena
                          y deja nulos intervalo_minutos, valor_intervalo
modelo = 'por_intervalo'→ exige intervalo_minutos, valor_intervalo, tarifa_plena
                          y deja nulos tarifa_minima, valor_minuto
```

En el código, un tipo unión discriminado por `modelo` y una función de cálculo por variante,
seleccionada por un mapa `modelo → calculador`. Agregar un tercer modelo es agregar un valor al
enum, sus columnas, su CHECK y su entrada en el mapa; **no se toca ninguno de los existentes**.

**Por qué.** El Principio II dice literalmente que añadir un modelo nuevo *puede* requerir código
pero cambiar los valores de uno existente *nunca*. Este diseño cumple exactamente eso. El CHECK por
modelo es lo que impide el estado sin sentido —una tarifa por intervalos con valor por minuto— en
la base y no sólo en la aplicación.

**Alternativas descartadas.**

- *Una columna JSON con los parámetros*: flexible pero sin validación en la base; una tarifa
  incompleta se guardaría sin protesta y reventaría meses después, en la taquilla, con fila.
- *Una tabla por modelo*: consultas con UNION por todos lados y una tabla nueva por cada modelo
  futuro, justo lo que se quiere evitar.
- *Reglas de cobro como expresiones interpretadas*: un motor de reglas propio es un lenguaje de
  programación mal diseñado y sin depurador. Desproporcionado para dos modelos.

---

## D3. Cómo calcular la jornada tarifaria

**Decisión: una función pura que parte un intervalo `[entrada, salida)` en tramos cobrables,
recibiendo el horario del establecimiento como dato.**

```
partirEnJornadas(entrada, salida, horario, cobraHorasCerradas) → Tramo[]
```

Tres casos, y ninguno es especial en el código:

1. **24 horas**: los cortes son las medianoches. Un tramo por día calendario tocado.
2. **Con horario y sin cobrar horas cerradas**: se intersecta la permanencia con las ventanas de
   atención de cada día. Lo que cae fuera desaparece, y puede no quedar ningún tramo.
3. **Con horario y cobrando horas cerradas**: los cortes son las aperturas. Los tramos son
   contiguos y cubren toda la permanencia.

Los turnos que cruzan la medianoche y los horarios que la cruzan se resuelven igual: una ventana de
atención se representa siempre como un par de instantes absolutos, nunca como un par de horas del
reloj. La conversión de "20:00 a 06:00 los lunes" a instantes ocurre una sola vez, al expandir el
horario sobre el calendario, y a partir de ahí nadie vuelve a razonar sobre medianoches.

**Por qué.** Es el punto donde este tipo de sistema falla con más frecuencia. Aislarlo en una
función pura sobre instantes absolutos permite probar los casos difíciles —cruce de medianoche,
permanencia de varios días, entrada dentro del periodo cerrado— sin base de datos y sin reloj.

**Alternativas descartadas.**

- *Aritmética sobre horas del reloj con casos especiales para la medianoche*: es exactamente cómo
  se escriben los errores de horario. Cada caso especial nuevo rompe otro.
- *Delegar los rangos a PostgreSQL*: la base sabe hacerlo, pero el cálculo dejaría de ser probable
  sin base y F3 lo necesita también en el navegador para mostrar el total parcial.

**Zona horaria.** Todo se guarda en instantes con zona (`timestamptz`) y se convierte a hora local
de Colombia sólo para partir por día. Colombia no tiene horario de verano, lo que elimina el caso
más desagradable, pero la conversión se hace igual de forma explícita en vez de asumir que el
servidor está en esa zona.

---

## D4. Dónde vive el calculador y cómo se prueba

**Decisión: `src/dominio/tarifas/calcular.ts`, sin importar nada de base de datos, y probado en el
proyecto `unit` de Vitest.**

La firma trabaja sobre datos planos:

```
calcularImporte({ entrada, salida, tarifa, horario, cobraHorasCerradas }) → Cobro
```

`Cobro` no es un número: trae el importe **y su desglose** —minutos cobrables, tramos, qué tope se
aplicó y por qué—. FR exige que el operario pueda explicarle al cliente la cifra, y un desglose
reconstruido a posteriori en la interfaz se desincroniza del cálculo real tarde o temprano.

**Por qué separarlo del acceso a datos.** Es lo que hace verificable el criterio de que F2 se prueba
sin un solo movimiento: las pruebas le pasan instantes inventados. También es lo que permitirá a F3
mostrar el total parcial de un vehículo que sigue adentro sin duplicar ni una línea: el mismo
cálculo con `salida = ahora`.

**Costo aceptado.** Quien invoque el calculador debe cargar antes la tarifa y el horario. Es una
carga explícita en vez de una consulta escondida dentro del cálculo, y esa visibilidad es
deliberada.

---

## D5. Cómo modelar los turnos

**Decisión: `turno` con sus datos, `turno_dia` con un día de la semana por fila, y
`turno_asignacion` con las personas.**

```
turno            (id, parqueadero_id, nombre, hora_inicio, hora_fin, activo)
turno_dia        (turno_id, dia_semana)          -- una fila por día en que rige
turno_asignacion (turno_id, usuario_id, desde)   -- quién lo cubre
```

Los días van en filas y no en una máscara de bits ni en un arreglo: `turno_dia` se consulta,
se indexa y se lee en un volcado de la base sin tener que decodificar nada.

`hora_inicio` y `hora_fin` se guardan como hora del reloj (`time`), no como instantes: un turno es
una regla que se repite, no un suceso. Que `hora_fin < hora_inicio` es precisamente lo que indica
que el turno cruza la medianoche, y esa lectura se hace en un solo lugar, al expandir el turno
sobre el calendario — la misma técnica de D3.

**Por qué separar la asignación.** Una persona en varios turnos y un turno con varias personas es
una relación de muchos a muchos; meterla como columna obligaría a duplicar turnos por persona, y
entonces "cambiar el horario del turno de la mañana" pasaría a ser varias escrituras que pueden
quedar a medias.

**Alternativas descartadas.**

- *Una fila por turno y día*: duplica el nombre y el horario en siete filas, y editarlo deja de ser
  atómico.
- *Excepciones por fecha concreta*: la especificación pide configuración distinta por día de la
  semana, no por fecha. Un feriado con horario especial es una necesidad real pero no está pedida;
  se anota para F5 en vez de construirla ahora.

---

## Riesgo abierto, no resuelto acá

El horario de atención pasó a alimentar el cobro. Un administrador que edita su horario está, sin
saberlo, cambiando cómo se cobrará a los vehículos que ya están adentro. F2 no lo resuelve porque no
hay movimientos todavía; **F3 hereda la pregunta** y conviene que la interfaz de F2 ya advierta que
el horario afecta al cobro, para que el cambio no se haga a ciegas.
