# CU-07 · Diagrama de clases

El sistema está escrito en TypeScript con funciones y tipos, no con clases. El
diagrama representa cada **módulo** como una clase: sus funciones exportadas son
los métodos y sus tipos exportados, los atributos. Es la traducción fiel de lo
que hay en `codigo/`.

```mermaid
classDiagram
    class PaginaTaquilla {
        <<pantalla>>
        +render() JSX
    }
    class CampoPlaca {
        <<componente>>
        -valor: string
        +alEnviar(texto) void
    }
    class AccionesTaquilla {
        <<acciones de servidor>>
        +consultarPlaca(bruta) Resolucion
        +confirmarEntrada(placa) Movimiento
    }
    class Resolver {
        <<dominio>>
        +resolverPlaca(contexto, bruta) Resolucion
        +esNumeroDeFicha(texto) boolean
    }
    class Registrar {
        <<dominio>>
        +registrarEntrada(contexto, bruta, ahora) Movimiento
    }
    class Placa {
        <<dominio · puro>>
        +normalizarPlaca(bruta) string
        +esPlacaPlausible(placa) boolean
    }
    class Clasificar {
        <<dominio · puro>>
        +CODIGO_DE_CLASE
        +clasificarPorPlaca(placa) Clasificacion
    }
    class CodigoLegible {
        <<dominio>>
        +siguienteCodigo(contexto) string
    }
    class Resolucion {
        <<tipo union>>
        tipo: entrada o salida
        placa: string
        tipoVehiculoId: string
        tarifa: string?
        convenio: string?
        sinTarifa: boolean
    }
    class Movimiento {
        <<entidad>>
        id: uuid
        parqueaderoId: uuid
        codigo: string
        placa: string?
        tipoVehiculoId: uuid
        entradaEn: timestamp
        salidaEn: timestamp?
        operarioEntrada: string
        sesionEntrada: uuid?
    }
    class Contexto {
        <<ámbito>>
        parqueaderoId: uuid
        usuario: string
        rol: Rol
    }

    PaginaTaquilla --> CampoPlaca : contiene
    CampoPlaca ..> AccionesTaquilla : invoca
    AccionesTaquilla --> Resolver : consulta
    AccionesTaquilla --> Registrar : confirma
    Resolver ..> Placa : normaliza
    Resolver ..> Clasificar : deduce el tipo
    Resolver --> Resolucion : devuelve
    Registrar ..> Placa : normaliza
    Registrar ..> Clasificar : deduce el tipo
    Registrar ..> CodigoLegible : pide el código
    Registrar --> Movimiento : crea
    AccionesTaquilla ..> Contexto : resuelve de la sesión
    Registrar ..> Contexto : exige permiso y ámbito
```

## Qué hace cada pieza

| Módulo | Responsabilidad | Por qué está separado |
|---|---|---|
| `campo-placa.tsx` | El único campo de la pantalla | Es el control que el operario usa todo el día; vive aparte para poder probar su comportamiento sin montar la página entera |
| `acciones.ts` | Frontera entre navegador y servidor | Aquí se resuelve la sesión. Nada de lo que llega del cliente decide el establecimiento |
| `resolver.ts` | Decide si es entrada o salida | El operario no elige: el sistema lo deduce de si la placa ya está adentro |
| `registrar.ts` | Escribe el movimiento | Exige el permiso `taquilla.entrada` antes de tocar la base |
| `placa.ts` | Normaliza y valida | Puro: sin base de datos ni reloj. `abc 123` y `ABC-123` son el mismo vehículo |
| `clasificar.ts` | Deduce carro o moto | Puro y aislado a propósito: es una convención colombiana, no una ley, y tiene que poder cambiar sin tocar la taquilla |

## La relación que importa

`Contexto` no es un parámetro más. Lleva el establecimiento resuelto **desde la
sesión**, y la base de datos rechaza cualquier consulta que llegue sin él. Por
eso aparece como dependencia tanto de las acciones como del dominio: es lo que
impide que un establecimiento alcance los datos de otro.
