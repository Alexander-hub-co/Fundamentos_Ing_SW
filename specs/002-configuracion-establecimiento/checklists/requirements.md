# Specification Quality Checklist: Configuración del establecimiento

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-16
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

Los tres marcadores se resolvieron en la sesión de clarificación del 2026-08-16 y la especificación
ya no tiene ninguno. Las cuatro decisiones quedaron registradas en `## Clarifications` y aplicadas
a los requisitos:

1. **Modelo de cobro**: la decisión inicial de tres modos genéricos quedó **reemplazada**. El
   propietario describió cómo se cobra realmente en Colombia y el modelo pasó a ser dos: por minuto
   con tarifa mínima y plena para vehículos motorizados, y por intervalos con plena por jornada
   tarifaria para bicicletas. Dos decisiones que su documento no cubría se resolvieron a favor de la
   configurabilidad: el alcance de la plena —estadía o jornada— se declara en cada tarifa, y si se
   cobran las horas cerradas lo decide cada establecimiento.
2. **Administradores**: el administrador de un local puede nombrar a otro de su mismo local, con la
   restricción explícita de que eso amplía el rol, nunca el ámbito.
3. **Soporte**: el administrador general puede consultar y modificar configuración ajena, y esa
   modificación debe distinguirse de una hecha por el propio establecimiento; si no, el
   administrador del local vería aparecer cambios sin saber quién los hizo.
4. **Turnos**: la decisión se revisó. El propietario detalló el sistema de turnos y quedó claro que
   su CONFIGURACIÓN es exactamente lo que F2 hace. El reparto final: configuración en F2, sesiones
   de turno y registro en cada movimiento en F3, reportes por turno en F5.
5. **Horario frente a turnos**: son declaraciones independientes. El horario dice cuándo abre el
   local; el turno, quién lo cubre. Si quedan horas de atención sin turno, el sistema avisa pero no
   lo impide, para poder guardar una configuración a medias.

Queda una decisión anotada en Assumptions y deliberadamente no tomada: si las tarifas llevan un
periodo de gracia inicial gratuito. Conviene resolverla antes de `/speckit-plan`, porque después
toca el motor de cobro de F3.

Al especificar los turnos apareció un solapamiento que no se había visto: F2 pasó a tener dos
formas de decir cuándo funciona el parqueadero. Se resolvió declarándolas independientes, con la
consecuencia explícita de que un turno puede extenderse fuera del horario sin que eso sea un error
—alguien entra media hora antes a abrir y contar la caja—.

Al reescribir las tarifas apareció una consecuencia que conviene tener presente al planificar: el
**horario de atención dejó de ser un dato informativo**. La jornada tarifaria se apoya en él, así
que un horario mal declarado ya no produce un cartel equivocado sino un cobro equivocado. Eso sube
la importancia de la historia 2, que sigue siendo P1.

También quedó anotado que la detección del tipo de vehículo por la placa pertenece a F3, y que es
una heurística sobre los formatos vigentes que necesitará una salida manual.

La especificación creció de 41 a 68 requisitos y de 4 a 5 historias con la incorporación de los
turnos y del motor de tarifas. Todos los ítems pasan; está lista para `/speckit-plan`.
