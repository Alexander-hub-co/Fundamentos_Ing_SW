# Specification Quality Checklist: Taquilla de vehículos

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-08-19
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

Revalidada tras `/speckit-clarify`: 47 requisitos funcionales, 14 criterios de éxito, 3
historias priorizadas, 4 clarificaciones registradas. Los 16 puntos siguen pasando.

**La clarificación cambió el alcance, y para más.** La especificación asumía que el ticket
impreso podía quedar fuera; el propietario del producto respondió que sin comprobante
físico no hay operación. Eso mete la impresión térmica dentro de la funcionalidad y la
convierte en su riesgo técnico principal, que hay que resolver con una decisión documentada
al planificar. Diecisiete requisitos nuevos salieron de esa respuesta y de las tres que la
siguieron.

**Por qué la historia 1 es tan grande.** Se consideró partirla en "registrar entradas" y
"cobrar salidas", que daría dos incrementos más pequeños. Se descartó: un parqueadero que
registra quién entra pero no puede cobrar no es un producto entregable, sólo media
funcionalidad. La historia 1 es el átomo, y las otras dos —turnos y ocupación— sí son
independientes de verdad.

**Cuatro ambigüedades se resolvieron con un supuesto en vez de una pregunta**, porque en
las cuatro había un valor por defecto defendible: el cobro ocurre al salir; el pago es en
efectivo y fuera del sistema; superar la capacidad avisa sin impedir, igual que ya hace el
aviso de horas sin cubrir de los turnos; y un vehículo que lleva días adentro se cobra con
lo que diga la tarifa, que ya sabe distinguir si la plena topa por jornada o por estadía.

**Las cuatro clarificaciones y lo que cambiaron:**

1. **El ticket es obligatorio.** Sin comprobante físico no hay operación. La impresión
   entra en el alcance; el mecanismo se decide y se documenta al planificar, como manda la
   constitución.
2. **Una impresora rota no para el parqueadero.** La entrada se registra igual, se avisa, y
   el movimiento queda pendiente de comprobante con una lista donde encontrarlo. Negar la
   entrada no haría desaparecer el vehículo: sólo lo dejaría sin registro, que es peor.
3. **La cortesía existe y exige motivo.** Sin esa salida quien atiende improvisa —una
   salida falsa, un movimiento abierto para siempre— y las dos ensucian el historial. Queda
   distinguible de un cobro de cero, y guarda cuánto se dejó de cobrar.
4. **Corregir es del administrador.** Un operario no ajusta su propia caja, ni siquiera con
   el cliente delante. La corrección conserva los dos importes: reemplazar uno por otro
   destruiría la única prueba de que hubo un error.

**Una decisión tomada sin preguntar**, por ser preferencia ya establecida del proyecto: el
identificador del comprobante es legible y lleva la sigla del establecimiento, como los
códigos de parqueaderos y cuentas. Alguien va a tener que leerlo por teléfono o escribirlo
a mano cuando el papel se borre.

**Lo que queda para el plan**: el mecanismo de impresión. Es la única pieza con riesgo
técnico real y la constitución exige resolverla con un documento antes de implementarla.
