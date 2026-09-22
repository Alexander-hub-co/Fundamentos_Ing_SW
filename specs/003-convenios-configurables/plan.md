# Implementation Plan: Convenios y descuentos configurables

**Branch**: `003-convenios-configurables` | **Date**: 2026-08-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-convenios-configurables/spec.md`

## Summary

Se reemplaza el campo único de descuento por un vocabulario componible de dos ejes
—activación (sello o placa) y beneficio (minutos gratis, porcentaje, tarifa fija o sin
cobro)—, se extiende el calculador puro para que los aplique en un orden declarado, y se
agrega una regla de redondeo configurable por establecimiento.

**Dos historias, y ninguna dependencia externa.** Hubo una tercera —un asistente de IA que
tradujera descripciones en prosa a reglas estructuradas— que se especificó, se aprobó y
después se descartó por completo. La razón la dio el propietario del producto: la variedad
de los convenios es grande pero **acotada**, y una variedad acotada se enumera. Lo que
faltaba no era interpretación sino más opciones, concretamente las vigencias con nombre
—mensual, trimestral, semestral, anual—. El plan no elige proveedor de modelo, no agrega
variables de entorno y no deja código esperándolo.

El enfoque técnico sale de [research.md](research.md): el calculador sigue siendo puro y
recibe todo como dato —incluidos los minutos gratis, la regla de redondeo y la cuenta de
aplicaciones previas—, lo que permite entregar y probar la funcionalidad completa **sin que
exista un solo movimiento**.

## Technical Context

**Language/Version**: TypeScript 5, Node 22

**Primary Dependencies**: Next.js 16 (App Router, Turbopack), Drizzle ORM, Better Auth

**Storage**: PostgreSQL con Row-Level Security forzada. Dos puertas de datos:
`conAmbito()` y `comoPlataforma()` en `src/db/ambito.ts`. El soporte sobre un
establecimiento ajeno pasa por `comoEstablecimiento()`, que ya existe.

**Testing**: Vitest, en tres proyectos: `unit`, `integracion`, `aislamiento`

**Target Platform**: aplicación web servida desde Node

**Project Type**: aplicación web con dominio separado de la interfaz

**Performance Goals**: el cálculo es puro, en memoria y sin red. No hay objetivo de
latencia que investigar: la restricción real es que **no puede depender de un servicio
externo** (FR-014), y se cumple por construcción.

**Constraints**: importes en enteros, nunca en punto flotante; el calculador no puede
importar nada de `src/db` —hay una prueba que lo verifica leyendo sus importaciones—; toda
tabla con `parqueadero_id` lleva RLS forzada y al menos una política.

**Scale/Scope**: dos tablas tocadas (una ampliada, una nueva), tres enumeraciones nuevas,
una función pura nueva, dos pantallas tocadas.

## Constitution Check

*Verificado antes de la Fase 0 y de nuevo tras la Fase 1. Sin violaciones.*

| Principio | Cómo se cumple | Verificación |
|---|---|---|
| **I. Aislamiento** | `convenio` ya tiene política de ámbito; `politica_cobro` nace con la suya. La única salida al ámbito es la puerta de soporte que **ya existe** y que estrecha el alcance en vez de elevar privilegios | La prueba estructural que exige RLS forzada y al menos una política a toda tabla con `parqueadero_id` cubre la tabla nueva sin escribir nada |
| **II. Cero valores quemados** | Es el propósito de la funcionalidad: saca del código la última condición de convenio que quedaba fija. La regla de redondeo entra por la misma puerta, porque el Principio II la nombra explícitamente | FR-020 lo hace verificable. El valor inicial vive como constante documentada y sobrescribible, no como literal suelto |
| **III. La taquilla es la ruta crítica** | Esta entrega **no toca la taquilla**, que todavía no existe. Define su contrato por escrito ([contracts/dominio.md](contracts/dominio.md) §4) para que quien la construya no lo invente | Los convenios por placa no agregan ni un clic: se aplican solos. Los botones de sello ya se justificaron en la especificación: el sello es un objeto físico que llega con el cliente y sólo quien atiende puede verlo |
| **IV. Integridad del historial** | Los convenios no se versionan, y eso es deliberado (D6): la garantía la da FR-018, que exige guardar **copia** del convenio aplicado en cada salida, no una referencia | El autor de cada convenio queda registrado, así que un cambio de soporte es distinguible del propio (FR-016b) |
| **V. Alcance deliberado** | Dos cosas se retiraron en vez de construirse: la activación "siempre", que cabía en el modelo sin que ningún acuerdo la pidiera, y el asistente de IA, al comprobar que su problema se resolvía enumerando | Lo que entra —límite diario, vigencias con nombre— entra porque sirve a establecimientos reales |

**Nota sobre el Principio II y el redondeo.** Una versión anterior de la especificación
argumentaba que redondear al peso no contaba como "regla de redondeo" y por tanto no
necesitaba ser configurable. Se descartó ese argumento: era una interpretación a
conveniencia de un principio escrito sin ambigüedad. Queda anotado aquí para que la
decisión no se revierta por comodidad más adelante.

## Project Structure

### Documentation (this feature)

```text
specs/003-convenios-configurables/
├── plan.md              # Este archivo
├── spec.md              # Especificación, ya clarificada
├── research.md          # Fase 0 — siete decisiones de diseño
├── data-model.md        # Fase 1 — tablas, tipos y orden del cálculo
├── quickstart.md        # Fase 1 — cinco recorridos de comprobación
├── contracts/
│   └── dominio.md       # Fase 1 — funciones y contrato para la taquilla
├── checklists/
│   └── requirements.md  # Calidad de la especificación
└── tasks.md             # Lo genera /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
src/
├── db/
│   ├── esquema/
│   │   ├── enums.ts             # + activacion_convenio, beneficio_convenio, regla_redondeo
│   │   ├── convenio.ts          # amplía: activacion, beneficio, valor, tope, límite, autor
│   │   └── politica-cobro.ts    # NUEVO: la regla de redondeo del establecimiento
│   └── migraciones/             # + migración que traduce descuento_pct y lo elimina
├── dominio/
│   ├── tarifas/
│   │   ├── calcular.ts          # + minutosGratis; sigue puro
│   │   └── modelos.ts           # + CobroConConvenios, ConvenioAplicable
│   ├── convenios/
│   │   ├── gestionar.ts         # declarar con el vocabulario nuevo
│   │   ├── vigencia.ts          # NUEVO y puro: las duraciones con nombre
│   │   ├── aplicar.ts           # NUEVO y puro: compone tarifa, convenios y redondeo
│   │   └── consultar.ts         # NUEVO: conveniosAplicables — contrato de la taquilla
│   └── cobro/
│       └── redondeo.ts          # NUEVO y puro: las tres reglas + el valor inicial
└── app/(establecimiento)/configuracion/
    ├── convenios/               # formulario con el vocabulario + comprobador
    └── horario/                 # + la regla de redondeo del establecimiento
```

**Estructura elegida**: la que el proyecto ya usa —dominio puro separado de la interfaz,
acceso a datos sólo por las dos puertas—. No se introduce ninguna disposición nueva.

**Por qué el redondeo vive en `dominio/cobro/` y no en `dominio/tarifas/`**: es una regla
del establecimiento que se aplica **después** de la tarifa y también después de los
convenios. Colgarla de tarifas sugeriría que es parte del modelo de cobro, y no lo es.

## Fase 0 — Investigación

Completa. Siete decisiones cerradas en [research.md](research.md):

1. **Los minutos gratis se restan del tiempo cobrable**, consumidos desde el comienzo,
   porque restarlos del reloj no es lo mismo cuando hay horas cerradas sin cobrar.
2. **La regla de redondeo vive en una tabla propia** por establecimiento; la ausencia de
   fila significa el valor inicial, repitiendo el patrón que ya usa el horario.
3. **El calculador no lee la configuración: la recibe.** Hay una prueba de pureza que
   fallaría si lo hiciera, y con razón.
4. **El vocabulario se expresa con enumeraciones y un CHECK por rama**, como ya hace la
   tabla de tarifas. Crear tipos nuevos no sufre la restricción de PostgreSQL que obligó a
   tratar aparte las enumeraciones en el arranque de migraciones; eso sólo afecta a
   *añadir* valores a un tipo existente.
5. **La migración traduce y elimina en un solo paso**, sin intervención manual.
6. **Los convenios no se versionan**, porque la garantía del Principio IV la da la copia
   que guarda cada salida.
7. **Un cambio de soporte se distingue por el autor**, sin necesidad de una marca aparte.
8. **Las vigencias con nombre se guardan además de la fecha que producen.** Guardar sólo
   la fecha perdería la intención: la lista diría "vence el 19 de septiembre" en lugar de
   "mensualidad", que es lo que quien administra reconoce de un vistazo. Y el cálculo
   respeta el mes en vez de contar treinta días, porque una mensualidad que empieza el 31
   de enero vence en febrero y no el 3 de marzo.

## Fase 1 — Diseño

Completa. Artefactos generados:

- [data-model.md](data-model.md) — las dos tablas, las tres enumeraciones, las
  restricciones y el orden exacto del cálculo.
- [contracts/dominio.md](contracts/dominio.md) — las funciones del dominio con sus
  garantías, y el contrato de cinco puntos que la taquilla tendrá que cumplir.
- [quickstart.md](quickstart.md) — cinco recorridos de comprobación, incluidos los siete
  casos del comprobador y la verificación de que nadie ve lo ajeno.

**Constitution Check tras el diseño: sin violaciones.** El diseño no introdujo ninguna
complejidad que haya que justificar. La decisión de no versionar convenios (D6) es la única
que se aparta del patrón de las tarifas, y su razón está escrita: la garantía ya la da otro
requisito, y duplicarla sería pagar dos veces por lo mismo.

## Riesgos

**El cambio en `calcularImporte` toca el motor de cobro**, que hoy está cubierto y
funcionando. Se mitiga con el parámetro opcional de valor neutro: ninguna llamada actual
cambia y las pruebas existentes siguen valiendo tal cual. Si alguna se rompiera, sería
señal de que el parámetro no es neutro y habría que revisarlo, no de que las pruebas
sobran.

**La migración toca datos de clientes.** Se mitiga probándola sobre una base con convenios
del modelo anterior antes de tocar desarrollo (recorrido 5 del quickstart).

**Sumar meses en JavaScript no hace lo que parece.** `setMonth(mes + 1)` sobre el 31 de
enero devuelve el 3 de marzo, no el 28 de febrero. La función de vigencia tiene que
recortar al último día del mes destino, y ése es exactamente el caso que su prueba cubre.

**Se está entregando una funcionalidad que nadie consume todavía**: sin taquilla, los
convenios se declaran y se comprueban pero no se aplican a movimientos reales. Es
deliberado y está escrito en la especificación. El comprobador es lo que la hace
demostrable hoy en vez de un trabajo a ciegas.
