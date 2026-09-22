# Modelo de datos: convenios y descuentos configurables

**Fase 1** · Alcance: historias 1 y 2.

## Enumeraciones nuevas

| Tipo | Valores | Para qué |
|---|---|---|
| `activacion_convenio` | `sello`, `placa` | Cuándo aplica el convenio (FR-001) |
| `beneficio_convenio` | `minutos_gratis`, `porcentaje`, `tarifa_fija`, `sin_cobro` | Qué hace (FR-002) |
| `regla_redondeo` | `peso`, `cincuentena`, `centena` | Cómo redondea el establecimiento (FR-011) |

No hay valor `siempre` en la activación: se retiró en clarificación por el Principio V.

## `convenio` (tabla existente, se amplía)

| Campo | Cambio | Notas |
|---|---|---|
| `id`, `parqueadero_id`, `nombre` | sin cambio | |
| `descuento_pct` | **se elimina** | Migrado a `beneficio` + `valor` (FR-006, D5) |
| `activacion` | **nuevo**, no nulo | |
| `beneficio` | **nuevo**, no nulo | |
| `valor` | **nuevo**, nulo permitido | Minutos, porcentaje o pesos según el beneficio. Nulo sólo para `sin_cobro` |
| `tope_pesos` | **nuevo**, nulo permitido | Nulo ⇒ sin tope (FR-004) |
| `limite_diario` | **nuevo**, nulo permitido | Nulo ⇒ sin límite (FR-004a). El formulario obliga a elegirlo explícitamente; el nulo es el almacenamiento, no la interacción |
| `creado_por` | **nuevo**, nulo permitido | Quién lo declaró. Un identificador ajeno al establecimiento **es** la marca de soporte (FR-016b, D7) |
| `desde`, `hasta`, `activo` | sin cambio | Vigencia y estado ya existentes (FR-005) |

### Restricciones

- `convenio_parametros_del_beneficio` — una rama por beneficio, al estilo de
  `tarifa_parametros_del_modelo`:
  - `minutos_gratis` ⇒ `valor` no nulo y mayor que cero
  - `porcentaje` ⇒ `valor` entre 1 y 100
  - `tarifa_fija` ⇒ `valor` no nulo y no negativo
  - `sin_cobro` ⇒ `valor` nulo
- `convenio_tope_valido` — `tope_pesos` nulo o mayor que cero
- `convenio_limite_valido` — `limite_diario` nulo o mayor o igual a uno. **Cero se rechaza
  aquí, en el motor**, no sólo en el formulario: un convenio que nunca aplica es uno
  desactivado, y para eso está `activo` (FR-004a-ter)
- `convenio_vigencia_coherente` — ya existe
- Política de ámbito por `parqueadero_id` — ya existe

### Invariante que se conserva

`convenio_placa` mantiene su índice único: **una placa, un convenio por establecimiento**
(FR-017). Es lo que hace que "qué descuento le corresponde a esta placa" tenga una sola
respuesta. La acumulación que sí ocurre es entre un convenio por placa y uno o varios por
sello, que son activaciones distintas.

## `politica_cobro` (tabla nueva)

Una fila como máximo por establecimiento. La ausencia de fila significa el valor inicial
(D2).

| Campo | Notas |
|---|---|
| `id` | |
| `parqueadero_id` | **único**: una sola política por establecimiento |
| `redondeo` | `regla_redondeo`, no nulo |
| `actualizado_en` | |

Lleva política de ámbito y RLS forzada como toda tabla con `parqueadero_id`; la prueba
estructural que ya existe lo verifica sola.

El valor inicial —`peso`, truncando hacia abajo— vive como constante nombrada en el
dominio, documentada como valor por defecto y sobrescribible (FR-011a).

## Tipos del dominio (sin tabla)

### `ConvenioAplicable`

Lo que el calculador necesita saber de un convenio. Deliberadamente **no** es la fila:
lleva sólo lo que participa en el cálculo, más el nombre para el desglose.

Incluye `aplicacionesPreviasHoy`, que **lo aporta quien invoca** y no lo averigua el
calculador (FR-013b, D3). Hoy lo escribe el administrador en el comprobador; mañana lo
aporta el historial de movimientos.

### Sobre el nombre del comprobador

La pantalla de tarifas tiene un **probador** y la de convenios tendrá un **comprobador**.
Son dos pantallas distintas de funcionalidades distintas y los dos nombres se conservan a
propósito: unificarlos sugeriría que se puede probar todo desde un solo sitio, y no es así.
Se anota para que nadie lo lea como un descuido.

### `CobroConConvenios`

Extiende el `Cobro` que ya devuelve el calculador de tarifas, agregando:

- `importeBase` — lo que habría costado sin convenios
- `beneficios[]` — uno por convenio evaluado, con: nombre, activación, beneficio, cuánto
  restó, y si **no** se aplicó, por qué (límite diario alcanzado, o desplazado por una
  tarifa fija)
- `sumaPorcentajesAcotada` — si la suma de porcentajes se recortó al 100 % (FR-008c)
- `redondeo` — la regla usada y cuánto movió el total
- `importe` — el total final

Que el desglose nombre **por qué** no se aplicó un convenio es un requisito, no un adorno:
un convenio que desaparece sin explicación se lee como una falla del sistema.

## Orden del cálculo

```
minutos cobrables
  └─ menos la suma de minutos gratis, consumidos desde el comienzo   (FR-007, FR-008a, D1)
     └─ tarifa                                                        (calculador existente)
        └─ menos la suma de porcentajes, acotada al 100 %             (FR-008b, FR-008c)
           └─ tope en pesos de cada convenio                          (FR-004)
              └─ redondeo del establecimiento, que nunca sube         (FR-011b)
                 └─ total, nunca negativo                             (FR-010)
```

`tarifa_fija` y `sin_cobro` cortocircuitan: determinan el total por sí solos y los demás
beneficios quedan anotados en el desglose como desplazados (FR-009).
