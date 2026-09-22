# Specification Quality Checklist: Convenios y descuentos configurables

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-18
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

Revalidada tras la sesión de clarificación del 2026-08-19 (39 requisitos funcionales, 13
criterios de éxito, **2** historias priorizadas, 6 clarificaciones registradas). Los 16
puntos siguen pasando; no hubo regresiones.

**La historia 3 ya no existe.** El asistente de IA no se aplazó: se descartó. La variedad
que iba a interpretar resultó estar acotada, y se cubre con dos activaciones, cuatro
beneficios y una lista de vigencias con nombre. La especificación quedó más corta y sin
ninguna dependencia externa.

**Sin marcadores de clarificación.** Las cuatro ambigüedades que aparecieron se
resolvieron con un supuesto documentado en vez de una pregunta, porque en los cuatro
casos existía un valor por defecto defendible: varios sellos en una salida se suman; la
vigencia se evalúa al salir; los beneficios de importe fijo determinan el total ignorando
los de tiempo; y el asistente es opcional por diseño.

**Los dos puntos que quedaron abiertos al cerrar la especificación están resueltos.** El
redondeo es configuración del establecimiento con tres opciones cerradas —peso,
cincuentena, centena— y con la garantía de que nunca sube el total. El límite diario entró
al alcance haciendo que el cálculo reciba la cuenta de aplicaciones previas como dato en
vez de averiguarla, de modo que la regla se declara, se prueba y se demuestra hoy sin
esperar al historial de movimientos.

**Las cuatro clarificaciones y lo que cambiaron:**

1. **Acumulación de descuentos.** Los porcentajes se suman, no se encadenan, porque es lo
   que un operario puede explicarle a un cliente en la caja sin hacer cuentas. Sumar
   obligó a fijar el freno del 100 % (FR-008c), sin el cual tres convenios del 40 %
   habrían producido un total negativo.
2. **La activación "siempre" se retiró.** Cabía en el modelo y ningún acuerdo real la
   pedía, que es exactamente el caso que el Principio V prohíbe construir. El vocabulario
   queda en dos activaciones y cuatro beneficios.
3. **Soporte de plataforma.** El administrador general puede declarar y modificar
   convenios ajenos por la misma puerta acotada y auditada que ya se usa para las tarifas,
   y sus cambios quedan distinguibles de los del propio establecimiento (FR-016a,
   FR-016b).
4. **Redondeo.** Las tres opciones son el conjunto definitivo de esta entrega.

**Alcance entregable sin la taquilla.** La funcionalidad declara, calcula y comprueba;
no aplica convenios a movimientos reales porque los movimientos llegan después. Las
historias 1 y 2 son demostrables por sí solas, y FR-018, FR-019 y FR-013b fijan por
escrito el contrato que la taquilla tendrá que consumir.
