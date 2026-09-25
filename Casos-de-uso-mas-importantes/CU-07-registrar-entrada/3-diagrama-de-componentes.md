# CU-07 · Diagrama de componentes

```mermaid
flowchart TB
    subgraph NAV["Navegador del operario"]
        CP["campo-placa.tsx<br/><i>componente de cliente</i>"]
        PT["page.tsx<br/><i>pantalla de taquilla</i>"]
    end

    subgraph SRV["Servidor de aplicación · Next.js"]
        AC["acciones.ts<br/><i>acciones de servidor</i>"]
        AU["lib/autorizacion<br/><i>exige el permiso</i>"]
        AM["db/ambito<br/><i>fija el establecimiento</i>"]
        subgraph DOM["Dominio"]
            RS["taquilla/resolver"]
            RG["taquilla/registrar"]
            PL["vehiculos/placa<br/><i>puro</i>"]
            CL["vehiculos/clasificar<br/><i>puro</i>"]
            TA["tarifas/consultar"]
        end
        IM["taquilla/imprimir<br/><i>comprobante</i>"]
    end

    subgraph BD["PostgreSQL"]
        RLS["Políticas de seguridad<br/>a nivel de fila"]
        TB[("movimiento<br/>tipo_vehiculo<br/>tarifa")]
    end

    IMP["Impresora térmica"]

    PT --> CP
    CP -- "placa escrita" --> AC
    AC --> AU
    AU --> AM
    AM --> RS
    RS --> PL
    RS --> CL
    RS --> TA
    AC --> RG
    RG --> PL
    RG --> CL
    RS --> RLS
    RG --> RLS
    RLS --> TB
    RG --> IM
    IM -.-> IMP
```

## Cómo se leen las capas

| Capa | Qué puede hacer | Qué no |
|---|---|---|
| **Navegador** | Recoger lo que el operario escribe y mostrar el resultado | Decidir el establecimiento, calcular el importe o confiar en cualquier valor propio |
| **Acciones de servidor** | Resolver la sesión, exigir el permiso, fijar el ámbito | Contener reglas de negocio |
| **Dominio** | Todas las reglas: normalizar, clasificar, consultar tarifa, escribir el movimiento | Saber que existe una pantalla |
| **Base de datos** | Rechazar lo que viole el aislamiento o la inmutabilidad | Confiar en que la aplicación ya comprobó |

## Las dos piezas puras

`placa` y `clasificar` no tocan la base de datos ni el reloj. Reciben una cadena
y devuelven un resultado, siempre el mismo. Por eso se pueden probar con
entradas inventadas, sin montar nada, y por eso la regla del último carácter se
puede sustituir sin que ningún otro módulo se entere.

## La impresora, con línea discontinua

La conexión con la impresora se dibuja punteada porque **su fallo no detiene el
caso de uso**. Si no responde, el movimiento queda igualmente registrado y el
comprobante pasa a una lista de pendientes. La fila no se detiene por una
impresora.
