# CU-08 · Diagrama de despliegue

```mermaid
flowchart TB
    subgraph CASETA["Caseta del parqueadero"]
        direction TB
        EQ["<b>Equipo del operario</b><br/>Navegador web<br/><i>muestra el desglose</i>"]
        IMP["<b>Impresora térmica</b><br/><i>comprobante de salida</i>"]
        EQ -. "comprobante" .-> IMP
    end

    subgraph SERVIDOR["Servidor de aplicación"]
        direction TB
        APP["<b>Next.js 16</b> · Node.js"]
        CALC["<b>Motor de cobro</b><br/><i>funciones puras, mismo proceso</i>"]
        APP --- CALC
    end

    subgraph DATOS["Servidor de base de datos"]
        direction TB
        PG["<b>PostgreSQL</b>"]
        RLS2["Políticas de aislamiento<br/><i>forzadas</i>"]
        TRG2["Disparador de inmutabilidad<br/><i>blindaje.sql</i>"]
        PG --- RLS2
        PG --- TRG2
    end

    EQ -- "HTTPS" --> APP
    APP -- "TCP 5432 · app_tenant" --> PG
```

## Dónde se decide el dinero

| Nodo | Papel en el cobro |
|---|---|
| **Equipo del operario** | Muestra el desglose y recoge los sellos marcados. **No calcula nada** |
| **Servidor de aplicación** | Calcula el importe, lo recalcula al cerrar y escribe el movimiento |
| **Base de datos** | Rechaza cualquier intento de modificar un movimiento ya cerrado |

El importe nunca se calcula en el navegador, y el que llega del navegador nunca
se guarda. Es la misma razón por la que un cajero no acepta que el cliente
diga cuánto marcó la registradora.

## Sin servicios externos

Este caso de uso **no sale a la red**. El cálculo no consulta ninguna interfaz
ajena, ningún servicio de tarifas, ningún conversor. Con la salida a internet
cerrada, un parqueadero puede seguir cobrando.

Es deliberado: una caseta con internet intermitente es lo normal, y un cobro que
depende de que haya conexión es un cobro que un día no se puede hacer.

## La única salida hacia afuera

El comprobante, y va hacia la impresora del propio equipo, no hacia la red. Si
falla, el movimiento ya quedó cerrado y cobrado; el comprobante pasa a
pendientes y se reimprime después.
