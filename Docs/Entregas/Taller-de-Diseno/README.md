# Diagramas de diseño — Parquivo

**Taller de Diseño en Software** · Fundamentos de Ingeniería de Software (12946) · 2026-2

Un único conjunto de diagramas construido a partir de las tres historias de
usuario más críticas del sistema:

| Historia | Prioridad | Puntos |
|---|---|---|
| **HU-008 · Determinar entrada o salida según placa** (principal) | Alta | 8 |
| HU-004 · Snapshot de tarifa y convenio al momento del cobro | Alta | 8 |
| HU-007 · Detalle del cálculo del cobro | Alta | 5 |

Las tres forman el ciclo que hace operar un parqueadero: el vehículo entra, el
sistema calcula cuánto debe y, al salir, el cobro queda guardado tal como se
hizo.

## Diagramas

| # | Diagrama | Documento | Imagen |
|---|---|---|---|
| 1 | Análisis (ECB) | [diagrama-ecb.md](diagrama-ecb.md) | [PNG](../../Diagramas/analisis-ecb.png) |
| 2 | Clases | [diagrama-clases.md](diagrama-clases.md) | [PNG](../../Diagramas/clases.png) |
| 3 | Componentes | [diagrama-componentes.md](diagrama-componentes.md) | [PNG](../../Diagramas/componentes.png) |
| 4 | Despliegue | [diagrama-despliegue.md](diagrama-despliegue.md) | [PNG](../../Diagramas/despliegue.png) |

## Informe

El informe del taller, con la explicación de cada diagrama, los principios
SOLID y las conclusiones, está en
[`informe-taller-diseno.pdf`](informe-taller-diseno.pdf) y en Word en
[`informe-taller-diseno.docx`](informe-taller-diseno.docx).

## Dónde están los diagramas

Las cuatro imágenes están con todos los diagramas del proyecto en
[`Docs/Diagramas/`](../../Diagramas/), y su fuente en
[`Docs/Diagramas/fuentes/`](../../Diagramas/fuentes/). Los de análisis, clases y
despliegue están escritos en [PlantUML](https://plantuml.com) y el de
componentes se genera con `componentes.py`.
