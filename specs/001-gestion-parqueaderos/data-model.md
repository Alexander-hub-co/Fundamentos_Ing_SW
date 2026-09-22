# Data Model: Parquivo

**Feature**: 001-gestion-parqueaderos · **Fecha**: 2026-08-15

Modelo de datos de F1. Toda tabla con datos de establecimiento lleva su ámbito de tenencia y una
política RLS que lo impone en la base, no en la aplicación.

## Panorama

```text
                    ┌──────────────────┐
                    │   parqueadero    │   raíz de tenencia
                    │  codigo (único)  │
                    │  estado          │
                    └────────┬─────────┘
                             │ 0..N
                    ┌────────┴─────────┐
                    │    asignacion    │   vínculo + rol
                    │  rol             │   parqueadero_id NULL = global
                    └────────┬─────────┘
                             │ 1
                    ┌────────┴─────────┐
                    │     usuario      │   (tabla de Better Auth, extendida)
                    └────────┬─────────┘
                             │ 0..N
              ┌──────────────┼──────────────┐
              │              │              │
        ┌─────┴────┐  ┌──────┴──────┐  ┌────┴──────────┐
        │ session  │  │intento_login│  │acceso_denegado│
        └──────────┘  └─────────────┘  └───────────────┘
```

## Convenciones

- Claves primarias `uuid` generadas por la aplicación.
- Marcas de tiempo `timestamptz`, siempre en UTC. La presentación en hora local es
  responsabilidad de la interfaz.
- Nombres de tabla y columna en español, para que el vocabulario del código coincida con el del
  negocio y con la especificación.
- Variable de sesión de ámbito: **`app.parqueadero_id`**.

---

## Tabla `parqueadero`

Raíz de tenencia. Todo dato operativo del producto cuelga de ella.

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK |
| `codigo` | text | ÚNICO, NOT NULL, **inmutable** — FR-016 |
| `nombre` | text | NOT NULL |
| `direccion` | text | opcional |
| `ciudad` | text | opcional |
| `telefono` | text | opcional |
| `estado` | `estado_parqueadero` | NOT NULL, default `activo` — FR-023 |
| `creado_en` | timestamptz | NOT NULL |
| `actualizado_en` | timestamptz | NOT NULL |

**Inmutabilidad de `codigo`**: se impone con un disparador que rechaza cualquier `UPDATE` que lo
modifique. Una restricción de aplicación no alcanza: FR-016 dice "inmutable durante toda la vida
del establecimiento", y eso debe sobrevivir a cualquier código futuro.

**No hay restricción de unicidad sobre `nombre` ni sobre ningún dato del negocio.** Es la
contrapartida aceptada en clarificación (FR-017): el sistema no puede detectar que un mismo
parqueadero real se dé de alta dos veces.

### Estados y transiciones

```text
                 ┌────────────┐
        ┌───────►│  ACTIVO    │◄────────┐
        │        └──────┬─────┘         │
        │               │               │
        │        ┌──────▼─────┐         │
        │        │ SUSPENDIDO │─────────┤
        │        └──────┬─────┘         │
        │               │               │
   ┌────┴─────┐  ┌──────▼──────────┐    │
   │ PENDIENTE│─►│  DADO DE BAJA   │────┘
   └──────────┘  └─────────────────┘
                  terminal para la operación;
                  sólo se sale por reactivación
                  explícita a ACTIVO (FR-041)
```

| Estado | Acceso de sus usuarios |
|---|---|
| `activo` | Pleno |
| `pendiente` | Pleno. Es una marca de gestión del administrador general —"me debe, todavía no le corto"— sin ninguna consecuencia operativa |
| `suspendido` | **Modo restringido**: cerrar movimientos abiertos y cobrarlos; nada más — FR-027, FR-028 |
| `dado_de_baja` | Ninguno — FR-041 |

### Política RLS

```sql
ALTER TABLE parqueadero ENABLE ROW LEVEL SECURITY;
ALTER TABLE parqueadero FORCE ROW LEVEL SECURITY;

CREATE POLICY parqueadero_ambito ON parqueadero
  USING (id = current_setting('app.parqueadero_id', true)::uuid);
```

`FORCE` es obligatorio: sin él, el dueño de la tabla ignora la política. El rol de la aplicación
además nunca debe ser el dueño ni tener `BYPASSRLS`.

---

## Tabla `usuario`

Es la tabla `user` de Better Auth con campos adicionales. Better Auth gestiona `id`, `name`,
`email`, `emailVerified`, `image`, `createdAt`, `updatedAt`, y el plugin de administración añade
`role`, `banned`, `banReason`, `banExpires`.

| Columna añadida | Tipo | Reglas |
|---|---|---|
| `debe_cambiar_password` | boolean | NOT NULL, default `true` — FR-033 |
| `anonimizada_en` | timestamptz | NULL; no nulo ⇒ cuenta anonimizada — FR-044 |

**Campos personales** (FR-043), los únicos que la anonimización toca: `name`, `email`, `image`.

**Anonimización** (FR-044 a FR-046): `name` y `email` se sustituyen por marcadores irreversibles
—el correo por un valor único sin significado, para no violar su restricción de unicidad—, se
fija `anonimizada_en`, se eliminan las credenciales y se revocan todas las sesiones. La fila
sobrevive con su `id` intacto, de modo que ninguna referencia histórica se rompe.

**Bloqueo administrativo** (`banned`) y **anonimización** son independientes del estado del
establecimiento (FR-039).

---

## Tabla `asignacion`

Vínculo entre una cuenta y el establecimiento sobre el que opera, con el rol que ejerce.

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK |
| `usuario_id` | uuid | FK → `usuario`, **ÚNICO** — FR-020: una cuenta, un establecimiento |
| `parqueadero_id` | uuid | FK → `parqueadero`, NULL para el rol global |
| `rol` | `rol_usuario` | NOT NULL — FR-002 |
| `creada_en` | timestamptz | NOT NULL |

`rol_usuario` = (`admin_general`, `admin_parqueadero`, `operario`) — exactamente los tres roles
que exige FR-002.

**Invariante clave**, impuesta con restricción CHECK:

```sql
CHECK (
  (rol = 'admin_general'  AND parqueadero_id IS NULL) OR
  (rol <> 'admin_general' AND parqueadero_id IS NOT NULL)
)
```

Un administrador general no pertenece a ningún establecimiento; los otros dos roles siempre
pertenecen a uno. Esto hace estructuralmente imposible un usuario de establecimiento sin ámbito,
que es el caso que el escenario 3 de la historia 2 exige denegar.

**El índice único sobre `usuario_id`** es la traducción literal de la decisión de clarificación.
Cuando se habilite multi-sede, se reemplaza por un único parcial "una asignación activa por
usuario" y se añade el selector de sede: la tabla no cambia de forma.

### Política RLS

```sql
CREATE POLICY asignacion_ambito ON asignacion
  USING (parqueadero_id = current_setting('app.parqueadero_id', true)::uuid);
```

Las asignaciones globales (`parqueadero_id IS NULL`) quedan fuera de toda consulta con ámbito,
que es lo correcto: sólo son visibles por la conexión privilegiada.

---

## Tabla `intento_login`

Sostiene la demora progresiva (FR-006, FR-007) y su registro de auditoría (FR-008).

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK |
| `email_intentado` | text | NOT NULL — se guarda aunque la cuenta no exista |
| `usuario_id` | uuid | FK → `usuario`, NULL si el correo no corresponde a ninguna cuenta |
| `origen` | text | dirección de origen de la petición |
| `exito` | boolean | NOT NULL |
| `ocurrido_en` | timestamptz | NOT NULL |

**Cálculo de la demora**: se cuentan los intentos fallidos consecutivos del mismo
`email_intentado` desde su último éxito. Los primeros 3 no tienen penalización; a partir de ahí
la espera crece exponencialmente (2s, 4s, 8s, 16s) **con tope de 30 segundos**.

El tope es lo que garantiza FR-007: la espera nunca crece sin límite, así que la cuenta jamás
queda inaccesible de forma permanente. Un ataque automatizado queda reducido a 2 intentos por
minuto, que es inviable; un operario que se equivocó espera medio minuto en el peor caso.

Se cuenta por correo intentado y no por cuenta, para que el mecanismo también proteja a los
correos que no existen y no revele cuáles sí.

**Ámbito**: tabla de plataforma. Sin política de tenencia; sólo la alcanza la conexión
privilegiada.

---

## Tabla `acceso_denegado`

Constancia de intentos de operar fuera de ámbito (FR-005).

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | PK |
| `usuario_id` | uuid | FK → `usuario`, NULL si no había sesión |
| `recurso` | text | NOT NULL — qué se intentó alcanzar |
| `parqueadero_ambito` | uuid | ámbito que tenía la sesión |
| `ocurrido_en` | timestamptz | NOT NULL |

**Ámbito**: tabla de plataforma, igual que la anterior.

---

## Tablas de Better Auth

`session`, `account` y `verification` conservan el esquema que define la librería.

**Decisión de ámbito, y su justificación**: son tablas de plataforma, no de tenencia. La razón es
estructural: **la autenticación ocurre antes de que exista un ámbito**. Para resolver un correo a
una cuenta hay que consultar sin saber todavía a qué parqueadero pertenece. Por lo tanto el
camino de autenticación necesariamente usa la conexión privilegiada.

Es la única excepción legítima al aislamiento, y por eso se acota de forma explícita: sólo el
módulo de autenticación la ejerce, y ninguna operación de negocio puede alcanzarla. Una vez
establecida la sesión, todo el resto del sistema opera con la conexión sujeta a RLS.

---

## Los dos roles de base de datos

| Rol | Atributos | Quién lo usa |
|---|---|---|
| `app_tenant` | sin `BYPASSRLS`, no es dueño de ninguna tabla | Toda operación con ámbito de parqueadero |
| `app_platform` | `BYPASSRLS` | Autenticación y operaciones del administrador general |
| `app_migrator` | dueño del esquema | Sólo migraciones; nunca la aplicación en ejecución |

Separar `app_platform` de `app_tenant` es lo que hace que el privilegio global sea "explícito en
cada punto donde se ejerce", como exige FR-013: para saltarse el aislamiento hay que pedir
deliberadamente la otra conexión, y eso se ve en el código y en una revisión.

## Reglas de validación derivadas de los requisitos

| Regla | Origen | Dónde se impone |
|---|---|---|
| Una cuenta, un establecimiento | FR-020 | Índice único en `asignacion.usuario_id` |
| Rol global ⇔ sin parqueadero | FR-002, FR-013 | CHECK en `asignacion` |
| Código de parqueadero inmutable | FR-016 | Disparador en `parqueadero` |
| Toda consulta con ámbito o falla | FR-010 | Políticas RLS + envoltorio transaccional |
| Historial indestructible | FR-042 | Sin `ON DELETE CASCADE`; sin borrado físico |
| Cambio de contraseña obligatorio | FR-033 | `usuario.debe_cambiar_password` |
| Cuenta anonimizada no autentica | FR-046 | `anonimizada_en` + credenciales eliminadas |
| Último administrador protegido | FR-037 | Verificación previa en la operación, con confirmación |
