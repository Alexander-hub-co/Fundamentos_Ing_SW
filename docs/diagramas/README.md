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
| 1 | Análisis (ECB) | [diagrama-ecb.md](diagrama-ecb.md) | [PNG](imagenes/diagrama-ecb.png) |
| 2 | Clases | [diagrama-clases.md](diagrama-clases.md) | [PNG](imagenes/diagrama-clases.png) |
| 3 | Componentes | [diagrama-componentes.md](diagrama-componentes.md) | [PNG](imagenes/diagrama-componentes.png) |
| 4 | Despliegue | [diagrama-despliegue.md](diagrama-despliegue.md) | [PNG](imagenes/diagrama-despliegue.png) |

## Informe

El informe del taller, con la explicación de cada diagrama, los principios
SOLID y las conclusiones, está en
[`informe-taller-diseno.pdf`](informe-taller-diseno.pdf) y en Word en
[`informe-taller-diseno.docx`](informe-taller-diseno.docx).

## Cómo se generaron

Los diagramas de análisis, clases y despliegue están escritos en
[PlantUML](https://plantuml.com) (`.puml`), y el de componentes en SVG
generado con `generar.py`. Las cuatro imágenes están juntas en
[`imagenes/`](imagenes/) y cada fuente en su carpeta numerada; un cambio en el
diseño se hace en la fuente y se vuelve a exportar:

```bash
java -jar plantuml.jar -tpng 01-ecb/diagrama-ecb.puml
python3 03-componentes/generar.py
```
