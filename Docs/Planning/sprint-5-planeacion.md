# Planeación del Sprint 5

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 5 · Supervisión, pruebas y diseño |
| **Periodo** | 13 al 26 de octubre de 2026 |
| **Planeación** | Martes 13 de octubre de 2026, 20:10 – 21:00 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |
| **Acta** | [ACTA-015](../Actas/ACTA-015-2026-10-13.md) |

---

## Objetivo del sprint

Que el administrador pueda supervisar su parqueadero a distancia, que el flujo
de la taquilla quede cubierto por pruebas y que el diseño de la solución quede
documentado para la Entrega 2.

## Compromiso

**26 puntos de historias**, con una velocidad media medida de 21,75, más el
Taller de Diseño y la Entrega 2.

| # | Historia | Puntos | Responsable |
|---|---|:---:|---|
| [#29](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/29) | Historial de versiones de tarifa por tipo de vehículo | 5 | Sergio Alexander L. |
| [#9](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/9) | Gestión de usuarios y permisos | 8 | Sergio Alexander L. |
| [#8](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/8) | Módulo de consulta y supervisión remota | 8 | Cristian Quevedo |
| [#7](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/7) | Pruebas unitarias de registro de entradas y salidas | 5 | Santiago Arias |

### Diseño de la solución (Taller de Diseño y Entrega 2)

| # | Tarea | Responsable |
|---|---|---|
| [#62](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/62) | Diagrama de análisis (ECB) | Cristian Quevedo |
| [#63](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/63) | Diagrama de clases | Sergio Alexander L. |
| [#65](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/65) | Diagrama de componentes | Jacob Riveros |
| [#67](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/67) | Diagrama de despliegue | Santiago Arias |

## Por qué se comprometen 26 puntos

Dos de las cuatro historias (#29 y #9) ya estaban implementadas en el código
integrado el 22 de septiembre y sólo faltaba verificarlas contra sus criterios.
El esfuerzo nuevo real es de 13 puntos de historias más el diseño.

## Plan de recorte

Si el sprint no alcanza, **#8 · Módulo de consulta y supervisión remota** pasa
al Sprint 6: no está en el camino crítico del cobro.

## Riesgos identificados al planear

| Riesgo | Mitigación acordada |
|---|---|
| La Entrega 2 cae dentro del sprint | El diseño se reparte por diagrama, uno por integrante |
| Sergio Alexander L. concentra 13 puntos | Las dos historias ya están implementadas; sólo requieren verificación |
| El tablero vuelve a atrasarse | Revisión del tablero al abrir cada sesión |

## Definición de terminado

Criterios de aceptación cumplidos, prueba automatizada, integración continua en
verde e integración en `develop` mediante rama y revisión.
