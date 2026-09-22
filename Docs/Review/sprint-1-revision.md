# Revisión del Sprint 1

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 1 · Planeación y especificación |
| **Periodo** | 17 al 31 de agosto de 2026 |
| **Revisión** | Martes 1 de septiembre de 2026, 19:00 – 19:40 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |
| **Acta** | [ACTA-003](../Actas/ACTA-003-2026-09-01.md) |

---

## Objetivo del sprint

Entender el problema y dejarlo escrito antes de construir nada.

## Resultado

**18 de 18 puntos comprometidos.**

| # | Tarea | Puntos | Responsable | Estado |
|---|---|:---:|---|---|
| [#3](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/3) | Diseñar el modelo de base de datos | 8 | Jacob Riveros | Terminada |
| [#4](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/4) | Diseñar los wireframes de la interfaz web | 5 | Cristian Quevedo | Terminada |
| [#11](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/11) | Diseñar la arquitectura general del sistema | 5 | Sergio Alexander L. | Terminada |

## Lo que se demostró

- **El modelo de datos**, con la frontera de aislamiento por establecimiento
  presente en toda entidad operativa y las copias embebidas de tarifa y convenio
  en cada movimiento.
- **Los wireframes**, con la taquilla resuelta en un solo campo.
- **La arquitectura**, con la decisión de aislar por fila en la base de datos en
  lugar de por esquema, y el porqué de haber descartado la alternativa.

Fuera del tablero, porque su producto son documentos y no código, se entregaron
la especificación de requisitos con cinco módulos y las 51 historias de usuario
con sus criterios de aceptación.

## Decisiones tomadas en la revisión

1. Se acepta el modelo de datos como base de la construcción.
2. El aislamiento se implementa con seguridad a nivel de fila en la base de
   datos, no con comprobaciones en el código de la aplicación.
3. El Sprint 2 arranca por el aislamiento y no por la taquilla.

## Velocidad

**18 puntos.** Es la primera medida real del equipo y la que sostuvo los
compromisos de los sprints siguientes.
