# Plan de implementación: Configuración del establecimiento

**Rama**: `002-configuracion-establecimiento` · **Fecha**: 2026-08-16
**Especificación**: [spec.md](spec.md) · 68 requisitos, 5 historias, 14 criterios de éxito

## Summary

F2 convierte a Parquivo en un motor de tarifas configurable y le da a cada establecimiento las
reglas bajo las que opera: cuánto cobra, cuándo abre, cuánto cabe, quién trabaja y con qué
convenios. No cobra nada: eso es F3.

La pieza técnicamente interesante es el **calculador**, una función pura sobre datos planos que
recibe entrada, salida, tarifa y horario y devuelve importe más desglose. Vive fuera del acceso a
datos a propósito: es lo que permite probar todo el motor de cobro sin que exista un solo
movimiento, y lo que dejará a F3 mostrar el total parcial de un vehículo adentro invocando el mismo
cálculo con `salida = ahora`.

## Technical Context

Heredado de F1 sin cambios; ninguna de estas decisiones se reabre aquí.

| | |
|---|---|
| Lenguaje | TypeScript 5.9 estricto |
| Framework | Next.js 16.3 App Router, Turbopack |
| Base de datos | PostgreSQL con RLS y `FORCE ROW LEVEL SECURITY` |
| ORM | Drizzle 0.45, políticas con `pgPolicy` y `.enableRLS()` |
| Autenticación | Better Auth 1.6 |
| Pruebas | Vitest 4, tres proyectos: `unit`, `integracion`, `aislamiento` |
| Frontera de datos | `conAmbito()` y `comoPlataforma()` en `src/db/ambito.ts`; no hay otra puerta |
| Moneda | Pesos colombianos, enteros sin decimales |
| Zona horaria | Colombia. Instantes en `timestamptz`; la conversión a hora local es explícita |

**Nada quedó sin resolver.** La especificación llegó sin marcadores pendientes y las cinco
decisiones de modelado se cerraron en [research.md](research.md).

## Constitution Check

| Principio | Cómo lo cumple F2 | Riesgo |
|---|---|---|
| **I — Aislamiento (no negociable)** | Diez tablas nuevas. Las **nueve con ámbito** llevan `parqueadero_id`, política RLS y prueba negativa A↛B; la décima es el catálogo, que se explica en la columna de riesgo. `horario_franja`, `turno_dia`, `turno_asignacion` y `convenio_placa` denormalizan `parqueadero_id` para que la política no dependa de una unión | El catálogo `tipo_vehiculo` **no** lleva ámbito ni RLS. Es la segunda excepción legítima, junto a las tablas de autenticación, y queda acotada: es catálogo compartido de sólo lectura para los establecimientos |
| **II — Cero valores quemados** | Es la razón de ser de esta feature. Ni un importe, ni un intervalo, ni un horario en el código. Los dos modelos de cobro se discriminan por dato y se despachan por un mapa, de modo que un tercero no obliga a tocar los existentes | Los ejemplos de la especificación ($500, $60/min, $14.000) son ilustrativos y **no** entran como valores por defecto |
| **III — La taquilla es la ruta crítica** | F2 no toca la taquilla, pero le prepara el terreno: el calculador puro es lo que evitará que F3 tenga que consultar la base para mostrar un importe | — |
| **IV — Integridad del historial** | Las tarifas se versionan por rango y no se sobrescriben; los turnos se desactivan y no se borran; los convenios se vencen y no se eliminan | — |
| **V — Alcance deliberado** | Quedan fuera y anotadas: excepciones por fecha concreta (feriados), periodo de gracia inicial, y todo lo que sea aplicar una tarifa a un cobro real | — |

**Veredicto: pasa.** La única desviación —catálogo sin RLS— está justificada arriba y se registra en
Complexity Tracking.

## Project Structure

### Documentación

```
specs/002-configuracion-establecimiento/
├── spec.md
├── plan.md
├── research.md          ← las cinco decisiones de modelado
├── data-model.md        ← diez tablas: nueve con ámbito y el catálogo
├── quickstart.md
├── contracts/operaciones.md
└── checklists/requirements.md
```

### Código

```
src/db/esquema/
├── tipo-vehiculo.ts     catálogo de plataforma, sin RLS
├── tarifa.ts            versionada por rango
├── horario.ts           horario_atencion + horario_franja
├── capacidad.ts
├── turno.ts             turno + turno_dia + turno_asignacion
└── convenio.ts          convenio + convenio_placa

src/dominio/calendario/
└── expandir.ts          PURO. expandirHorario(): horas de reloj → instantes.
                         Vive aparte porque lo consumen tarifas, horarios y
                         turnos; bajo tarifas/ invitaría a un ciclo

src/dominio/tarifas/
├── modelos.ts           los dos modelos como datos, y el mapa de despacho
├── calcular.ts          PURO. calcularImporte(). No importa nada de src/db
├── jornadas.ts          PURO. partirEnJornadas()
├── declarar.ts          escribe, cierra la versión anterior
└── consultar.ts

src/dominio/configuracion/
└── como-plataforma.ts   el camino del administrador general sobre un
                         establecimiento ajeno, auditado y distinguible

src/dominio/horarios/    declarar, estaAbierto() puro
src/dominio/capacidad/
src/dominio/turnos/      crear, editar, activar, asignar, turnoVigenteEn()
src/dominio/convenios/   registrar, placas, descuentoParaPlaca()
src/dominio/cuentas/     se extiende: alta por el admin del establecimiento

src/app/(establecimiento)/
├── configuracion/tarifas/
├── configuracion/horario/
├── configuracion/capacidad/
├── configuracion/turnos/     con vista de calendario semanal
├── configuracion/convenios/
└── equipo/                   alta y gestión de su gente

tests/unit/          calculador y jornadas: donde vive el grueso de las pruebas
tests/integracion/   escritura, versionado, suspensión
tests/aislamiento/   una prueba negativa A↛B por tabla nueva
```

## Orden de implementación

Por dependencia y por prioridad de la especificación:

1. **Catálogo y esquema** — `tipo_vehiculo` sembrado, las nueve tablas con ámbito, políticas RLS, migración.
2. **Jornadas y calculador** (P1, US1) — funciones puras primero, con sus pruebas. Es la pieza de
   más riesgo y la que no depende de nada: conviene tenerla resuelta antes de construir encima.
3. **Tarifas** (P1, US1) — declarar con versionado, consultar la vigente en un momento.
4. **Horario y capacidad** (P1, US2) — el horario alimenta al calculador, así que llega después de
   él pero antes de las pantallas.
5. **Turnos** (P2, US4) — modelo, asignaciones y la vista de calendario.
6. **Equipo** (P2, US3) — alta y gestión por el administrador del establecimiento.
7. **Convenios** (P3, US5).
8. **Pantallas de configuración** y el aviso de horas sin turno.

Cada bloque cierra con su prueba negativa de aislamiento. No se avanza al siguiente sin ella: es
más barato que retrofitear el ámbito después.

## Complexity Tracking

| Desviación | Por qué | Alternativa descartada |
|---|---|---|
| `tipo_vehiculo` sin `parqueadero_id` ni RLS | Es catálogo compartido: si cada local nombrara sus tipos, dos reportes dejarían de ser comparables | Un catálogo por establecimiento — rompe la comparabilidad y multiplica las filas sin ganar nada |
| `parqueadero_id` denormalizado en cuatro tablas hijas | La política RLS necesita el ámbito en la propia fila; con una unión, cada consulta pagaría el rodeo y la política sería más fácil de escribir mal | Políticas con subconsulta a la tabla padre — más lentas y más frágiles |
| El calculador vive en el dominio y no en la base | F3 lo necesitará también fuera del servidor para el total parcial, y probarlo sin base es lo que hace verificable el criterio de "F2 sin movimientos" | Calcular en SQL — más rápido, pero no probable sin base ni reutilizable en el navegador |

## Riesgo abierto

El horario de atención pasó a alimentar el cobro. Un administrador que lo edita cambia, sin saberlo,
cómo se cobrará a los vehículos que ya están adentro. F2 no puede resolverlo porque todavía no hay
movimientos; **la pantalla del horario debe advertirlo** y F3 hereda la decisión de qué hacer con
los vehículos en curso.
