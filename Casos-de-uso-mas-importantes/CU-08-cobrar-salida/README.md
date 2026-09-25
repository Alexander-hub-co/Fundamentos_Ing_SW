# CU-08 · Cobrar la salida de un vehículo

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Actor principal** | Operario de taquilla |
| **Precondición** | Existe un movimiento abierto para esa placa |
| **Postcondición** | El movimiento queda cerrado, con importe y copia de las condiciones |
| **Requisitos** | FR-008 a FR-019 del módulo M4 |
| **Historias** | HU-4.1.3, HU-4.1.4, HU-4.1.6, HU-4.1.7 |
| **Sprint** | 4 · del 29 de septiembre al 12 de octubre de 2026 |

Es el caso de uso que sostiene la propuesta de valor del producto: **cada cobro
se puede explicar.**

---

## Flujo principal

1. El operario escribe la placa y pulsa Enter.
2. El sistema reconoce que el vehículo está presente y calcula la permanencia.
3. El sistema aplica solos los convenios de activación por placa que
   correspondan.
4. El sistema calcula el importe y su desglose.
5. El sistema muestra el total, el tiempo y el desglose completo.
6. El operario confirma el cobro.
7. El sistema cierra el movimiento guardando el importe y **una copia** de la
   tarifa y del convenio aplicados.
8. El sistema emite el comprobante de salida si se solicitó.

## Flujos alternativos

| Nº | Condición | Qué ocurre |
|---|---|---|
| 3a | El convenio se activa por sello | El sistema ofrece un control por cada uno, rotulado con el nombre del comercio, y recalcula en el acto |
| 3b | El convenio ya se agotó ese día | No se aplica, y el desglose dice por qué |
| 5a | El establecimiento pide confirmar antes de cobrar | Se añade un paso de confirmación explícita |
| 6a | El operario cierra sin cobro | El sistema exige un motivo escrito y registra quién lo autorizó y cuánto se habría cobrado |
| 8a | La impresora no responde | El comprobante pasa a pendientes y la operación continúa |
| — | El establecimiento está suspendido | La salida **sí** se permite: nadie queda encerrado por un problema de facturación |

---

## Diagramas

1. [Diagrama de clases](1-diagrama-de-clases.md)
2. [Modelo de base de datos](2-modelo-de-base-de-datos.md)
3. [Diagrama de componentes](3-diagrama-de-componentes.md)
4. [Diagrama de despliegue](4-diagrama-de-despliegue.md)
5. [Diagrama de interfaz](5-diagrama-de-interfaz.md)

El código que lo implementa está en [`codigo/`](codigo/).
