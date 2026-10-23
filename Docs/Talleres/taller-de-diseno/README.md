# Taller de Diseño en Software — Parquivo

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
| 1 | Análisis (ECB) | [analisis-ecb.md](../../Diagramas/analisis-ecb.md) | [PNG](../../Diagramas/analisis-ecb.png) |
| 2 | Clases | [clases.md](../../Diagramas/clases.md) | [PNG](../../Diagramas/clases.png) |
| 3 | Componentes | [componentes.md](../../Diagramas/componentes.md) | [PNG](../../Diagramas/componentes.png) |
| 4 | Despliegue | [despliegue.md](../../Diagramas/preliminares/despliegue.md) | [PNG](../../Diagramas/preliminares/despliegue.png) |

## Informe

El informe del taller, con la explicación de cada diagrama, los principios
SOLID y las conclusiones, está en
[`informe-taller-diseno.pdf`](informe-taller-diseno.pdf) y en Word en
[`informe-taller-diseno.docx`](informe-taller-diseno.docx).

## Dónde están los diagramas

Las imágenes y su explicación están con el resto de los diagramas del proyecto,
en [`Docs/Diagramas/`](../../Diagramas/). Las fuentes están en
[`Docs/Diagramas/fuentes/`](../../Diagramas/fuentes/): los de análisis, clases y
despliegue en [PlantUML](https://plantuml.com) (`.puml`) y el de componentes
generado con `componentes.py`. Un cambio en el diseño se hace en la fuente y se
vuelve a exportar:

```bash
java -jar plantuml.jar -tpng Docs/Diagramas/fuentes/clases.puml
python3 Docs/Diagramas/fuentes/componentes.py
```
