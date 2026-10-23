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

El modelo entidad-relación está en [`Database/`](../../Database/modelo-entidad-relacion.md).

## Versión preliminar

[`preliminares-drawio/`](preliminares-drawio/) guarda la primera versión de los
diagramas, hecha en draw.io. Es una versión anterior: donde difiera del SDD,
manda el SDD.
