# CU-08 · Modelo de base de datos

```mermaid
erDiagram
    PARQUEADERO ||--o{ MOVIMIENTO : "registra"
    PARQUEADERO ||--o{ TARIFA : "declara"
    PARQUEADERO ||--o{ CONVENIO : "acuerda"
    PARQUEADERO ||--o{ HORARIO : "declara"
    PARQUEADERO ||--|| POLITICA_COBRO : "declara"
    CONVENIO ||--o{ CONVENIO_PLACA : "cubre"
    TIPO_VEHICULO ||--o{ TARIFA : "se cobra con"
    TIPO_VEHICULO ||--o{ MOVIMIENTO : "clasifica"
    SESION_TURNO ||--o{ MOVIMIENTO : "atribuye la salida"
    MOVIMIENTO ||--o{ CORRECCION : "puede corregirse con"

    MOVIMIENTO {
        uuid id PK
        uuid parqueadero_id FK
        text placa
        timestamptz entrada_en
        timestamptz salida_en "se llena aquí"
        int importe "entero, en pesos"
        jsonb cobro "COPIA del desglose"
        text operario_salida FK
        uuid sesion_salida FK
        text cortesia_motivo
        text cortesia_por FK
        int cortesia_importe_omitido
    }
    TARIFA {
        uuid id PK
        int tarifa_minima
        int valor_minuto
        int intervalo_minutos
        int valor_intervalo
        int tarifa_plena
        timestamptz vigente_desde
        timestamptz vigente_hasta "nulo si rige"
    }
    CONVENIO {
        uuid id PK
        text nombre "el comercio"
        text activacion "por placa o por sello"
        text beneficio
        int valor
        int tope_pesos
        int limite_diario
        boolean activo
        timestamptz vigente_desde
        timestamptz vigente_hasta
    }
    CONVENIO_PLACA {
        uuid convenio_id FK
        uuid parqueadero_id FK
        text placa
    }
    POLITICA_COBRO {
        uuid parqueadero_id PK
        text regla_redondeo "peso, cincuentena o centena"
        boolean cobra_horas_cerradas
    }
    CORRECCION {
        uuid id PK
        uuid movimiento_id FK
        text motivo
        text autorizada_por FK
        timestamptz registrada_en
    }
```

## La decisión central: `cobro` es una copia, no una referencia

La columna `cobro` es un documento **embebido**, no una llave foránea a `TARIFA`
ni a `CONVENIO`. Guarda el desglose completo tal como se calculó en ese
instante.

Si fuera una referencia, cambiar una tarifa mañana alteraría lo que se cobró
ayer, y el historial dejaría de poder explicarse. Guardar la copia cuesta
espacio y resuelve el problema para siempre.

| | Con referencia | Con copia |
|---|---|---|
| Cambiar la tarifa hoy | Altera cobros pasados | No los toca |
| Borrar un convenio | Rompe el historial | El historial sigue íntegro |
| Explicar un cobro de hace un año | Imposible si la tarifa cambió | Está todo en la fila |

## El movimiento cerrado es inmutable

En cuanto `salida_en` deja de ser nulo, la fila no se puede modificar ni borrar.
**Eso no se confía al código de la aplicación**: lo impide un disparador
declarado en `blindaje.sql`.

La garantía no puede depender de que quien escriba la próxima consulta se
acuerde de la regla.

Por eso existe `CORRECCION`: si hubo un error, se registra un asiento nuevo que
apunta al original, con quién lo hizo y por qué. El historial crece, nunca se
reescribe.

## Los importes son enteros

Todas las columnas de dinero son `integer`, en pesos colombianos. Nunca punto
flotante.

El punto flotante no representa exactamente los decimales y los errores se
acumulan al sumar. En un producto cuya función principal es cuadrar la caja al
cierre, un peso de diferencia es un fallo.

## La cortesía deja rastro

Cerrar sin cobro no es dejar el importe en cero. Se registran tres cosas
aparte: el motivo escrito, quién lo autorizó y **cuánto se habría cobrado**. Sin
ese último dato no se puede saber cuánto dinero dejó de entrar por cortesías.
