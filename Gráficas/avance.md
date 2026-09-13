# Gráficas de avance

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2
**Corte:** 12 de septiembre de 2026

---

## Puntos comprometidos por hito

```mermaid
xychart-beta
    title "Puntos por hito"
    x-axis ["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4", "Sprint 5", "Entrega Final"]
    y-axis "Puntos de historia" 0 --> 30
    bar [18, 21, 24, 24, 21, 14]
```

El Sprint 1 es el único cerrado: 18 de 18 puntos. Los demás son compromisos.

El tope de 24 puntos no es arbitrario: la única velocidad medida del equipo son
los 18 del Sprint 1, y comprometerse muy por encima de lo que uno ha demostrado
que rinde es la forma más común de acumular atraso.

---

## Trabajo restante

```mermaid
xychart-beta
    title "Puntos que quedan por delante al cerrar cada hito"
    x-axis ["Inicio", "Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4", "Sprint 5", "Final"]
    y-axis "Puntos restantes" 0 --> 130
    line [122, 104, 83, 59, 35, 14, 0]
```

La pendiente es deliberadamente pareja. Un plan con un sprint de 45 puntos y
otro de 9 no se cumple: el sobrecargado arrastra al siguiente y el liviano no
compensa.

---

## Reparto de la carga por persona

```mermaid
xychart-beta
    title "Puntos asignados a cada integrante"
    x-axis ["Sergio Alexander L.", "Cristian Quevedo", "Jacob Riveros", "Santiago Arias"]
    y-axis "Puntos de historia" 0 --> 35
    bar [29, 27, 24, 24]
```

Cinco puntos de diferencia entre quien más carga y quien menos, sobre 104. Las
cuatro personas participan en los cuatro sprints de construcción.

---

## Reparto por sprint

| Sprint | Cristian | Sergio | Jacob | Santiago | Total |
|---|:---:|:---:|:---:|:---:|:---:|
| Sprint 2 | 8 | 5 | 5 | 3 | **21** |
| Sprint 3 | 8 | 3 | 5 | 8 | **24** |
| Sprint 4 | 3 | 8 | 8 | 5 | **24** |
| Sprint 5 | 8 | 5 | 3 | 5 | **21** |
| Entrega Final | — | 8 | 3 | 3 | **14** |
| **Total** | **27** | **29** | **24** | **24** | **104** |

---

## Distribución de los requisitos

```mermaid
xychart-beta
    title "Requisitos funcionales por módulo"
    x-axis ["M1 plataforma", "M2 configuración", "M3 convenios", "M4 vehículos", "M5 bicicletas"]
    y-axis "Requisitos" 0 --> 80
    bar [53, 68, 20, 30, 23]
```

194 requisitos funcionales y 14 no funcionales. El módulo de configuración es el
más grande porque concentra tarifas, horarios, turnos y cuentas: todo lo que un
establecimiento declara antes de poder cobrar.

---

Las cifras salen del tablero del proyecto y de
[`Docs/SRS/SRS-simplificado.md`](../Docs/SRS/SRS-simplificado.md). Se rehacen en
cada cierre de sprint.
