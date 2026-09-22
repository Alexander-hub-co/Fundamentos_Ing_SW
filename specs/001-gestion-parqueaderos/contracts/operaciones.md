# Contratos de operaciones — F1

**Feature**: 001-gestion-parqueaderos · **Fecha**: 2026-08-15

Interfaz que F1 expone. Al ser una aplicación web con lógica en el servidor, el contrato son las
operaciones invocables desde la interfaz, no una API pública. Cada una declara con qué conexión
corre, porque de eso depende el aislamiento.

## Contrato interno obligatorio: el acceso a datos

Antes de las operaciones de negocio, el contrato del que dependen todas. Existen exactamente dos
formas de tocar la base, y ninguna otra está permitida:

```ts
// Conexión sujeta a RLS. Fija el ámbito y abre transacción.
// Es el único camino para datos de establecimiento.
conAmbito<T>(parqueaderoId: string, fn: (tx: Tx) => Promise<T>): Promise<T>

// Conexión privilegiada, sin RLS. Cada uso es una decisión deliberada.
comoPlataforma<T>(motivo: MotivoPrivilegiado, fn: (tx: Tx) => Promise<T>): Promise<T>
```

**Garantías que `conAmbito` debe cumplir**:

1. Abre una transacción explícita y ejecuta `set_config('app.parqueadero_id', $1, true)` dentro
   de ella, antes de cualquier consulta. Fuera de transacción la variable no persiste y las
   políticas evaluarían sin ámbito.
2. Usa el pool del rol `app_tenant`, que no tiene `BYPASSRLS`.
3. No expone la conexión fuera del ámbito de `fn`.

**Garantías que `comoPlataforma` debe cumplir**:

1. Exige un `MotivoPrivilegiado` explícito de un conjunto cerrado —`autenticacion`,
   `administracion_plataforma`— que queda registrado. No es un parámetro decorativo: es lo que
   hace auditable el uso del privilegio, como exige FR-013.
2. Nunca se invoca desde código de interfaz ni desde operaciones de establecimiento.

Toda consulta que no pase por una de las dos es un defecto, y la revisión debe tratarlo como tal.

---

## Autenticación

### `iniciarSesion(email, password)`

**Actor**: cualquiera · **Conexión**: `comoPlataforma('autenticacion')`

| Resultado | Condición |
|---|---|
| Sesión establecida | Credenciales válidas, cuenta no bloqueada ni anonimizada, establecimiento no dado de baja |
| `CREDENCIALES_INVALIDAS` | Correo o contraseña incorrectos. Mensaje idéntico en ambos casos, para no revelar qué correos existen |
| `DEBE_CAMBIAR_PASSWORD` | Credenciales válidas pero `debe_cambiar_password`; sesión limitada a esa única acción — FR-033 |
| `CUENTA_BLOQUEADA` | `banned` — FR-036 |
| `ESTABLECIMIENTO_SIN_ACCESO` | Establecimiento `dado_de_baja` — FR-041 |
| `DEMORA_ACTIVA(segundos)` | Hay demora acumulada por fallos previos — FR-006 |

Registra el intento, con éxito o sin él (FR-008). Ante fallo, aplica la demora antes de
responder. La demora **nunca** se convierte en bloqueo (FR-007).

### `cambiarPasswordObligatorio(nuevaPassword)`

**Actor**: cuenta autenticada con `debe_cambiar_password` · **Conexión**: `comoPlataforma('autenticacion')`

Fija la contraseña nueva y baja la marca. Hasta que se complete, ninguna otra operación del
sistema debe atender a esta sesión (FR-033).

### `cerrarSesion()`

Revoca la sesión actual en la base, no sólo la cookie.

---

## Administración de la plataforma

Todas exigen rol `admin_general`. **Conexión**: `comoPlataforma('administracion_plataforma')`.

### `crearParqueadero(datos)`

Entrada: `nombre` (obligatorio), `direccion`, `ciudad`, `telefono`.

Genera el `codigo` interno único e inmutable y crea el establecimiento en estado `activo`
(FR-016, FR-014). No valida duplicación contra el mundo real: no puede (FR-017).

### `editarParqueadero(id, datos)`

Modifica los datos descriptivos. **Rechaza cualquier intento de alterar `codigo`** (FR-016).

### `cambiarEstadoParqueadero(id, nuevoEstado, motivo)`

Aplica una transición válida según la máquina de estados. Efectos:

- A `suspendido`: los usuarios del establecimiento pasan a modo restringido en menos de un minuto,
  incluidos los que tengan sesión abierta (FR-027, SC-004).
- A `dado_de_baja`: los usuarios pierden todo acceso (FR-041).
- A `activo`: se restituye el acceso pleno sin pérdida de información (FR-029).

Ningún cambio de estado destruye información (FR-040).

### `listarParqueaderos(filtros)`

Devuelve todos los establecimientos con estado y responsables (FR-021). Este es un ejercicio del
privilegio global, y como tal queda registrado (escenario 4 de la historia 2).

### `crearCuenta(email, nombre, passwordTemporal, rol, parqueaderoId)`

Crea la cuenta con `debe_cambiar_password = true` y su asignación (FR-031, FR-032).

| Error | Condición |
|---|---|
| `CORREO_YA_REGISTRADO` | El correo ya existe |
| `AMBITO_INVALIDO` | `admin_general` con parqueadero, o rol de establecimiento sin él |
| `CUENTA_YA_ASIGNADA` | La cuenta ya pertenece a otro establecimiento — FR-020 |

### `restablecerPassword(usuarioId, passwordTemporal)`

Fija una temporal nueva y vuelve a marcar `debe_cambiar_password` (FR-034).

### `bloquearCuenta(usuarioId)` / `desbloquearCuenta(usuarioId)`

Bloquear revoca de inmediato las sesiones activas (FR-004). Si la cuenta es la única
administradora de un establecimiento, devuelve `REQUIERE_CONFIRMACION` y sólo procede con
confirmación explícita (FR-037).

### `darDeBajaCuenta(usuarioId)`

Baja lógica. Nunca borrado físico si hay referencias históricas (FR-042). Misma protección de
último administrador.

### `anonimizarCuenta(usuarioId)`

Sustituye los campos personales por marcadores irreversibles, elimina credenciales y revoca
sesiones. La fila y todas sus referencias sobreviven (FR-044 a FR-046).

Devuelve `REQUIERE_CONFIRMACION` en el primer llamado: es irreversible por definición y no debe
poder ejecutarse de un clic accidental.

### `obtenerResumenPlataforma()`

Contadores de establecimientos activos, suspendidos y total de cuentas (FR-049). Debe responder
en menos de 2 segundos con 1.000 establecimientos (SC-007).

---

## Operaciones de establecimiento

**Conexión**: `conAmbito(parqueaderoIdDeLaSesion)`. El ámbito sale **siempre** de la sesión
autenticada, nunca de un parámetro recibido (FR-009).

### `obtenerMiParqueadero()` / `editarMiParqueadero(datos)`

**Actor**: `admin_parqueadero`. Consulta y edita su propio establecimiento (FR-022).

No reciben identificador de establecimiento: no hay nada que pasar, porque el ámbito ya está
fijado en la transacción. Es deliberado — un parámetro que no existe no se puede manipular.

---

## Contrato de errores de ámbito

Toda solicitud de un recurso fuera de ámbito responde **exactamente igual que si el recurso no
existiera** (FR-011). No debe distinguirse por código de estado, por mensaje, ni por tiempo de
respuesta. Cada ocurrencia se registra en `acceso_denegado` (FR-005).
