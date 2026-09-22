# Modelo de datos — F2

Todas las tablas nuevas cuelgan de `parqueadero_id`, llevan su política RLS declarada con
`pgPolicy` y `.enableRLS()`, y quedan cubiertas por una prueba negativa A↛B. No hay excepción: el
Principio I no la admite.

La convención de F1 se mantiene — nombres en español, `id` UUID, `creado_en` y `actualizado_en` con
zona horaria.

---

## Catálogo de plataforma

### `tipo_vehiculo`

Catálogo **de plataforma**, no de establecimiento: si cada local nombrara sus tipos, dos reportes no
se podrían comparar. Un establecimiento elige a cuáles les pone tarifa, no cómo se llaman.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `codigo` | text único | `automovil`, `motocicleta`, `bicicleta` |
| `nombre` | text | Lo que ve una persona |
| `modelo_sugerido` | enum modelo_cobro | Cuál de los dos modelos le corresponde normalmente |
| `orden` | int | Para listarlos siempre igual |

Sin `parqueadero_id` y **sin RLS**: es catálogo compartido, como las tablas de autenticación. Es la
segunda excepción legítima al Principio I y, como la primera, queda acotada y documentada.

---

## Tarifas

### `tarifa`

Versionada por rango temporal (decisión D1). Editar no actualiza: cierra la versión vigente e
inserta una nueva.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `parqueadero_id` | uuid → parqueadero | Ámbito. RLS. |
| `tipo_vehiculo_id` | uuid → tipo_vehiculo | |
| `modelo` | enum `modelo_cobro` | `por_minuto` \| `por_intervalo` |
| `tarifa_minima` | int | Sólo `por_minuto`. Pesos sin decimales. |
| `valor_minuto` | int | Sólo `por_minuto` |
| `intervalo_minutos` | int | Sólo `por_intervalo` |
| `valor_intervalo` | int | Sólo `por_intervalo` |
| `tarifa_plena` | int | Ambos modelos |
| `alcance_plena` | enum `alcance_plena` | `estadia` \| `jornada`. Declarado siempre. |
| `vigente_desde` | timestamptz | |
| `vigente_hasta` | timestamptz nulo | Nulo ⇒ es la versión en curso |
| `creada_por` | text → user | Quién la declaró |

**Restricciones que sostienen el modelo:**

- Índice único parcial sobre `(parqueadero_id, tipo_vehiculo_id) WHERE vigente_hasta IS NULL`. Es
  el que impide dos versiones abiertas del mismo par, el único error que este diseño puede cometer.
- CHECK por modelo: `por_minuto` exige sus tres columnas y anula las otras dos; `por_intervalo` al
  revés. Sin esto, una tarifa incompleta se guardaría en silencio y reventaría en la taquilla.
- CHECK `tarifa_minima <= tarifa_plena` cuando aplica: si no, ninguna estadía sería cobrable.
- CHECK de no negatividad en todos los importes, e `intervalo_minutos > 0`.
- CHECK `vigente_hasta IS NULL OR vigente_hasta > vigente_desde`.

**Nunca se borra.** No hay operación de borrado: se cierra la vigencia. El Principio IV exige que un
cobro pasado siga siendo explicable.

---

## Horario y jornada

### `horario_atencion`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `parqueadero_id` | uuid → parqueadero | Ámbito. RLS. |
| `abierto_24h` | boolean | Si es cierto, las franjas se ignoran |
| `cobra_horas_cerradas` | boolean | Declarado siempre, sin valor por defecto invisible |

Una fila por establecimiento.

### `horario_franja`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `horario_id` | uuid → horario_atencion | |
| `parqueadero_id` | uuid | Denormalizado **a propósito**: la política RLS necesita el ámbito en la propia fila, sin recorrer una unión |
| `dia_semana` | int 0–6 | 0 = domingo |
| `hora_apertura` | time | |
| `hora_cierre` | time | `hora_cierre < hora_apertura` ⇒ cruza la medianoche |

Un día sin ninguna franja es un día cerrado. No hace falta una bandera de "cerrado": la ausencia ya
lo dice, y una bandera podría contradecir a las franjas.

---

## Capacidad

### `capacidad`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `parqueadero_id` | uuid → parqueadero | Ámbito. RLS. |
| `tipo_vehiculo_id` | uuid → tipo_vehiculo | |
| `cupos` | int | CHECK `>= 0` |

Único por `(parqueadero_id, tipo_vehiculo_id)`. Es un dato declarado; contar los ocupados es de F3.

---

## Turnos

### `turno`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `parqueadero_id` | uuid → parqueadero | Ámbito. RLS. |
| `nombre` | text | Libre: "Mañana", "Turno 1", "Nocturno" |
| `hora_inicio` | time | Hora del reloj: el turno es una regla que se repite |
| `hora_fin` | time | `hora_fin < hora_inicio` ⇒ cruza la medianoche |
| `activo` | boolean | Se desactiva, nunca se borra |

CHECK `hora_inicio <> hora_fin`: no expresa duración. Un turno de 24 horas se declara como tal.

### `turno_dia`

| Columna | Tipo | Notas |
|---|---|---|
| `turno_id` | uuid → turno | |
| `parqueadero_id` | uuid | Denormalizado para la política RLS |
| `dia_semana` | int 0–6 | |

Clave primaria `(turno_id, dia_semana)`. Una fila por día: se indexa y se lee sin decodificar nada.

### `turno_asignacion`

| Columna | Tipo | Notas |
|---|---|---|
| `turno_id` | uuid → turno | |
| `usuario_id` | text → user | |
| `parqueadero_id` | uuid | Denormalizado para la política RLS |
| `desde` | timestamptz | |

Clave primaria `(turno_id, usuario_id)`. Muchos a muchos: una persona cubre varios turnos y un turno
tiene varias personas. La persona asignada debe pertenecer al establecimiento, y eso se verifica en
el dominio, no con una clave foránea — la asignación de una cuenta a un parqueadero vive en
`asignacion`, y una foránea compuesta obligaría a duplicar aquí el rol.

---

## Convenios

### `convenio`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `parqueadero_id` | uuid → parqueadero | Ámbito. RLS. |
| `nombre` | text | La empresa o el motivo |
| `descuento_pct` | int | CHECK entre 0 y 100 |
| `desde` | timestamptz | |
| `hasta` | timestamptz nulo | Nulo ⇒ sin vencimiento |
| `activo` | boolean | |

### `convenio_placa`

| Columna | Tipo | Notas |
|---|---|---|
| `convenio_id` | uuid → convenio | |
| `parqueadero_id` | uuid | Denormalizado para la política RLS |
| `placa` | text | Normalizada: mayúsculas, sin espacios ni guiones |

Único por `(parqueadero_id, placa)` **entre convenios vigentes**: es lo que hace determinista la
resolución cuando una placa podría estar en dos convenios. Se implementa con índice único parcial
sobre los activos y sin vencer.

---

## Lo que este modelo deja preparado para F3

- La tarifa aplicada a un cobro se copiará entera junto al movimiento, no por referencia
  (Principio IV). El versionado de D1 es lo que hace que esa copia sea reconstruible.
- El movimiento llevará **dos** referencias de turno y de operario, una por extremo: quien registró
  la entrada y quien registró la salida pueden ser distintos.
- El total parcial de un vehículo adentro sale del mismo calculador con `salida = ahora`.
