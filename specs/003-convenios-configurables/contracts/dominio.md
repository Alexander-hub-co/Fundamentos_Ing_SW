# Contratos del dominio

Parquivo no expone una API pública: sus interfaces son las funciones de dominio que
consumen las pantallas, y —para esta funcionalidad— el contrato que la taquilla tendrá que
cumplir cuando exista. Eso es lo que se fija aquí.

---

## 1. El cálculo (puro)

**`calcularImporte`** — existente, gana un parámetro.

Recibe además `minutosGratis` (opcional, cero por defecto). Los consume desde el comienzo
de la permanencia, tramo por tramo. Al ser opcional con valor neutro, **ninguna llamada
actual cambia** y las pruebas existentes siguen valiendo.

**`aplicarConvenios`** — nueva, pura.

| Recibe | |
|---|---|
| `entrada`, `salida` | los dos instantes |
| `tarifa`, `horario` | como hoy |
| `convenios` | lista de `ConvenioAplicable`, cada uno con sus `aplicacionesPreviasHoy` |
| `redondeo` | la regla del establecimiento |

Devuelve `CobroConConvenios`.

**Garantías que debe cumplir**, todas verificables sin base de datos:

- No importa nada de `src/db`, no lee el reloj, no consulta nada. La prueba de pureza que
  ya existe para el calculador debe cubrir también esta función.
- El total nunca es negativo (FR-010).
- El total nunca supera el que arroja la tarifa sola (SC-005a).
- El mismo cálculo repetido da el mismo resultado (FR-013, SC-008).
- La suma de porcentajes se acota al 100 % (FR-008c).
- Un convenio cuyo `aplicacionesPreviasHoy` alcanza su `limiteDiario` no se aplica, y el
  desglose dice por qué (FR-013a).

---

## 2. La consulta

**`conveniosDelEstablecimiento(contexto)`** — existente. Devuelve los convenios con su
nuevo vocabulario.

**`conveniosAplicables(contexto, placa, momento)`** — nueva. Contrato para la taquilla
(FR-019).

Devuelve dos listas separadas:

- **automáticos** — los de activación por placa que cubren esa placa y están vigentes en
  ese instante. Se aplican solos.
- **porSello** — los de activación por sello, vigentes, cada uno con su nombre. La taquilla
  dibuja un botón por cada uno.

Ninguna de las dos listas lleva la cuenta de aplicaciones previas: eso lo aporta quien
llama (FR-013b). Hoy nadie consume esta función en producción; existe para que la taquilla
no tenga que inventar el contrato después.

**`politicaDeCobro(contexto)`** — nueva. Devuelve la regla de redondeo del establecimiento,
o el valor inicial si no declaró ninguna.

---

## 3. La declaración

**`declararConvenio(contexto, datos)`** — el vocabulario completo. Valida en el dominio lo
mismo que el CHECK valida en el motor, para que el error llegue como mensaje y no como
violación de restricción.

**`fijarRedondeo(contexto, regla)`** — declara la política del establecimiento.

Ambas admiten un contexto acotado por la puerta de soporte (FR-016a): el administrador
general opera sobre un establecimiento ajeno **estrechando** su alcance, nunca elevando
privilegios, y el autor queda registrado (FR-016b, D7).

---

## 4. Lo que la taquilla tendrá que cumplir

No se implementa aquí. Se escribe para que quien construya la taquilla no tenga que
adivinarlo:

1. Pedir `conveniosAplicables` con la placa y el instante de la salida.
2. Aplicar solos los automáticos; ofrecer un botón por cada uno de `porSello`, rotulado con
   el nombre del convenio. **Ninguna condición en el código puede mencionar un convenio
   concreto** (FR-020).
3. Contar, para cada convenio candidato, cuántas veces se aplicó ya ese día a esa placa
   —día calendario en la zona del establecimiento, contra el día de la **salida**
   (FR-004b, FR-004c)— y pasar ese número a `aplicarConvenios`.
4. Guardar en el movimiento una **copia** de cada convenio aplicado —nombre, activación,
   beneficio, valor descontado— y quién confirmó cada sello. No una referencia (FR-018).
5. Mostrar el desglose, no sólo el total. Un total que el operario no puede explicarle al
   cliente es un problema en la fila.
