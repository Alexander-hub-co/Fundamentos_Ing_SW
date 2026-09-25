# CU-08 · Diagrama de clases

Cada **módulo** se representa como una clase: sus funciones exportadas son los
métodos y sus tipos exportados, los atributos.

```mermaid
classDiagram
    class AccionesTaquilla {
        <<acciones de servidor>>
        +consultarPlaca(bruta) Resolucion
        +confirmarSalida(id, sellos) Movimiento
        +confirmarCortesia(id, motivo) Movimiento
        +accionImprimirComprobante(id) void
    }
    class Resolver {
        <<dominio>>
        +resolverPlaca(contexto, bruta) Resolucion
        +calcularCobroDe(contexto, id, sellos) CobroConConvenios
    }
    class Registrar {
        <<dominio>>
        +registrarSalida(contexto, id, ahora, sellos) Movimiento
        +registrarCortesia(contexto, id, motivo) Movimiento
    }
    class Calcular {
        <<dominio · puro>>
        +calcularImporte(datos) Cobro
        +totalParcial(datos) number
    }
    class Jornadas {
        <<dominio · puro>>
        +partirEnJornadas(entrada, salida, horario) Jornada[]
    }
    class AplicarConvenios {
        <<dominio>>
        +conveniosAplicables(contexto, placa, instante) Convenio[]
        +aplicar(cobro, convenios) CobroConConvenios
    }
    class PoliticaCobro {
        <<dominio>>
        +politicaDeCobro(contexto) Politica
    }
    class Redondeo {
        <<dominio · puro>>
        +redondear(importe, regla) number
    }
    class Comprobante {
        <<dominio>>
        +comprobanteDe(contexto, id) Comprobante
        +marcarComprobanteEmitido(id) void
    }
    class CobroConConvenios {
        <<tipo>>
        importeBase: number
        minutosCobrables: number
        jornadas: Jornada[]
        conveniosAplicados: Aplicacion[]
        conveniosDescartados: Descarte[]
        redondeo: number
        total: number
    }
    class Movimiento {
        <<entidad>>
        salidaEn: timestamp
        importe: number
        cobro: jsonb
        operarioSalida: string
        sesionSalida: uuid?
    }

    AccionesTaquilla --> Resolver : consulta el importe
    AccionesTaquilla --> Registrar : confirma el cobro
    Resolver ..> Calcular : pide el importe
    Resolver ..> AplicarConvenios : descuenta
    Registrar ..> Calcular : recalcula al cerrar
    Registrar ..> AplicarConvenios : descuenta
    Registrar ..> PoliticaCobro : lee la regla de redondeo
    Calcular ..> Jornadas : parte la permanencia
    Calcular ..> Redondeo : ajusta el total
    AplicarConvenios --> CobroConConvenios : produce
    Registrar --> Movimiento : cierra
    AccionesTaquilla --> Comprobante : emite
```

## Qué hace cada pieza

| Módulo | Responsabilidad |
|---|---|
| `calcular.ts` | Dados entrada, salida, tarifa y horario, devuelve el importe **y su desglose** |
| `jornadas.ts` | Parte la permanencia en jornadas tarifarias, para que tres días no se cobren como una tarde |
| `convenios/aplicar.ts` | Decide qué convenios alcanzan a esa placa en ese instante y qué descuenta cada uno |
| `cobro/politica.ts` | Lee la regla de redondeo que declaró el establecimiento |
| `cobro/redondeo.ts` | Aplica esa regla: al peso, a la cincuentena o a la centena |
| `registrar.ts` | Cierra el movimiento y guarda la copia de lo aplicado |

## Las dos propiedades que definen este caso

### El cálculo es una operación pura

`calcularImporte` recibe datos y devuelve un resultado. No consulta la base, no
mira el reloj, no depende de la sesión. Por eso se puede ejercitar con momentos
inventados, sin que exista ningún vehículo ni ningún movimiento, y por eso se
puede confiar en la pieza que decide cuánto paga la gente.

### El resultado no es un número, es un desglose

`calcularImporte` no devuelve el total: devuelve `CobroConConvenios`, que lleva
el importe base, los minutos cobrables, las jornadas, **cada convenio aplicado
con lo que restó**, **los descartados con su motivo** y el redondeo.

Esa estructura es la razón de que el operario pueda responder «por qué pago
esto». Un cálculo que sólo devolviera el total haría imposible la promesa del
producto.
