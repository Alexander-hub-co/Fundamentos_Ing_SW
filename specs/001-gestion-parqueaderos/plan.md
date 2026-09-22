# Implementation Plan: Parquivo

**Branch**: `001-gestion-parqueaderos` | **Date**: 2026-08-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-gestion-parqueaderos/spec.md`

## Summary

F1 construye los cimientos de la plataforma: autenticación, los tres roles, el parqueadero como
frontera de tenencia, el alta y el ciclo de estados de los establecimientos, la gestión de
cuentas y el panel global.

El enfoque técnico se organiza alrededor de una sola idea: **el aislamiento entre parqueaderos lo
impone PostgreSQL, no el código de la aplicación.** Cada tabla con datos de establecimiento lleva
una política Row-Level Security, y el ámbito se propaga por variable de sesión dentro de una
transacción obligatoria. Un desarrollador que olvide un filtro produce una consulta que devuelve
cero filas, no una que filtra datos de otro cliente. El privilegio global del administrador
general no es una bandera en el código sino un rol de base de datos distinto, con su propio pool,
que hay que pedir deliberadamente.

## Technical Context

**Language/Version**: TypeScript sobre Node.js 24 LTS (Krypton). Node 22 entra en fin de vida en
octubre de 2026, dos meses después de arrancar el proyecto.

**Primary Dependencies**: Next.js (App Router) · Drizzle ORM sobre `node-postgres` · Better Auth
con su plugin de administración

**Storage**: PostgreSQL 16+, con Row-Level Security y tres roles diferenciados

**Testing**: Vitest contra una instancia real de PostgreSQL. Las pruebas de aislamiento no admiten
base simulada: lo que hay que verificar es que las políticas del motor rechazan la fila.

**Target Platform**: plataforma gestionada (Railway, Render o Fly), presupuesto 20–50 USD/mes. El
diseño no depende de cuál sea; sólo exige PostgreSQL gestionado con permiso para crear roles.

**Project Type**: aplicación web full-stack, un solo despliegue

**Performance Goals**: listado general y panel de contadores completos en menos de 2 segundos con
1.000 establecimientos (SC-007)

**Constraints**: la suspensión debe surtir efecto sobre sesiones ya abiertas en menos de un minuto
(SC-004). Ninguna cuenta puede quedar inaccesible de forma permanente por intentos fallidos
(SC-009). F1 no depende de ningún servicio externo: no hay envío de correo.

**Scale/Scope**: 1.000 establecimientos, 5 historias de usuario, 44 requisitos funcionales

## Constitution Check

*GATE: debe pasar antes de Phase 0. Re-evaluado tras Phase 1.*

| Principio | Evaluación | Cómo lo satisface el diseño |
|---|---|---|
| **I. Aislamiento multi-parqueadero** (no negociable) | **PASA** | Políticas RLS con `FORCE`; rol de aplicación sin `BYPASSRLS` y que no es dueño de las tablas; ámbito resuelto desde la sesión y propagado por transacción; privilegio global en un rol de base separado; pruebas negativas A↛B con SQL crudo (V1–V5 del quickstart) |
| **II. Cero valores quemados** | **PASA con vigilancia** | F1 no introduce parámetros de negocio por establecimiento. Los parámetros de la demora progresiva son de plataforma, no de parqueadero; deben vivir en un único punto con nombre, nunca esparcidos como literales |
| **III. La taquilla es la ruta crítica** | **PASA** | F1 no construye taquilla, pero su decisión sobre intentos fallidos se tomó precisamente para no detenerla: demora con tope en vez de bloqueo |
| **IV. Integridad del historial** | **PASA** | Sin borrado en cascada; baja lógica por estado; anonimización que preserva la fila y sus referencias en lugar de borrarla |
| **V. Alcance deliberado** | **PASA** | Quedan fuera el envío de correo, la recuperación autogestionada, los pagos, los planes y el multi-sede. Ver Complexity Tracking por la única complejidad añadida |

**Re-evaluación tras Phase 1**: sin cambios. El diseño de datos y los contratos refuerzan los
Principios I y IV en lugar de tensionarlos. El contrato interno de acceso a datos —dos funciones,
`conAmbito` y `comoPlataforma`, y ninguna otra vía— es lo que convierte el Principio I de
intención en propiedad verificable.

## Project Structure

### Documentation (this feature)

```text
specs/001-gestion-parqueaderos/
├── plan.md              # Este archivo
├── research.md          # Phase 0: 9 decisiones técnicas
├── data-model.md        # Phase 1: tablas, políticas RLS, máquina de estados
├── quickstart.md        # Phase 1: 11 verificaciones, V1–V5 sobre aislamiento
├── contracts/
│   └── operaciones.md   # Phase 1: contrato de acceso a datos y operaciones
├── checklists/
│   └── requirements.md  # Calidad de la especificación (16/16)
└── tasks.md             # Phase 2 — lo genera /speckit-tasks, no este comando
```

### Source Code (repository root)

```text
src/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # inicio de sesión, cambio obligatorio de contraseña
│   ├── (plataforma)/           # panel del administrador general
│   └── (establecimiento)/      # panel del administrador de parqueadero
├── db/
│   ├── esquema/                # tablas y políticas RLS declaradas en Drizzle
│   ├── migraciones/
│   ├── pools.ts                # pools de app_tenant y app_platform
│   └── ambito.ts               # conAmbito() y comoPlataforma() — único acceso permitido
├── dominio/
│   ├── parqueaderos/           # alta, edición, máquina de estados
│   ├── cuentas/                # creación, bloqueo, baja, anonimización
│   ├── autenticacion/          # sesión, cambio obligatorio, demora progresiva
│   ├── plataforma/             # resumen global del administrador general
│   └── auditoria/              # accesos denegados, intentos, retención
└── lib/                        # env, sesión, autorización, errores

tests/
├── aislamiento/                # V1–V5: las pruebas que no se pueden omitir
├── integracion/                # ciclo de vida de cuentas y estados
└── unit/                       # cálculo de demora, transiciones de estado
```

**Structure Decision**: aplicación única full-stack en `src/`, sin separar frontend y backend.
Con Next.js el servidor y la interfaz comparten despliegue, tipos y repositorio, que es lo que
sostiene una persona sola. La separación relevante en este proyecto no es front/back sino
`db/ambito.ts` frente a todo lo demás: ese archivo es la frontera de seguridad del producto y por
eso vive aislado, con su propio directorio de pruebas.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Tres roles de base de datos y dos pools de conexión, en vez de una sola conexión | El Principio I exige que el privilegio global sea explícito en cada punto donde se ejerce (FR-013). Con roles separados, saltarse el aislamiento obliga a pedir deliberadamente la otra conexión: es visible en el código y en una revisión | Una conexión única con el privilegio decidido por variable de sesión convertiría esa variable en la frontera de seguridad de todo el producto. Un error al fijarla sería indistinguible de una operación legítima y produciría acceso total sin ningún síntoma |
| Toda consulta obligada a correr dentro de una transacción explícita | `SET LOCAL` sólo persiste dentro de una transacción. Fuera de ella la política evalúa sin ámbito, de modo que el diseño falla abriendo si esta regla se relaja | Permitir consultas sueltas para lecturas simples reintroduciría exactamente la clase de fallo silencioso que RLS viene a eliminar, y de forma intermitente bajo agrupación de conexiones en modo transacción |
