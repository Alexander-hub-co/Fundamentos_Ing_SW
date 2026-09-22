# Planeación del Sprint 3

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 3 · Taquilla — entrada |
| **Periodo** | 15 al 28 de septiembre de 2026 |
| **Planeación** | Martes 15 de septiembre de 2026, 20:10 – 21:00 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |
| **Acta** | [ACTA-007](../Actas/ACTA-007-2026-09-15.md) |

---

## Objetivo del sprint

Que un vehículo pueda entrar, que el sistema deduzca su tipo solo y que lo
registrado no se pueda alterar después.

## Compromiso

**24 puntos**, con una velocidad media medida de 19,5.

| # | Historia | Puntos | Responsable |
|---|---|:---:|---|
| [#5](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/5) | Registro de entrada de vehículos | 8 | Cristian Quevedo |
| [#31](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/31) | Determinar entrada o salida según la placa | 8 | Santiago Arias |
| [#26](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/26) | Bloqueo de edición y eliminación de movimientos cerrados | 5 | Jacob Riveros |
| [#32](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/32) | Rechazo de entrada duplicada | 3 | Sergio Alexander L. |

## Por qué se sostienen 24 puntos sobre una media de 19,5

Se discutió si eran demasiados. Se decidió sostenerlos porque las cuatro
historias son del mismo bloque y se apoyan entre sí: quien resuelve la
clasificación por placa habilita el registro de entrada, y el rechazo de
duplicados sale casi gratis una vez que ambas existen. Partir el bloque en dos
sprints obligaría a dejar a medias el flujo que el operario usa todo el día.

Es, aun así, el primer sprint que se compromete por encima del mejor resultado
del equipo, y así quedó anotado.

## Plan de recorte

Si el sprint no alcanza, se recorta **#32 · Rechazo de entrada duplicada**: es
la historia más pequeña y la menos acoplada a las otras tres.

La decisión de recortar se toma en la revisión, historia por historia, y no
arrastrando el sprint completo al siguiente.

## Riesgos identificados al planear

| Riesgo | Mitigación acordada |
|---|---|
| Compromiso por encima de la velocidad medida | Plan de recorte definido de antemano, con la historia ya elegida |
| La regla de clasificación por placa es una convención que puede cambiar | Vive aislada del flujo de registro y se puede sustituir sin tocarlo |
| El aviso de riesgo del sprint anterior llegó tarde | La revisión del avance pasa al viernes de la primera semana |

## Definición de terminado

La misma del Sprint 2: criterios de aceptación cumplidos, prueba automatizada e
integración en `develop` mediante rama y revisión.
