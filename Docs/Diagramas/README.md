# Diagramas del diseño

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

Único lugar de los diagramas del diseño. Cada imagen PNG tiene su fuente en
[`fuentes/`](fuentes/), y los de análisis, clases, componentes y despliegue
tienen además una explicación ampliada en su `.md`. El diseño vigente es el del
[SDD](../Entrega-2/SDD.md).

| Diagrama | Qué muestra | Historias | Explicación | Fuente |
|---|---|---|---|---|
| [Análisis ECB](analisis-ecb.png) | Límites, controles y entidades del ciclo de un vehículo | HU-008, HU-007, HU-004 | [analisis-ecb.md](analisis-ecb.md) | [analisis-ecb.puml](fuentes/analisis-ecb.puml) |
| [Arquitectura en capas](arquitectura-capas.png) | Capas de presentación (MVC), dominio y acceso a datos | Todas | [SDD §2](../Entrega-2/SDD.md#2-arquitectura-del-sistema) | [arquitectura-capas.puml](fuentes/arquitectura-capas.puml) |
| [Clases](clases.png) | Servicios, interfaces y dominio con sus relaciones y SOLID | HU-008, HU-007, HU-004 | [clases.md](clases.md) | [clases.puml](fuentes/clases.puml) |
| [Componentes](componentes.png) | Módulos, interfaces provistas y requeridas, servicios externos | HU-008, HU-007, HU-004 | [componentes.md](componentes.md) | [componentes.py](fuentes/componentes.py) |
| [Despliegue](despliegue.png) | Nodos, artefactos, protocolos y puertos | Todas | [despliegue.md](despliegue.md) | [despliegue.puml](fuentes/despliegue.puml) |
| [Secuencia de la entrada](secuencia-entrada.png) | Cómo se decide entre entrada y salida y se registra la entrada | HU-008 | [SDD §6.1](../Entrega-2/SDD.md#6-diseño-dinámico-secuencia-y-procesos) | [secuencia-entrada.puml](fuentes/secuencia-entrada.puml) |
| [Secuencia de la salida](secuencia-salida.png) | Cálculo del cobro con desglose y cierre con copia del cobro | HU-007, HU-004 | [SDD §6.2](../Entrega-2/SDD.md#6-diseño-dinámico-secuencia-y-procesos) | [secuencia-salida.puml](fuentes/secuencia-salida.puml) |
| [Procesos de la taquilla](proceso-taquilla.png) | Actividades y decisiones al atender un vehículo | HU-008, HU-007, HU-004 | [SDD §6.3](../Entrega-2/SDD.md#6-diseño-dinámico-secuencia-y-procesos) | [proceso-taquilla.puml](fuentes/proceso-taquilla.puml) |
| [Patrón Strategy](patron-strategy.png) | Un modelo de tarifa por estrategia de cobro | HU-007 | [SDD §7.1](../Entrega-2/SDD.md#7-patrones-de-diseño) | [patron-strategy.puml](fuentes/patron-strategy.puml) |
| [Patrón Singleton](patron-singleton.png) | Pool único de conexiones a PostgreSQL | Todas | [SDD §7.2](../Entrega-2/SDD.md#7-patrones-de-diseño) | [patron-singleton.puml](fuentes/patron-singleton.puml) |

## Diagramas por historia de usuario

Cada historia del tablero (HU-001 a HU-010) tiene un diagrama de secuencia y uno
de procesos. Las fuentes están en [`fuentes/historias/`](fuentes/historias/).

| Issue | Historia | Secuencia | Procesos |
|---|---|---|---|
| [#24](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/24) | HU-001 · Aislamiento en consulta de movimientos | [secuencia](historias/hu-001-secuencia.png) | [procesos](historias/hu-001-procesos.png) |
| [#25](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/25) | HU-002 · Autorización de rol para operaciones de creación | [secuencia](historias/hu-002-secuencia.png) | [procesos](historias/hu-002-procesos.png) |
| [#26](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/26) | HU-003 · Bloqueo de edición y eliminación de movimientos cerrados | [secuencia](historias/hu-003-secuencia.png) | [procesos](historias/hu-003-procesos.png) |
| [#27](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/27) | HU-004 · Snapshot de tarifa y convenio al momento del cobro | [secuencia](historias/hu-004-secuencia.png) | [procesos](historias/hu-004-procesos.png) |
| [#28](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/28) | HU-005 · Registro de montos en pesos colombianos sin decimales | [secuencia](historias/hu-005-secuencia.png) | [procesos](historias/hu-005-procesos.png) |
| [#29](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/29) | HU-006 · Historial de versiones de tarifa por tipo de vehículo | [secuencia](historias/hu-006-secuencia.png) | [procesos](historias/hu-006-procesos.png) |
| [#30](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/30) | HU-007 · Detalle del cálculo del cobro | [secuencia](historias/hu-007-secuencia.png) | [procesos](historias/hu-007-procesos.png) |
| [#31](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/31) | HU-008 · Determinar entrada o salida según placa | [secuencia](secuencia-entrada.png) | [procesos](proceso-taquilla.png) |
| [#32](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/32) | HU-009 · Rechazo de entrada duplicada | [secuencia](historias/hu-009-secuencia.png) | [procesos](historias/hu-009-procesos.png) |
| [#33](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/33) | HU-010 · Tarifa obligatoria antes del primer cobro | [secuencia](historias/hu-010-secuencia.png) | [procesos](historias/hu-010-procesos.png) |

El modelo entidad-relación está en [`Database/`](../../Database/modelo-entidad-relacion.md).

## Versión preliminar

[`preliminares-drawio/`](preliminares-drawio/) guarda la primera versión de los
diagramas, hecha en draw.io. Es una versión anterior: donde difiera del SDD,
manda el SDD.
