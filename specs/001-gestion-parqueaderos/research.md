# Research: Parquivo

**Feature**: 001-gestion-parqueaderos · **Fecha**: 2026-08-15

Resuelve las incógnitas técnicas de la especificación. Las tres decisiones de partida —lenguaje,
estrategia de aislamiento e infraestructura— las tomó el usuario; el resto se deriva de ellas y
de la constitución.

---

## D1 — Aislamiento multi-parqueadero: RLS de PostgreSQL

**Decisión**: columna de tenencia en cada tabla más políticas Row-Level Security de PostgreSQL,
con el ámbito propagado por variable de sesión dentro de una transacción.

**Racional**: el Principio I exige que una consulta sin ámbito resuelto falle en lugar de
devolver todo. Implementar eso sólo en la aplicación deja la garantía a merced de que ningún
desarrollador olvide nunca un `where`. Con RLS la base rechaza la fila aunque la consulta esté
mal escrita: el error se vuelve inofensivo en lugar de convertirse en una fuga silenciosa.

**Restricción crítica que condiciona toda la arquitectura**: `SET LOCAL` y `set_config(..., true)`
sólo viven dentro de una transacción. Una consulta ejecutada fuera de transacción no ve la
variable, y la política la evalúa como si no hubiera ámbito. Por lo tanto **todo acceso a datos
de la aplicación MUST ocurrir dentro de una transacción explícita**, sin excepción. Esto no es
un detalle de implementación: es la condición de validez del Principio I.

**Dos trampas conocidas que hay que neutralizar desde la primera migración**:

1. El dueño de una tabla ignora RLS por defecto. Hay que declarar
   `ALTER TABLE ... FORCE ROW LEVEL SECURITY` y que la aplicación se conecte con un rol que
   **no** sea el dueño.
2. Un rol con atributo `BYPASSRLS` (o superusuario) atraviesa todas las políticas. El rol de la
   aplicación nunca debe tenerlo.

**Alternativas descartadas**:

- *Sólo filtrado en la aplicación*: más simple, funciona en cualquier motor, pero una sola
  consulta que se saltee la capa es una fuga sin síntomas. Descartada por el Principio I.
- *Esquema o base por parqueadero*: aislamiento físico, pero con 1.000 establecimientos son 1.000
  esquemas que migrar en cada cambio, y el panel global tendría que consultarlos todos. Choca de
  frente con SC-007 (listado y panel en menos de 2 segundos).

---

## D2 — Privilegio del administrador general: rol de base de datos separado

**Decisión**: dos roles de PostgreSQL y dos pools de conexión. `app_tenant` para toda operación
con ámbito de parqueadero, sujeto a RLS. `app_platform` con `BYPASSRLS`, usado exclusivamente por
las operaciones del administrador general.

**Racional**: FR-013 exige que el privilegio global sea "explícito en cada punto donde se ejerce".
Si el privilegio dependiera de una variable de sesión (`app.rol = 'admin_general'`), un error que
la fijara mal se convertiría en acceso total, y sería indistinguible de una operación legítima.
Con roles separados, ejercer el privilegio obliga a pedir explícitamente la conexión
privilegiada: es visible en el código y auditable en una revisión.

**Alternativa descartada**: política única que contempla ambos casos según variable de sesión.
Menos infraestructura, pero convierte una variable en la frontera de seguridad de todo el
producto.

---

## D3 — Ejecución: Node.js 24 LTS

**Decisión**: Node.js 24 (Krypton), en Active LTS.

**Racional**: Node 22 entra en fin de vida alrededor de octubre de 2026 — dos meses después de
iniciar este proyecto. Arrancar sobre una versión en mantenimiento obligaría a migrar antes de
tener el primer cliente.

---

## D4 — Framework: Next.js con App Router

**Decisión**: Next.js (App Router) en TypeScript, con Server Actions y Route Handlers.

**Racional**: un solo despliegue, un solo lenguaje y un solo repositorio para paneles
administrativos y taquilla, que es lo que sostiene una persona sola. La lógica sensible corre en
el servidor por defecto, lo que encaja con FR-003 (los permisos se evalúan del lado del
servidor). Todas las plataformas gestionadas del presupuesto elegido lo despliegan sin
configuración especial.

**Consecuencia para F3**: la taquilla necesitará respuesta inmediata al teclear la placa. El
App Router lo permite, pero conviene que esa pantalla sea deliberadamente ligera. Se anota como
restricción heredada, no se resuelve aquí.

**Alternativas descartadas**: API separada más SPA (dos despliegues y dos contratos que mantener,
sin beneficio a esta escala); Remix/React Router (equivalente en capacidad, ecosistema menor).

---

## D5 — Acceso a datos: Drizzle ORM

**Decisión**: Drizzle ORM sobre `node-postgres`.

**Racional**: Drizzle declara las políticas RLS dentro del propio esquema TypeScript, con lo que
la regla de aislamiento vive versionada junto a la tabla que protege en lugar de en una migración
suelta. Además expone las transacciones de forma explícita, que es exactamente lo que D1 exige:
el envoltorio que fija el ámbito se escribe una vez y se vuelve obligatorio por construcción.

**Alternativa descartada**: Prisma. Más popular, pero abstrae la transacción y la conexión, que
es justo lo que acá necesitamos controlar; combinar su pooling con variables de sesión por
transacción es una fuente conocida de fricción.

---

## D6 — Autenticación: Better Auth con su plugin de administración

**Decisión**: Better Auth, con el plugin `admin`, sesiones persistidas en la base de datos.

**Racional**: nuestras reglas son inusuales —sin correo, contraseña temporal fijada por el
administrador general, cambio obligatorio al primer ingreso, restablecimiento manual— y descartan
la mayoría de las soluciones llave en mano. El plugin de administración de Better Auth cubre
exactamente estas operaciones del lado del servidor y **ninguna de ellas envía correo**:

| Necesidad | Método | Requisito |
|---|---|---|
| Crear cuenta con contraseña | `auth.api.createUser()` | FR-031, FR-032 |
| Fijar o restablecer contraseña | `auth.api.setUserPassword()` | FR-034 |
| Bloquear y desbloquear | `auth.api.banUser()` / `unbanUser()` | FR-036 |
| Asignar rol | `auth.api.setRole()` | FR-031 |

Las sesiones en base de datos permiten además revocarlas de inmediato, que es lo que exige FR-004
(la sesión en curso pierde acceso sin esperar a que expire).

**Verificación de vigencia**: Lucia fue deprecada en marzo de 2025 y hoy es material didáctico,
no una dependencia instalable. Auth.js quedó en modo sólo-parches de seguridad y en septiembre de
2025 pasó a formar parte de Better Auth. Recomendar cualquiera de las dos habría sido construir
sobre una base abandonada.

**Lo que NO delegamos**: la demora progresiva (FR-006 a FR-008) se implementa como lógica propia
del proyecto, porque su forma exacta —nunca bloqueo permanente— es una decisión de negocio
tomada en clarificación, no un comportamiento estándar de librería.

---

## D7 — Contraseñas: scrypt (el valor por defecto de Better Auth)

**Decisión**: scrypt, tal como lo implementa Better Auth de fábrica.

**Enmienda del 2026-08-16.** La decisión original decía "Argon2id con los parámetros por defecto
de Better Auth", y esa frase era contradictoria: Better Auth **no** usa Argon2id por defecto, usa
scrypt. Se comprobó al implementar.

**Racional de la enmienda**: scrypt es una función de derivación con coste de memoria, aceptada
para contraseñas nuevas. Forzar Argon2id exigiría enchufar un hasher propio con dependencia
nativa, lo que añade complejidad de compilación en la plataforma gestionada a cambio de una
mejora marginal frente a una alternativa que ya es adecuada. Se prefiere la ruta que la librería
mantiene y prueba.

**Cuándo reconsiderar**: si Better Auth incorpora Argon2id como opción de primera clase, o si
aparece una exigencia de cumplimiento que lo nombre explícitamente.

---

## D8 — Pruebas: Vitest sobre PostgreSQL real

**Decisión**: Vitest para pruebas unitarias y de integración, ejecutadas contra una instancia real
de PostgreSQL. Playwright queda diferido a cuando exista interfaz que valga la pena recorrer.

**Racional**: la constitución exige verificar el Principio I con pruebas automatizadas. Una
prueba de aislamiento contra una base simulada no prueba nada: lo que hay que verificar es que
*las políticas de PostgreSQL* rechazan la fila. Sustituir la base por un doble eliminaría
exactamente el sujeto de la prueba.

**Consecuencia**: el conjunto de pruebas necesita una base de datos real en local y en CI. Es un
costo de infraestructura asumido conscientemente, y la única forma de que la prueba negativa
A↛B signifique algo.

---

## D9 — Agrupación de conexiones y plataforma gestionada

**Decisión**: `node-postgres` con pool propio, compatible con el agrupador en modo transacción que
suelen anteponer las plataformas gestionadas.

**Racional**: el modo transacción es compatible con nuestro diseño precisamente porque fijamos el
ámbito con `SET LOCAL` **dentro** de una transacción: el agrupador mantiene la misma conexión
física durante toda la transacción. Un diseño que fijara variables a nivel de sesión, fuera de
transacción, se rompería de forma intermitente y muy difícil de diagnosticar bajo ese modo.

**Riesgo residual anotado**: si en el futuro se introdujera alguna consulta fuera de transacción,
fallaría de forma silenciosa. El envoltorio obligatorio de D1 es lo que lo previene, y por eso se
verifica con una prueba dedicada.

---

## Incógnitas restantes

Ninguna bloquea el diseño. Se registran para decidir en su momento:

- **Duración y expiración de sesión**: diferida por cuota en `/speckit-clarify`. Se adopta un
  valor por defecto razonable y se ajusta cuando el negocio lo exija.
- **Plataforma gestionada concreta** (Railway, Render, Fly): el diseño no depende de cuál sea.
  Basta con que ofrezca PostgreSQL gestionado y permita crear roles.
- **Impresión térmica**: pertenece a F3. La constitución ya prohíbe asumir control directo del
  navegador sobre la impresora.

## Fuentes

- [Node.js — Previous releases](https://nodejs.org/en/about/previous-releases)
- [Better Auth — Admin plugin](https://www.better-auth.com/docs/plugins/admin)
- [Drizzle ORM — Row-Level Security](https://orm.drizzle.team/docs/rls)
- [Lucia — repositorio y aviso de deprecación](https://github.com/lucia-auth/lucia)
