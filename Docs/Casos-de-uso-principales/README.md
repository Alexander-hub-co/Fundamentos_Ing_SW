# Casos de uso más importantes

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

De los doce casos de uso del sistema, dos son el corazón del producto:

| Caso de uso | Actor | Carpeta |
|---|---|---|
| **CU-07 · Registrar la entrada de un vehículo** | Operario | [`CU-07-registrar-entrada/`](CU-07-registrar-entrada/) |
| **CU-08 · Cobrar la salida de un vehículo** | Operario | [`CU-08-cobrar-salida/`](CU-08-cobrar-salida/) |

---

## Por qué estos dos

**Lo declara la constitución del proyecto.** Su Principio III es *«La Taquilla es
la Ruta Crítica»*, y estos dos casos **son** la taquilla.

**Son la propuesta de valor.** El canvas resume el producto en una frase —«cada
cobro se puede explicar»— y esa frase describe CU-08.

**Son el único ciclo cerrado.** Un vehículo que entra y no sale no produce
ingreso, y la salida no puede existir sin la entrada. Los demás casos existen
para servirlos: las tarifas para que la salida pueda cobrar, los turnos para
atribuir los movimientos, los convenios para modificar el importe.

**Concentran el plan.** Los sprints 3 y 4 están dedicados por completo a ellos:
48 de los 83 puntos que quedan por delante.

> **Un matiz.** Medido por tamaño, el caso más grande es CU-04 · Configurar el
> cobro, con 8 historias y 25 requisitos. Pero es un medio y no un fin: existe
> para que CU-08 pueda ocurrir. Nadie usa un parqueadero para configurar
> tarifas.

---

## Qué hay en cada carpeta

Cada carpeta tiene un `README.md` con el caso de uso —actor, precondición,
flujo principal y alternativos— y la lista de los archivos de
[`src/`](../../src/) que lo implementan, enlazados directamente al código que se
compila y se prueba.

## Diagramas

Los diagramas de estos casos de uso están con el resto del diseño:

| Diagrama | Dónde |
|---|---|
| Clases | [`Docs/Diagramas/clases.png`](../Diagramas/clases.png) |
| Modelo de la base de datos | [`Database/`](../../Database/modelo-entidad-relacion.md) |
| Secuencia, procesos, componentes, despliegue y patrones | [SDD](../Entrega-2/SDD.md) · [`Docs/Diagramas/`](../Diagramas/) |
