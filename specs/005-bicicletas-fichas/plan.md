# Implementation Plan: Taquilla de bicicletas y fichas

**Branch**: `005-bicicletas-fichas` | **Date**: 2026-08-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-bicicletas-fichas/spec.md`

## Summary

Extender la taquilla a las bicicletas, que no tienen placa. El identificador pasa a ser una
ficha física prestada por el establecimiento, y de ahí sale todo lo que esta funcionalidad
agrega: un recurso finito con estados, una asignación que no puede repetirse aunque dos
taquillas trabajen a la vez, y una vía de recuperación cuando el tarjetón se pierde.

**Lo que NO se construye**, porque ya existe y se reutiliza intacto: el motor de tarifas
—que ya sabe cobrar bicicletas—, el movimiento con su inmutabilidad, las sesiones de turno,
la cortesía, las correcciones, el comprobante impreso con su lista de pendientes, y la
ocupación. Esta funcionalidad agrega una tabla de fichas y una vía nueva para llegar al
mismo movimiento.

**Dos riesgos que el plan tiene que cerrar antes de escribir código**, y ninguno es de
impresión: cómo se garantiza que dos operarios no reciban la misma ficha, y cómo se guarda
una cédula sin convertir el sistema en un archivo de datos personales. Están en
[research.md](research.md), D1 y D2.

## Technical Context

**Language/Version**: TypeScript 5, Node 22

**Primary Dependencies**: Next.js 16 (App Router, Turbopack), Drizzle ORM, Better Auth

**Storage**: PostgreSQL con RLS forzada. Dos puertas: `conAmbito()` y `comoPlataforma()`

**Testing**: Vitest, tres proyectos: `unit`, `integracion`, `aislamiento`

**Target Platform**: la misma taquilla en el navegador del local, con la térmica instalada
en esa máquina

**Project Type**: aplicación web con dominio separado de la interfaz

**Performance Goals**: la ruta crítica sigue siendo humana. La recepción de una bicicleta
cuesta dos datos —cédula y teléfono— y el objetivo es que para el cliente que vuelve cueste
uno solo, proponiendo el teléfono conocido. La devolución tiene que costar un dato.

**Constraints**: importes enteros; marcas de tiempo con zona; toda tabla con
`parqueadero_id` lleva RLS forzada; los movimientos son inmutables y su disparador sólo
deja cambiar el comprobante; **la cédula y el teléfono son datos personales** y entran en el
régimen de anonimización y retención que ya existe.

**Scale/Scope**: una tabla nueva, tres columnas nuevas en movimiento, una configuración
nueva por establecimiento, cinco historias.

## Constitution Check

*Verificado antes de la Fase 0 y de nuevo tras la Fase 1.*

| Principio | Cómo se cumple | Verificación |
|---|---|---|
| **I. Aislamiento multi-parqueadero** | La tabla de fichas lleva `parqueadero_id` con política RLS y queda forzada por el recorrido de `blindaje.sql`. La ficha 7 de un local no es la ficha 7 de otro | Prueba de aislamiento A↛B sobre fichas, como las que ya existen |
| **II. Configurable por establecimiento** | El tamaño del conjunto de fichas y el valor de reposición del tarjetón se declaran por establecimiento. Ningún número quemado | El valor de reposición nace en cero y no hay ningún literal en el código |
| **III. La taquilla es la ruta crítica** | **Aquí hay una tensión y está aceptada a la vista.** La recepción deja de ser de un paso: hay dos datos que escribir. Se mitiga proponiendo el teléfono conocido cuando la cédula vuelve, que es el caso normal | Se mide en la prueba de aceptación: un cliente que ya vino se recibe escribiendo sólo la cédula |
| **IV. Integridad del historial** | Los movimientos de bicicleta son los mismos movimientos, con el mismo disparador de inmutabilidad. Dar de baja una ficha es un estado, no un borrado | El disparador ya existente cubre los movimientos nuevos sin cambios |
| **V. Alcance deliberado** | Sólo bicicletas. No se construye reconocimiento de propiedad, ni cuentas de cliente, ni convenios nuevos | La cédula es un campo del movimiento, no una entidad con vida propia |

**Nota sobre el Principio III.** La tensión no se resuelve argumentando que dos campos son
pocos. Se resuelve reconociendo que el dato compra algo concreto —poder devolver una
bicicleta sin tarjetón— y acotando su costo al primer día de cada cliente. Si al probarlo
resulta que frena la fila, la decisión se revisa; queda anotado para mirarlo.

## Project Structure

### Documentation (this feature)

```
specs/005-bicicletas-fichas/
├── spec.md
├── plan.md              ← este archivo
├── research.md          ← D1 concurrencia, D2 datos personales, D3 el campo único
├── data-model.md
├── quickstart.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```
src/
├── db/
│   ├── esquema/
│   │   ├── ficha.ts                    ← NUEVO: la ficha y su estado
│   │   └── movimiento.ts               ← + fichaId, cedula, telefono, nota
│   └── migraciones/
│       └── 0013_fichas.sql             ← NUEVO, escrita a mano
├── dominio/
│   ├── fichas/
│   │   ├── declarar.ts                 ← NUEVO: conjunto, baja, recuperación
│   │   └── asignar.ts                  ← NUEVO: tomar y devolver, con exclusión
│   └── taquilla/
│       ├── resolver.ts                 ← + resolver un número de ficha
│       ├── registrar.ts                ← + recibir y devolver bicicleta
│       └── comprobante.ts              ← + la ficha en el papel
└── app/(establecimiento)/
    ├── taquilla/                       ← + la vía de bicicleta
    └── configuracion/fichas/           ← NUEVO: declarar el conjunto

tests/
├── unit/                               ← estados de la ficha, puros
├── integracion/
│   ├── fichas.test.ts                  ← ciclo completo
│   ├── fichas-concurrencia.test.ts     ← dos recepciones a la vez
│   └── fichas-retencion.test.ts        ← la cédula se purga, el cobro no
└── aislamiento/
    └── fichas-ambito.test.ts           ← la ficha 7 de A no es la de B
```

## Complexity Tracking

*Sin violaciones que justificar. La única tensión —el Principio III— está registrada arriba
con su mitigación y su criterio de revisión, no como excepción sino como costo aceptado.*
