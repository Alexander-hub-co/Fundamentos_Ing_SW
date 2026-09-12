# Guía de uso

**Parquivo** · Sistema de gestión para parqueaderos

El sistema tiene tres roles y cada uno ve una cosa distinta al entrar. Empiece
por la guía del rol que le corresponde.

| Guía | Para quién | Qué cubre |
|---|---|---|
| [Guía del operario](guia-del-operario.md) | Quien atiende la taquilla | Entrada, salida, cobro, bicicletas y turnos |
| [Guía del administrador](guia-del-administrador.md) | Quien gestiona un establecimiento | Tarifas, horarios, convenios, operarios y turnos |

Un administrador puede hacer **además** todo lo que hace un operario: hay
parqueaderos donde el dueño atiende la caseta, y obligarlo a tener dos cuentas
para cobrar un carro no tendría sentido.

---

## Lo que hay que saber antes de empezar

**Cada establecimiento está aislado.** Usted ve los datos de su parqueadero y de
ninguno más. No es una cortesía de la interfaz: la base de datos no devuelve
filas ajenas aunque se le pidan.

**Un movimiento cerrado no se puede editar ni borrar.** Si hay que corregir algo,
se registra una corrección nueva que apunta al movimiento original. El historial
crece, nunca se reescribe. Así se puede responder un reclamo tres meses después.

**Todo cobro se puede explicar.** Cada movimiento cerrado guarda una copia de la
tarifa y de los convenios que se le aplicaron en ese instante. Cambiar una
tarifa mañana no altera lo que se cobró ayer.
