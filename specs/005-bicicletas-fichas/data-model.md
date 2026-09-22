# Modelo de datos — Bicicletas y fichas

Una tabla nueva, tres columnas nuevas en `movimiento`, una columna nueva en la política de
cobro. Todo lo demás se reutiliza.

---

## Tabla nueva: `ficha`

Un tarjetón físico numerado que pertenece a un establecimiento.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid | clave primaria |
| `parqueadero_id` | uuid | **con política RLS**, forzada por el recorrido de `blindaje.sql` |
| `numero` | integer | correlativo desde 1, único dentro del establecimiento |
| `estado` | enum | `activa`, `perdida`, `dada_de_baja` |
| `nota` | text | por qué se dio de baja o cuándo se perdió; nulo si está activa |
| `creada_en` | timestamptz | |
| `actualizada_en` | timestamptz | |

**Índices y restricciones**

- `uniqueIndex(parqueadero_id, numero)` — la ficha 7 es una sola dentro del local
- `check(numero >= 1)`
- `index(parqueadero_id) where estado = 'activa'` — es lo que se consulta al recibir

**Por qué el estado NO incluye `entregada`.** Está razonado en `research.md`, D1: "entregada"
es derivable de tener un movimiento abierto, y guardar algo derivable abre la puerta a que
las dos versiones difieran. De cara al usuario los estados siguen siendo cuatro; el cuarto
se calcula.

### Transiciones

```
                 dar de baja
   ┌─────────┐ ─────────────► ┌──────────────┐
   │ activa  │                │ dada_de_baja │
   └─────────┘ ◄───────────── └──────────────┘
     │    ▲       reactivar
     │    │
     │    │ el cliente la devuelve después
     │    │
     ▼    │
   ┌──────────┐
   │ perdida  │
   └──────────┘
```

- **activa → perdida**: al cerrar un movimiento declarando que el tarjetón no volvió
- **perdida → activa**: cuando aparece; lo hace el administrador
- **activa → dada_de_baja**: cuando se rompe. **Prohibido mientras tenga un movimiento
  abierto**: la bicicleta todavía tiene que poder salir
- **dada_de_baja → activa**: se permite; una ficha dada de baja por error se recupera

Ninguna transición borra la fila. Dar de baja es un estado, por el Principio IV.

---

## Columnas nuevas en `movimiento`

| Columna | Tipo | Notas |
|---|---|---|
| `ficha_id` | uuid nulo | referencia a `ficha`. Nulo en los movimientos con placa |
| `cedula` | text nulo | **dato personal**, se purga |
| `telefono` | text nulo | **dato personal**, se purga |
| `nota_vehiculo` | text nulo | **dato personal**, se purga: describe a alguien tanto como su teléfono |
| `ficha_perdida` | boolean | falso por defecto; verdadero cuando el tarjetón no volvió |

**Restricciones**

- `uniqueIndex(parqueadero_id, ficha_id) where salida_en is null` — **la garantía de D1**:
  una ficha no puede estar entregada a dos bicicletas a la vez, aunque dos taquillas
  reciban en el mismo instante
- `check` — o hay `placa` o hay `ficha_id`, nunca los dos ni ninguno. Un movimiento se
  identifica de una sola manera
- `check` — `ficha_id` no nulo obliga a `cedula` y `telefono` no nulos **mientras el
  movimiento esté abierto**. Después de la purga pueden quedar en nulo, y eso es correcto
- `index(parqueadero_id, cedula) where salida_en is null` — la búsqueda de la historia 4

**La placa se vuelve opcional.** Hoy `movimiento.placa` es `not null`. Pasa a ser nula para
los movimientos de bicicleta. Es el cambio más invasivo de esta funcionalidad y hay que
tratarlo con cuidado: todo lo que hoy lee `placa` dando por hecho que existe tiene que
revisarse. La migración deja intactos los movimientos que ya hay.

---

## Columna nueva en `politica_cobro`

| Columna | Tipo | Notas |
|---|---|---|
| `reposicion_ficha` | integer | pesos que se cobran por un tarjetón perdido. **Cero por defecto** |

Va en la política de cobro del establecimiento y no quemada en el código porque toca dinero,
que es lo que el Principio II reserva al establecimiento.

---

## Lo que NO se crea

- **No hay tabla de clientes.** La cédula y el teléfono son columnas del movimiento. Una
  tabla de clientes sería una entidad con vida propia que habría que mantener, y no se
  necesita ninguna: nadie inicia sesión, nadie tiene perfil, nadie acumula saldo.
- **No hay tabla de "conjunto de fichas".** El conjunto es el resultado de las fichas que
  existen. Guardar además un número "total declarado" sería el mismo error de guardar algo
  derivable que se evitó con el estado.
- **No hay tipo de movimiento nuevo.** Un movimiento de bicicleta es un movimiento, con el
  mismo disparador de inmutabilidad y el mismo comprobante.

---

## Retención

Al pasar `RETENCION_MESES` desde `salida_en`, se ponen en nulo `cedula`, `telefono` y
`nota_vehiculo`. **El movimiento y su cobro se conservan**: son el historial contable que el
Principio IV protege y que los reportes de F5 necesitan.

Es la misma política que `purgarAuditoriaVencida` aplica a `intento_login` y
`acceso_denegado`, con una diferencia deliberada: allá se borra la fila entera porque es
auditoría; acá se vacían las columnas personales porque la fila es contabilidad.
