# Modelo de datos: taquilla de vehículos

**Fase 1.** Cinco tablas nuevas. Todas llevan `parqueadero_id` con su política de ámbito y
RLS forzada; la prueba estructural que ya existe las reconoce sola.

## `movimiento`

La estancia de un vehículo. Es el dato más sensible del sistema y el primero que el
Principio IV tiene que proteger.

| Campo | Notas |
|---|---|
| `id`, `parqueadero_id` | |
| `codigo` | Legible, con la sigla del establecimiento (D7). Es lo que va en el comprobante |
| `placa` | Normalizada. Se compara siempre así |
| `tipo_vehiculo_id` | Derivado de la placa al entrar, nunca elegido a mano |
| `entrada_en`, `salida_en` | Con zona horaria. `salida_en` nulo ⇒ el vehículo está adentro |
| `operario_entrada`, `operario_salida` | Quién atendió cada extremo |
| `sesion_entrada`, `sesion_salida` | En qué sesión de turno ocurrió cada extremo. Nulos si no había ninguna abierta |
| `importe` | Lo cobrado, entero. Nulo mientras esté abierto |
| `cobro` | **Copia embebida** del desglose y de la tarifa usada (D3). No referencias |
| `cortesia_motivo` | No nulo ⇒ salió sin cobrar. Es lo que distingue una cortesía de un cobro de cero |
| `cortesia_por` | Quién la otorgó |
| `comprobante` | `pendiente` o `emitido` |

### Restricciones

- **`movimiento_una_placa_adentro`** — índice único parcial sobre `(parqueadero_id, placa)`
  donde `salida_en is null`. Es la garantía de D4: el motor la impone incluso ante dos
  operarios simultáneos, sin depender de que nadie compruebe antes.
- **`movimiento_salida_coherente`** — `salida_en` nulo o posterior a `entrada_en`.
- **`movimiento_cerrado_completo`** — si hay `salida_en`, hay `importe` y hay `cobro`. Un
  movimiento cerrado sin saber cuánto se cobró no debería poder existir.
- **`movimiento_cortesia_completa`** — el motivo y el autor de la cortesía van juntos o no
  van; y una cortesía tiene `importe = 0`.
- **Sin `ON DELETE CASCADE` hacia el establecimiento.** Suspender o dar de baja un
  parqueadero no destruye su historial (FR-018), y la forma de garantizarlo es que la base
  no lo permita.

### Lo que NO tiene

**No hay columna de estado.** El estado se deduce: `salida_en` nulo es "adentro", no nulo
es "cerrado". Una columna aparte podría contradecir a las fechas, y entonces habría dos
verdades sobre lo mismo.

**No hay `UPDATE` permitido sobre un movimiento cerrado.** Se impide con un disparador,
igual que el proyecto ya blinda otras tablas: dejarlo a la disciplina de quien escribe el
código es lo que el Principio IV no acepta.

## `correccion`

Un asiento que referencia un movimiento cerrado. Nunca lo modifica.

| Campo | Notas |
|---|---|
| `id`, `parqueadero_id`, `movimiento_id` | |
| `importe_corregido` | Lo que se debió cobrar |
| `motivo` | Obligatorio |
| `emitida_por`, `emitida_en` | |

Conserva los dos números por construcción: el original vive en `movimiento.importe` y el
corregido acá. Reemplazar uno por otro destruiría la única prueba de que hubo un error.

## `delegacion`

El permiso que un administrador otorga a una persona concreta (D6, constitución 1.1.0).

| Campo | Notas |
|---|---|
| `id`, `parqueadero_id` | El ámbito impide que alcance fuera del establecimiento |
| `usuario_id` | A quién |
| `operacion` | De una lista cerrada. Hoy tiene un solo valor: emitir correcciones |
| `otorgada_por`, `otorgada_en` | |
| `revocada_en` | Nulo ⇒ vigente. No se borra: revocar es un hecho que también se audita |

Las correcciones ya emitidas sobreviven a la revocación: eran válidas cuando se hicieron.

## `sesion_turno`

Una jornada concreta de un turno declarado.

| Campo | Notas |
|---|---|
| `id`, `parqueadero_id`, `turno_id` | |
| `abierta_por`, `abierta_en` | Hora **real** |
| `programada_inicio`, `programada_fin` | Copiadas del turno al abrir, para poder comparar |
| `cerrada_en` | Nulo ⇒ abierta |

- **`sesion_una_abierta_por_persona`** — índice único parcial: una persona no puede tener
  dos sesiones abiertas a la vez.

## Tipos del dominio (sin tabla)

- **`ResolucionDePlaca`** — lo que devuelve escribir una placa: si corresponde entrada o
  salida, y con qué datos. Es el tipo que hace posible el campo único.
- **`Ocupacion`** — cuántos hay adentro por tipo y cuántos caben, con la capacidad
  declarada cuando exista y sin inventar un máximo cuando no.

## Lo que se reutiliza sin tocar

| Ya existe | Para qué |
|---|---|
| `normalizarPlaca`, `esPlacaPlausible` | Comparar placas y rechazar las imposibles |
| `calcularImporte`, `aplicarConvenios` | El cobro entero. Puros y probados |
| `conveniosAplicables`, `diaDeAplicacion` | El contrato escrito al hacer los convenios |
| `politicaDeCobro` | La regla de redondeo |
| `tarifaVigenteEn`, `horarioDelCobro` | Las entradas del cálculo |
| `capacidadDeclarada` | El denominador de la ocupación |
| `turnosDelEstablecimiento` | Qué turnos hay para abrir |

**Lo único nuevo del cálculo es el conteo de aplicaciones previas**, que hasta hoy nadie
podía aportar porque no había movimientos. Es exactamente el hueco que el contrato dejó
señalado.
