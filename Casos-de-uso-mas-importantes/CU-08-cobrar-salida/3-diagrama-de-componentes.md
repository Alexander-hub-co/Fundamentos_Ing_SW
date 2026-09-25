# CU-08 · Diagrama de componentes

```mermaid
flowchart TB
    subgraph NAV["Navegador del operario"]
        CP["campo-placa.tsx"]
        SE["controles de sello<br/><i>uno por convenio vigente</i>"]
        DG["desglose<br/><i>por qué paga esto</i>"]
    end

    subgraph SRV["Servidor de aplicación · Next.js"]
        AC["acciones.ts<br/>confirmarSalida · confirmarCortesia"]
        AU["lib/autorizacion"]
        AM["db/ambito"]
        subgraph DOM["Dominio"]
            RS["taquilla/resolver"]
            RG["taquilla/registrar"]
            CA["tarifas/calcular<br/><i>puro</i>"]
            JO["tarifas/jornadas<br/><i>puro</i>"]
            CV["convenios/aplicar"]
            PO["cobro/politica"]
            RE["cobro/redondeo<br/><i>puro</i>"]
            HO["horarios/consultar"]
        end
        CO["taquilla/comprobante"]
    end

    subgraph BD["PostgreSQL"]
        RLS["Seguridad a nivel de fila"]
        TRG["Disparador de inmutabilidad"]
        TB[("movimiento · tarifa<br/>convenio · politica_cobro")]
    end

    IMP["Impresora térmica"]

    CP -- "placa" --> AC
    SE -- "sellos marcados" --> AC
    AC --> AU --> AM
    AM --> RS
    RS --> CA
    CA --> JO
    CA --> HO
    CA --> RE
    RS --> CV
    RS --> PO
    RS -- "desglose" --> DG
    AC --> RG
    RG --> CA
    RG --> CV
    RG --> RLS
    RLS --> TRG --> TB
    AC --> CO
    CO -.-> IMP
```

## El recorrido de un cobro

1. La placa llega al servidor. Se resuelve la sesión, se exige el permiso
   `taquilla.salida` y se fija el ámbito del establecimiento.
2. `resolver` ve que el vehículo está adentro y pide el cálculo.
3. `calcular` parte la permanencia en jornadas, consulta el horario para saber
   qué tiempo es cobrable, aplica la tarifa y redondea.
4. `convenios/aplicar` descuenta los de activación por placa, y deja listos los
   de sello para que el operario marque el que traiga el cliente.
5. El desglose vuelve a la pantalla. **Todavía no se ha escrito nada.**
6. Si el operario marca un sello, se recalcula y se vuelve al paso 3.
7. Al confirmar, `registrar` recalcula por última vez y cierra el movimiento.

## Por qué se recalcula al cerrar

El importe que se guarda **no es el que viajó a la pantalla**. Se vuelve a
calcular en el servidor en el momento de cerrar, a partir de los sellos
confirmados.

Si se guardara el número que llegó del navegador, cualquiera podría enviar otro.
El desglose que se muestra es informativo; el que cuenta es el que el servidor
produce al escribir.

## Las tres piezas puras

`calcular`, `jornadas` y `redondeo` no tocan la base ni el reloj. Son las que
deciden cuánto paga la gente, y por eso son justamente las que se pueden probar
con datos inventados, sin montar nada.
