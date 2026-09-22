# Contrato de operaciones — F2

Las operaciones del dominio, con quién puede ejecutarlas y qué garantizan. Sigue la convención de
F1: cada una exige autorización por su cuenta y ninguna confía en que la interfaz la haya filtrado.

Recordatorio de la regla de roles: **todo administrador puede además lo que puede un operario**. Las
listas de abajo son acumulativas, nunca excluyentes.

---

## Tarifas

### `declararTarifa(contexto, datos)`

Crea la versión vigente de una tarifa. Si ya había una, la cierra en el mismo instante en que abre
la nueva, dentro de la misma transacción: no puede existir un momento sin tarifa vigente ni uno con
dos.

- **Puede**: administrador del establecimiento; administrador general sobre cualquiera.
- **Rechaza**: valores negativos, mínima mayor que plena, intervalo ≤ 0, parámetros que no
  corresponden al modelo declarado, y el establecimiento suspendido.
- **Garantiza**: la versión anterior conserva su `vigente_hasta`; ninguna se borra.

### `tarifaVigenteEn(contexto, tipoVehiculoId, momento)`

Devuelve la tarifa que regía en ese instante, no necesariamente la actual.

### `tiposSinTarifa(contexto)`

Qué tipos de vehículo no tienen tarifa vigente. Es lo que la pantalla usa para decir qué falta antes
de operar.

---

## Cálculo

### `calcularImporte(entrada, salida, tarifa, horario)` — **función pura**

No toca la base y no recibe contexto. Devuelve importe **y desglose**: minutos cobrables, tramos por
jornada, qué tope se aplicó y por qué.

- Con `salida = ahora` produce el **total parcial** de un vehículo que sigue adentro.
- Es determinista: los mismos argumentos dan siempre el mismo resultado, sin leer el reloj.

### `partirEnJornadas(entrada, salida, horario, cobraHorasCerradas)` — **función pura**

Reparte la permanencia en tramos cobrables. Es donde viven los tres casos —24 horas, con horario sin
cobrar cerrado, con horario cobrándolo— y los cruces de medianoche.

---

## Horario y capacidad

### `declararHorario(contexto, datos)`

Fija si abre 24 horas, si cobra las horas cerradas, y las franjas por día.

- **Advierte** (no impide) si quedan horas de atención sin ningún turno activo que las cubra.
- **Advierte** que el horario afecta al cobro: la jornada tarifaria se apoya en él.

### `estaAbierto(horario, momento)` — **función pura**

### `declararCapacidad(contexto, tipoVehiculoId, cupos)`

---

## Turnos

### `crearTurno(contexto, datos)` / `editarTurno` / `activarTurno` / `desactivarTurno`

- **Puede**: administrador del establecimiento; administrador general sobre cualquiera.
- **Rechaza**: hora de inicio igual a la de fin, y el establecimiento suspendido.
- **Garantiza**: desactivar no borra. Los movimientos que F3 registre bajo ese turno seguirán siendo
  explicables.

### `asignarATurno(contexto, turnoId, usuarioId)` / `retirarDeTurno`

- **Rechaza**: una persona que no pertenece al establecimiento.
- **Acepta**: administradores además de operarios. En muchos parqueaderos el administrador atiende
  la taquilla.

### `horasSinCubrir(horario, turnos)` — **función pura**

Compara el horario de atención con los turnos activos y devuelve los huecos. Alimenta un **aviso**,
no un impedimento: se puede guardar una configuración a medias.

### `turnoVigenteEn(contexto, momento)` — quién debería estar atendiendo

Responde sin que nadie haya abierto el turno: es configuración, no sesión.

---

## Operarios

### `crearCuentaDeEstablecimiento(contexto, datos)`

El administrador del establecimiento da de alta operarios y administradores **de su propio local**.

- **Rechaza**: rol de administrador general, y cualquier `parqueaderoId` distinto del propio.
- **Garantiza**: la cuenta nace con contraseña temporal obligada a cambiarse y con su código legible
  correlativo bajo la sigla del establecimiento.

### `gestionarCuentaDeEstablecimiento(contexto, accion, usuarioId)`

Bloquear, desbloquear, restablecer contraseña y dar de baja, acotado al propio establecimiento.

---

## Convenios

### `registrarConvenio(contexto, datos)` / `agregarPlaca` / `quitarPlaca` / `vencerConvenio`

### `descuentoParaPlaca(contexto, placa, momento)`

Informa qué descuento corresponde, **sin aplicarlo a ningún cobro**. Determinista cuando una placa
podría estar alcanzada por más de un convenio.

---

## Reglas transversales

**Ámbito.** Toda operación resuelve el establecimiento desde la sesión. Ninguna acepta un
`parqueaderoId` del cliente, salvo las del administrador general, que lo declaran explícitamente y
quedan auditadas.

**Suspensión.** Con el establecimiento suspendido, toda operación de escritura de esta lista se
rechaza y toda operación de lectura se permite.

**Modificación por la plataforma.** Cuando el administrador general modifica configuración ajena, el
asiento debe distinguirse de un cambio hecho por el propio establecimiento. Sin esa distinción, su
administrador vería aparecer cambios sin saber quién los hizo.

**Error de ámbito.** Un recurso de otro establecimiento responde igual que uno inexistente y deja
asiento en `acceso_denegado`, por el camino único que F1 dejó en `errorDeAlcance()`.
