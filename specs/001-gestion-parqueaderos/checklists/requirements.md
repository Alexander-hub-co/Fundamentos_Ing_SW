# Specification Quality Checklist: Parquivo

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-15
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

**Estado: todos los ítems aprobados.** La especificación pasó la validación completa en la
primera iteración tras resolver las clarificaciones.

Los 3 marcadores `[NEEDS CLARIFICATION]` que la primera redacción produjo fueron resueltos con
el usuario el 2026-08-15 y quedaron documentados en la sección `Clarifications` de la spec:

1. **Alta de parqueaderos** → sólo manual, sin registro público (FR-015).
2. **Multi-sede por persona** → una cuenta, un establecimiento (FR-020).
3. **Suspensión con turno en curso** → modo restringido (FR-027, FR-028).

**Verificación de "no implementation details"**: la especificación no nombra lenguaje,
framework, base de datos, ni estrategia de aislamiento. La decisión entre esquema por tenant y
columna de tenencia se difiere deliberadamente a `/speckit-plan`.

**Alineación con la constitución**: FR-009 a FR-013 implementan el Principio I (aislamiento);
FR-040 a FR-042 implementan el Principio IV (integridad del historial); la sección de
suposiciones acota el alcance según el Principio V.

**Advertencia para `/speckit-plan`**: FR-027 y FR-028 describen el comportamiento del modo
restringido sobre movimientos que no existen hasta F3. El plan debe dejar el punto de control
implementado y probado en F1 aunque su efecto completo sólo sea observable más adelante.

---

## Re-validación tras `/speckit-clarify` (2026-08-15)

**Resultado: 16/16 → 16/16 ítems aprobados.** Ningún ítem cambió de estado, pero la
re-validación detectó y corrigió un defecto real antes de que se consolidara:

- Los requisitos incorporados en la sesión de clarificación —anonimización (FR-043 a FR-046) y
  demora progresiva ante intentos fallidos (FR-006 a FR-008)— habían quedado sin ningún escenario
  de aceptación que los cubriera. El ítem "All functional requirements have clear acceptance
  criteria" habría fallado. Se corrigió ampliando la historia 4 con cuatro escenarios nuevos y
  redefiniendo su alcance a "acceso y ciclo de vida de las cuentas".
- SC-007 contenía un adjetivo sin cuantificar ("lo que un usuario percibe como inmediato"). Se
  convirtió en una métrica verificable: listado y panel completos en menos de 2 segundos con
  1.000 establecimientos.

La especificación pasó de 31 a 44 requisitos funcionales y de 8 a 10 criterios de éxito.

---

## Re-validación tras `/speckit-checklist` (2026-08-15)

**Resultado: 16/16 → 16/16 ítems aprobados.** Redactar los tres checklists de calidad expuso
siete huecos en la propia especificación, todos corregidos en esta ronda:

1. Los parámetros de la demora progresiva vivían sólo en `data-model.md`. Ahora están en FR-006,
   y SC-010 pasó de "un puñado de intentos" a 2 por minuto.
2. La obligación de que todo acceso a datos ocurra dentro de una transacción existía únicamente
   como decisión técnica. Es la condición de validez del Principio I y ahora es FR-012.
3. El estado `pendiente` no tenía comportamiento definido. FR-024 lo fija y justifica su
   existencia.
4. Los cambios de estado no exigían registrar autor ni motivo, aunque el contrato ya lo
   contemplaba. Ahora es FR-026.
5. El panel ignoraba dos de los cuatro estados. FR-049 exige un contador por estado, con la suma
   cuadrando contra el total.
6. `intento_login` y `acceso_denegado` conservaban datos personales sin límite. FR-047 fija una
   retención de 12 meses.
7. No estaba declarado quién responde por los datos personales. FR-048 lo define para F1 y acota
   la decisión pendiente para los datos de clientes finales, que aparecen en F3.

También se corrigieron dos citas obsoletas en la sección `Clarifications`, que tras las
renumeraciones apuntaban a requisitos equivocados. Las referencias históricas dejaron de llevar
número: describen redacciones pasadas, y un número vivo dentro de esa prosa vuelve a romperse en
la siguiente renumeración.

Los requisitos nuevos recibieron sus escenarios de aceptación en el mismo paso —historias 3 y 5—
para no repetir el defecto detectado en la ronda anterior.

La especificación pasó de 44 a 50 requisitos funcionales.

**Verificación de "no implementation details"**: la especificación no nombra lenguaje,
framework, base de datos, ni estrategia de aislamiento. La decisión entre esquema por tenant y
columna de tenencia se difiere deliberadamente a `/speckit-plan`.

**Alineación con la constitución**: FR-006 a FR-009 implementan el Principio I; FR-029 y FR-030
implementan el Principio IV; la sección de suposiciones acota el alcance según el Principio V.
