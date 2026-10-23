# Revisión del Sprint 4

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 4 · Taquilla — salida y cobro |
| **Periodo** | 29 de septiembre al 12 de octubre de 2026 |
| **Revisión** | Martes 13 de octubre de 2026, 19:00 – 19:40 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |
| **Acta** | [ACTA-015](../Actas/ACTA-015-2026-10-13.md) |

---

## Objetivo del sprint

Que un vehículo pueda salir pagando lo que corresponde, que el cobro se pueda
explicar y que lo cobrado no cambie aunque cambien las tarifas.

## Resultado

**24 de 24 puntos comprometidos.**

| # | Historia | Puntos | Responsable | Estado |
|---|---|:---:|---|---|
| [#10](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/10) | Registro de salida de vehículos | 8 | Sergio Alexander L. | Terminada |
| [#27](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/27) | Copia de tarifa y convenio al momento del cobro | 8 | Jacob Riveros | Terminada |
| [#30](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/30) | Detalle del cálculo del cobro | 5 | Santiago Arias | Terminada |
| [#33](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/33) | Tarifa obligatoria antes del primer cobro | 3 | Cristian Quevedo | Terminada |

## Lo que se demostró

- **La salida con la misma placa**: el sistema reconoce que el vehículo está
  adentro y ofrece cobrarlo.
- **El desglose del cobro**: importe base, tramos, convenios aplicados y no
  aplicados con su motivo, y redondeo.
- **La copia del cobro**: se cambió una tarifa después de cobrar y el movimiento
  cerrado conservó su valor.
- **La tarifa obligatoria**: un vehículo sin tarifa entra con advertencia y el
  sistema no inventa un valor al cobrar.

## Correcciones dentro del sprint

El 9 de octubre se detectaron tres fallas al probar sobre una base nueva. Se
corrigieron y fusionaron el 12:

| *Pull request* | Corrección |
|---|---|
| [#55](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/pull/55) | El migrador funciona sobre una base de datos nueva |
| [#56](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/pull/56) | Verificación de tipos y análisis estático en verde |
| [#57](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/pull/57) | La confirmación de la taquilla muestra la última acción |

## Observación sobre el tablero

Las tarjetas del sprint volvieron a quedar abiertas tras terminar el trabajo y
se cerraron el 16 de octubre, junto con las del Sprint 3.

## Velocidad

**24 puntos.** Media acumulada de **21,75** entre los cuatro sprints cerrados.
