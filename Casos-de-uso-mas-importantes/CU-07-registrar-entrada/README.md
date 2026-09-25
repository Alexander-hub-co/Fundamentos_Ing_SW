# CU-07 · Registrar la entrada de un vehículo

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Actor principal** | Operario de taquilla |
| **Precondición** | El operario está autenticado y el establecimiento está activo |
| **Postcondición** | Existe un movimiento abierto para esa placa |
| **Requisitos** | FR-001 a FR-007 del módulo M4 |
| **Historias** | HU-4.1.1, HU-4.1.2, HU-4.1.5 |
| **Sprint** | 3 · en curso, cierra el 28 de septiembre de 2026 |

---

## Flujo principal

1. El operario escribe la placa en el campo único de la taquilla y pulsa Enter.
2. El sistema normaliza la placa: quita separadores y la pasa a mayúsculas.
3. El sistema comprueba que esa placa no corresponde a un vehículo ya presente.
4. El sistema deduce el tipo: si la placa termina en dígito es automóvil, si
   termina en letra es motocicleta.
5. El sistema consulta la tarifa vigente para ese tipo y la muestra.
6. El operario confirma.
7. El sistema registra el movimiento con la hora, el operario y el turno abierto.
8. El sistema emite el comprobante.

## Flujos alternativos

| Nº | Condición | Qué ocurre |
|---|---|---|
| 3a | La placa ya está presente | El sistema no ofrece entrada: pasa a **CU-08** con el tiempo y el importe |
| 4a | La placa no corresponde a ningún formato conocido | El sistema la rechaza con un error explícito y no adivina el tipo |
| 5a | El tipo no tiene tarifa vigente | El sistema lo advierte antes de confirmar, porque a la salida no se va a poder cobrar |
| 8a | La impresora no responde | El movimiento queda registrado y el comprobante pasa a la lista de pendientes |
| — | El establecimiento está suspendido | El sistema impide la entrada: el permiso `taquilla.entrada` no está entre los admitidos en modo restringido |

---

## Diagramas

1. [Diagrama de clases](1-diagrama-de-clases.md)
2. [Modelo de base de datos](2-modelo-de-base-de-datos.md)
3. [Diagrama de componentes](3-diagrama-de-componentes.md)
4. [Diagrama de despliegue](4-diagrama-de-despliegue.md)
5. [Diagrama de interfaz](5-diagrama-de-interfaz.md)

El código que lo implementa está en [`codigo/`](codigo/).
