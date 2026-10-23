# Revisión del Sprint 3

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 3 · Taquilla — entrada |
| **Periodo** | 15 al 28 de septiembre de 2026 |
| **Revisión** | Martes 29 de septiembre de 2026, 19:00 – 19:40 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |
| **Acta** | [ACTA-011](../Actas/ACTA-011-2026-09-29.md) |

---

## Objetivo del sprint

Que un vehículo pueda entrar, que el sistema deduzca su tipo solo y que lo
registrado no se pueda alterar después.

## Resultado

**24 de 24 puntos comprometidos.**

| # | Historia | Puntos | Responsable | Estado |
|---|---|:---:|---|---|
| [#5](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/5) | Registro de entrada de vehículos | 8 | Cristian Quevedo | Terminada |
| [#31](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/31) | Determinar entrada o salida según la placa | 8 | Santiago Arias | Terminada |
| [#26](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/26) | Bloqueo de edición y eliminación de movimientos cerrados | 5 | Jacob Riveros | Terminada |
| [#32](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/32) | Rechazo de entrada duplicada | 3 | Sergio Alexander L. | Terminada |

## Lo que se demostró

- **Un solo campo para entrar y salir**: se escribe la placa y el sistema decide
  si es una entrada o una salida, sin que el operario elija.
- **La clasificación por placa**: terminada en dígito es carro, en letra es moto,
  y una placa sin formato reconocible se rechaza con un error explícito.
- **El rechazo de duplicados**: dos registros simultáneos de la misma placa dejan
  un único movimiento abierto, porque lo impide un índice único de la base.
- **El bloqueo de movimientos cerrados**: un movimiento cerrado no se puede
  editar ni borrar; las correcciones son asientos nuevos.

## Criterios de aceptación verificados

Las cuatro historias se contrastaron con sus criterios escritos y con las
pruebas automatizadas de `tests/`.

## Observación sobre el tablero

El código de las cuatro historias quedó integrado en `develop` el 22 de
septiembre ([#44](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/pull/44)),
pero las tarjetas **no se cerraron en el tablero** hasta el 16 de octubre. El
trabajo se terminó dentro del sprint; el registro no.

## Velocidad

**24 puntos.** Media acumulada de 21 entre los tres sprints cerrados.
