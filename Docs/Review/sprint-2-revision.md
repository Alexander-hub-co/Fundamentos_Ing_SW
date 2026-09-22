# Revisión del Sprint 2

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 2 · Plataforma y seguridad |
| **Periodo** | 1 al 14 de septiembre de 2026 |
| **Revisión** | Martes 15 de septiembre de 2026, 19:00 – 19:40 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |
| **Acta** | [ACTA-007](../Actas/ACTA-007-2026-09-15.md) |

---

## Objetivo del sprint

Que existan cuentas, que cada quien vea sólo lo suyo y que el dinero se
represente bien desde el primer registro.

## Resultado

**21 de 21 puntos comprometidos.**

| # | Historia | Puntos | Responsable | Estado |
|---|---|:---:|---|---|
| [#24](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/24) | Aislamiento en consulta de movimientos | 8 | Cristian Quevedo | Terminada |
| [#25](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/25) | Autorización de rol para operaciones de creación | 5 | Sergio Alexander L. | Terminada |
| [#2](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/2) | Login en el sistema | 5 | Jacob Riveros | Terminada |
| [#28](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/28) | Registro de montos en pesos sin decimales | 3 | Santiago Arias | Terminada |

## Lo que se demostró

- **El aislamiento**, con dos establecimientos cargados: una sesión de uno
  obtiene cero registros del otro, y la comprobación ocurre en la base de datos
  y no en el código.
- **La autorización por rol**, enviando una solicitud directamente al servidor
  sin pasar por la interfaz: se rechaza igual.
- **El inicio de sesión**, con el cambio de contraseña obligatorio en el primer
  acceso.
- **Los importes en enteros**, sin ningún valor almacenado en punto flotante.

## Criterios de aceptación verificados

Las cuatro historias se contrastaron contra sus criterios escritos antes de
darlas por terminadas. Ninguna se aceptó por inspección visual.

## Velocidad

**21 puntos.** Media acumulada de 19,5 entre los dos sprints cerrados, con
tendencia al alza.
