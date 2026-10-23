# Planeación del Sprint 4

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 4 · Taquilla — salida y cobro |
| **Periodo** | 29 de septiembre al 12 de octubre de 2026 |
| **Planeación** | Martes 29 de septiembre de 2026, 20:10 – 21:00 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |
| **Acta** | [ACTA-011](../Actas/ACTA-011-2026-09-29.md) |

---

## Objetivo del sprint

Que un vehículo pueda salir pagando lo que corresponde, que el cobro se pueda
explicar y que lo cobrado no cambie aunque cambien las tarifas.

## Compromiso

**24 puntos**, con una velocidad media medida de 21.

| # | Historia | Puntos | Responsable |
|---|---|:---:|---|
| [#10](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/10) | Registro de salida de vehículos | 8 | Sergio Alexander L. |
| [#27](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/27) | Copia de tarifa y convenio al momento del cobro | 8 | Jacob Riveros |
| [#30](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/30) | Detalle del cálculo del cobro | 5 | Santiago Arias |
| [#33](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/33) | Tarifa obligatoria antes del primer cobro | 3 | Cristian Quevedo |

## Cómo se estimó

Fue la primera planeación con **estimación de los cuatro integrantes**, como se
acordó en la retrospectiva del Sprint 2. Las estimaciones individuales
coincidieron en tres historias; en la copia del cobro (#27) hubo diferencia
entre 5 y 8 puntos y se quedó en 8 por el riesgo de tocar el esquema de la base.

## Plan de recorte

Si el sprint no alcanza, se recorta **#33 · Tarifa obligatoria antes del primer
cobro**: es la más pequeña y el cobro funciona sin ella con un aviso manual.

## Riesgos identificados al planear

| Riesgo | Mitigación acordada |
|---|---|
| El cobro depende de que existan tarifas (módulo M2) | Las dos cosas quedan en el mismo sprint |
| Cambiar el esquema de `movimiento` puede romper lo ya construido | Migración nueva, sin editar las anteriores, y prueba sobre una base nueva |
| El tablero vuelve a quedar desactualizado | Cada *pull request* cierra su historia con `Closes #N` |

## Definición de terminado

Criterios de aceptación cumplidos, prueba automatizada, integración continua en
verde e integración en `develop` mediante rama y revisión.
