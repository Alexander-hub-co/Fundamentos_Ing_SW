# Quickstart — Validación de F1

**Feature**: 001-gestion-parqueaderos · **Fecha**: 2026-08-15

Cómo levantar F1 y comprobar que cumple lo que la especificación promete. No contiene código de
implementación: eso pertenece a `tasks.md` y a la fase de implementación.

## Requisitos previos

- Node.js 24 LTS
- PostgreSQL 16 o superior, con permiso para crear roles
- Una base de datos vacía para desarrollo y otra para pruebas

## Puesta en marcha

1. Instalar dependencias.
2. Configurar variables de entorno: cadenas de conexión de los tres roles (`app_migrator`,
   `app_platform`, `app_tenant`) y el secreto de sesión.
3. Ejecutar las migraciones con el rol `app_migrator`, que crea el esquema, las políticas RLS y
   los tres roles con sus permisos.
4. Ejecutar la semilla, que crea la única cuenta de administrador general inicial. Esa cuenta no
   se crea desde la interfaz, según la suposición declarada en la especificación.
5. Levantar la aplicación en modo desarrollo.

## Verificación de la barrera de aislamiento

**Esta es la validación que no se puede omitir.** El Principio I es no negociable y la
constitución exige comprobarlo con pruebas automatizadas, no a ojo.

### V1 — La base rechaza, no la aplicación

Objetivo: demostrar que el aislamiento sobrevive a un error de programación.

1. Crear dos establecimientos, A y B, cada uno con un administrador.
2. Abrir una transacción con el ámbito de A.
3. Ejecutar **SQL crudo, sin ninguna cláusula de filtrado**, pidiendo todas las filas de
   `parqueadero`.
4. **Esperado**: devuelve únicamente la fila de A.

Si devolviera ambas, la política no está activa, o el rol de la conexión es dueño de la tabla, o
tiene `BYPASSRLS`. Cualquiera de las tres invalida el diseño completo.

### V2 — Sin ámbito no se devuelve todo

1. Abrir una transacción **sin** fijar `app.parqueadero_id`.
2. Consultar `parqueadero`.
3. **Esperado**: cero filas. Nunca el conjunto completo (FR-010).

### V3 — El ámbito no viaja por parámetro

1. Autenticarse como administrador de A.
2. Invocar operaciones de establecimiento intentando inyectar el identificador de B por todos los
   medios disponibles: cuerpo de la petición, parámetros de ruta, cabeceras.
3. **Esperado**: ninguna vía altera el ámbito; todas responden sobre A (FR-009).

### V4 — Indistinguible de inexistente

1. Como administrador de A, solicitar un recurso de B por identificador directo.
2. Solicitar un recurso con un identificador inventado.
3. **Esperado**: ambas respuestas idénticas en código, mensaje y tiempo perceptible (FR-011).
4. Comprobar que la primera quedó registrada en `acceso_denegado` (FR-005).

### V5 — La conexión privilegiada está acotada

1. Recorrer el código buscando invocaciones de `comoPlataforma`.
2. **Esperado**: sólo aparecen en el módulo de autenticación y en las operaciones del
   administrador general, cada una con su motivo declarado (FR-013).

## Verificación del ciclo de vida de cuentas

### V6 — Contraseña temporal y cambio obligatorio

1. Crear una cuenta con contraseña temporal.
2. Iniciar sesión con ella.
3. **Esperado**: no se puede hacer absolutamente nada más que cambiar la contraseña (FR-033).
4. Cambiarla y verificar que el acceso normal queda habilitado.

### V7 — Demora progresiva sin bloqueo

1. Fallar el inicio de sesión de una cuenta seis veces seguidas.
2. **Esperado**: la espera crece con cada intento, con tope de 30 segundos.
3. Esperar el tope e intentar con la contraseña correcta.
4. **Esperado**: entra. La cuenta nunca quedó bloqueada y nadie tuvo que intervenir (FR-007,
   SC-009).

### V8 — Anonimización que no rompe el histórico

1. Anonimizar una cuenta que tenga registros asociados.
2. **Esperado**: sus datos personales dejan de ser recuperables, no puede autenticarse, y todos
   los registros que la referencian siguen existiendo y apuntando a ella (FR-044 a FR-046).

## Verificación de estados

### V9 — Suspensión y reactivación sin pérdida

1. Suspender un establecimiento con usuarios de sesión abierta.
2. **Esperado**: entran en modo restringido en menos de un minuto (SC-004).
3. Reactivarlo.
4. **Esperado**: acceso pleno restituido, información idéntica a la previa (SC-006).

### V10 — Transiciones inválidas rechazadas

Recorrer la máquina de estados intentando cada transición no contemplada.
**Esperado**: todas rechazadas, y el estado nunca queda en un valor fuera del enum (FR-023).

## Rendimiento

### V11 — Panel con volumen realista

1. Poblar 1.000 establecimientos.
2. Medir el listado general y el panel de contadores.
3. **Esperado**: ambos completos en menos de 2 segundos (SC-007).

## Criterio de aceptación de la feature

F1 está terminada cuando V1 a V11 pasan, el conjunto de pruebas automatizadas cubre V1, V2, V4,
V6, V7 y V8, y el checklist de calidad de la especificación sigue en 16/16.

Las verificaciones V9 en su parte de movimientos abiertos quedan parcialmente pendientes hasta
F3, según la suposición ya declarada en la especificación: el punto de control se implementa y se
prueba en F1, pero su efecto sobre movimientos reales sólo es observable cuando existan.


---

## Resultados del recorrido (2026-08-16)

Ejecutado contra PostgreSQL 18.4 real, sobre `parquivo_test`. **169 pruebas en
verde, 20 archivos.**

| Verificación | Estado | Dónde vive |
|---|---|---|
| V1 — La base rechaza, no la aplicación | ✅ automatizada | `tests/aislamiento/v1-base-rechaza.test.ts` |
| V2 — Sin ámbito no se devuelve todo | ✅ automatizada | `tests/aislamiento/v2-sin-ambito.test.ts` |
| V3 — El ámbito no viaja por parámetro | ✅ automatizada | `tests/aislamiento/v3-parametros.test.ts` |
| V4 — Indistinguible de inexistente | ✅ automatizada | `tests/aislamiento/v4-indistinguible.test.ts` |
| V5 — La conexión privilegiada está acotada | ✅ automatizada | `tests/aislamiento/v5-privilegio-acotado.test.ts` |
| V6 — Contraseña temporal y cambio obligatorio | ✅ automatizada | `tests/integracion/primer-ingreso.test.ts` |
| V7 — Demora progresiva sin bloqueo | ✅ automatizada | `tests/unit/demora.test.ts` |
| V8 — Anonimización que no rompe el histórico | ✅ automatizada | `tests/integracion/anonimizacion.test.ts` |
| V9 — Suspensión y reactivación sin pérdida | ⚠️ parcial | `tests/integracion/estados.test.ts` |
| V10 — Transiciones inválidas rechazadas | ✅ automatizada | `tests/unit/transiciones.test.ts` |
| V11 — Panel con volumen realista | ✅ automatizada | `tests/integracion/rendimiento-panel.test.ts` |

**V9 queda parcial, como estaba previsto.** Su parte de movimientos abiertos no
es verificable hasta F3, porque los movimientos todavía no existen. Lo que sí
está probado es el punto de control: con el establecimiento suspendido, la
consulta sigue disponible y la modificación se rechaza. Cuando F3 traiga las
entradas y salidas, esa misma comprobación cubrirá el caso completo.

### Mediciones de V11

Con 1.000 establecimientos, el volumen declarado en SC-007 (límite: 2.000 ms):

| Operación | Tiempo |
|---|---|
| Panel de contadores | 39 ms |
| Listado completo | 129 ms |
| Listado filtrado por estado | 52 ms |

El margen es amplio a propósito. Esa prueba no busca detectar diferencias de
milisegundos, sino una consulta que crezca por establecimiento.

### Comprobado a mano contra la base de desarrollo

Tres cosas que no tiene sentido automatizar porque verifican la configuración de
una instancia concreta:

- `FORCE ROW LEVEL SECURITY` activo en `parqueadero` y `asignacion`.
- El disparador rechaza un `UPDATE` sobre el código del establecimiento, incluso
  ejecutado con el rol dueño del esquema.
- La guardia de migración aborta si aparece una tabla con `parqueadero_id` sin
  política RLS. Se comprobó creando una a propósito.

### Verificaciones añadidas después de escribir este documento

- **`tests/aislamiento/use-server.test.ts`** — un archivo con `"use server"`
  sólo puede exportar funciones asíncronas. Nace de un defecto real que ni el
  compilador ni el linter detectan: sólo se manifiesta en el navegador.
- **`tests/integracion/sin-recuperacion.test.ts`** — falla si aparece cualquier
  ruta de recuperación de contraseña autogestionada. Protege una decisión de
  **no** construir algo, que es la clase de decisión que se pierde en silencio.
