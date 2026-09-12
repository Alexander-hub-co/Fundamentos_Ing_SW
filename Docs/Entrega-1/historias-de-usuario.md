# Historias de usuario

**Proyecto:** Parquivo — Sistema de gestión para parqueaderos
**Asignatura:** Fundamentos de Ingeniería de Software (12946) · 2026-2

---

## Cómo está organizado

Se sigue la jerarquía vista en clase. Cada nivel agrupa al siguiente:

| Nivel | Horizonte | Cuántos hay | Dónde está |
|---|---|---|---|
| **Theme** | Meses | 5 | Los cinco módulos del sistema |
| **Epic** | Semanas | 20 | Este documento |
| **User Story** | Días | 51 | Este documento |
| **Task** | Horas | Se desglosan al planear cada sprint | [`Docs/Planning/`](../Planning/) |

Los puntos de historia son la estimación inicial del equipo, revisable en cada
sesión de planeación. Cada historia cumple **INVEST**: es autocontenida, negociable, entrega valor al
usuario, se puede estimar, cabe en tres o cuatro días de trabajo y se puede
probar. Los criterios de aceptación son la tercera C —*Confirmation*— y están
escritos en Dado / Cuando / Entonces para que sirvan directamente como pruebas.

La columna **Requisitos** enlaza cada historia con los requisitos funcionales
del SRS (`Docs/SRS/SRS-simplificado.md`), de modo que la trazabilidad va en las
dos direcciones.

---

## Roles del sistema

| Rol | Quién es |
|---|---|
| **Administrador general** | Quien opera la plataforma y da de alta establecimientos |
| **Administrador de parqueadero** | El dueño o encargado de un establecimiento |
| **Operario** | Quien atiende la caseta de la taquilla |

---

## Prioridades

| Marca | Significado | Criterio |
|---|---|---|
| **P1** | Alta | Sin esto el parqueadero no puede operar |
| **P2** | Media | El parqueadero opera, pero no puede administrarse bien |
| **P3** | Baja | Mejora la operación; se puede posponer |

Se priorizó por **valor, coste y riesgo**, como se vio en clase.

---
---

# THEME M4 · Taquilla — vehículos

*La pantalla donde se pasa el día. Es la ruta crítica del producto.*

## Épica E4.1 · El ciclo completo de un vehículo — P1

### HU-4.1.1 · Registrar la entrada escribiendo sólo la placa

> **Como** operario de taquilla
> **quiero** registrar la entrada de un vehículo escribiendo únicamente su placa
> **para poder** atenderlo sin apartar la vista de la fila que espera.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-001, FR-002, FR-005 | E4.1 |

**Criterios de aceptación**

1. **Dado** un establecimiento con tarifas declaradas y ningún vehículo adentro,
   **cuando** el operario escribe una placa y confirma, **entonces** queda
   registrada la entrada sin pedirle ningún dato más.
2. **Dado** que el operario escribe la placa con espacios o en minúscula,
   **cuando** confirma, **entonces** el sistema la normaliza y la trata igual
   que si estuviera bien escrita.
3. **Dado** que se registró una entrada, **cuando** el operario mira la
   pantalla, **entonces** el campo queda vacío y con el cursor puesto, listo
   para el vehículo siguiente.

---

### HU-4.1.2 · Clasificar el vehículo por su placa

> **Como** operario de taquilla
> **quiero** que el sistema deduzca si es carro o moto a partir de la placa
> **para poder** no tener que elegir el tipo en cada vehículo.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-003, FR-004 | E4.1 |

**Criterios de aceptación**

1. **Dado** una placa terminada en dígito, **cuando** se registra la entrada,
   **entonces** queda clasificada como automóvil.
2. **Dado** una placa terminada en letra, **cuando** se registra la entrada,
   **entonces** queda clasificada como motocicleta.
3. **Dado** una placa que no corresponde a ningún formato conocido, **cuando**
   el operario la escribe, **entonces** el sistema la rechaza con un error
   explícito y **no** adivina el tipo.

---

### HU-4.1.3 · Resolver la salida con la misma placa

> **Como** operario de taquilla
> **quiero** que al escribir la placa de un vehículo que ya está adentro el
> sistema me ofrezca cobrarlo
> **para poder** usar un solo campo para entrar y para salir.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-001, FR-006, FR-008 | E4.1 |

**Criterios de aceptación**

1. **Dado** un vehículo adentro, **cuando** el operario escribe su placa,
   **entonces** el sistema no ofrece otra entrada: muestra el tiempo
   transcurrido y el importe a cobrar.
2. **Dado** dos intentos simultáneos de registrar la misma placa, **cuando**
   ambos se procesan, **entonces** queda un único movimiento abierto.
3. **Dado** una salida en curso, **cuando** el operario la confirma,
   **entonces** el movimiento queda cerrado con el importe, los dos operarios
   y las dos marcas de tiempo.

---

### HU-4.1.4 · Ver el desglose de lo que se cobra

> **Como** operario de taquilla
> **quiero** ver de qué se compone el total, y no sólo la cifra
> **para poder** explicárselo al cliente sin hacer cuentas delante de él.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-012 | E4.1 |

**Criterios de aceptación**

1. **Dado** una salida resuelta, **cuando** el operario mira la pantalla,
   **entonces** ve el importe base, cada convenio aplicado con su descuento,
   cada convenio no aplicado con su motivo, y el redondeo.
2. **Dado** el desglose mostrado, **cuando** se suman sus partes, **entonces**
   el resultado coincide exactamente con el total presentado.

---

### HU-4.1.5 · Avisar antes de dejar entrar un vehículo sin tarifa

> **Como** operario de taquilla
> **quiero** que el sistema me avise si el tipo de vehículo no tiene tarifa
> **para poder** no dejar entrar uno que después no voy a poder cobrar.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-007, FR-013 | E4.1 |

**Criterios de aceptación**

1. **Dado** un tipo de vehículo sin tarifa vigente, **cuando** el operario
   intenta registrar su entrada, **entonces** el sistema lo advierte antes de
   confirmar.
2. **Dado** una entrada por confirmar, **cuando** el operario la revisa,
   **entonces** ve qué tarifa se le va a aplicar al salir.

---

### HU-4.1.6 · Dejar salir un vehículo sin cobrarle

> **Como** operario de taquilla
> **quiero** poder cerrar una salida sin cobro dejando escrito el motivo
> **para poder** resolver un caso legítimo sin llamar al administrador.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-012 (cortesía) | E4.1 |

**Criterios de aceptación**

1. **Dado** un vehículo adentro, **cuando** el operario cierra su salida como
   cortesía, **entonces** el sistema le exige un motivo escrito.
2. **Dado** una cortesía otorgada, **cuando** se consulta el movimiento,
   **entonces** consta quién la autorizó y cuánto se habría cobrado.
3. **Dado** una cortesía y un cobro en cero pesos, **cuando** se comparan,
   **entonces** son distinguibles entre sí.

---

### HU-4.1.7 · Reimprimir un comprobante

> **Como** operario de taquilla
> **quiero** volver a imprimir el comprobante de un movimiento
> **para poder** entregarlo cuando el papel no salió la primera vez.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P3 | 3 | FR-009, FR-010, FR-011 | E4.1 |

**Criterios de aceptación**

1. **Dado** una entrada registrada, **cuando** el operario pide reimprimir,
   **entonces** sale el mismo comprobante sin crear un movimiento nuevo.
2. **Dado** la impresora fuera de servicio, **cuando** se registra un
   movimiento, **entonces** queda en la lista de comprobantes pendientes y la
   operación continúa.

---

## Épica E4.2 · Saber quién atendió y en qué turno — P2

### HU-4.2.1 · Abrir y cerrar el turno desde la taquilla

> **Como** operario de taquilla
> **quiero** abrir mi turno al llegar y cerrarlo al irme
> **para poder** dejar constancia de qué movimientos fueron míos.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-020, FR-021 | E4.2 |

**Criterios de aceptación**

1. **Dado** un turno declarado para hoy, **cuando** el operario lo abre,
   **entonces** el sistema guarda la hora **real** además de la programada.
2. **Dado** un turno abierto, **cuando** el operario lo cierra, **entonces**
   queda registrada la hora real de cierre.
3. **Dado** un turno abierto con vehículos adentro, **cuando** el operario
   intenta cerrarlo, **entonces** el sistema se lo permite.

---

### HU-4.2.2 · Atribuir cada movimiento a su turno y a su operario

> **Como** administrador de parqueadero
> **quiero** saber quién recibió cada vehículo y quién lo cobró
> **para poder** cuadrar la caja y preguntar por un cobro raro.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-016, FR-022, FR-023 | E4.2 |

**Criterios de aceptación**

1. **Dado** un movimiento cerrado, **cuando** se consulta, **entonces** constan
   el operario de entrada, el de salida y la sesión de turno de cada extremo.
2. **Dado** que no hay ningún turno abierto, **cuando** el operario registra un
   movimiento, **entonces** el sistema lo permite y lo deja sin turno asociado.

---

## Épica E4.3 · Ver cuántos hay adentro — P3

### HU-4.3.1 · Consultar la ocupación del parqueadero

> **Como** operario de taquilla
> **quiero** ver cuántos vehículos hay adentro y de qué tipo
> **para poder** responder si queda cupo sin contar a ojo.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P3 | 3 | FR-028, FR-029, FR-030 | E4.3 |

**Criterios de aceptación**

1. **Dado** varios vehículos adentro, **cuando** se consulta la ocupación,
   **entonces** el conteo coincide con los movimientos abiertos, por tipo.
2. **Dado** una capacidad declarada superada, **cuando** el operario mira la
   pantalla, **entonces** el sistema lo advierte **sin impedir** la entrada.

---
---

# THEME M5 · Taquilla — bicicletas y fichas

> **Qué es una ficha.** Una ficha es el tique impreso del movimiento, donde en
> lugar de la placa dice «Ficha 3». Cuántas hay es la capacidad de bicicletas que
> el establecimiento declaró, y un número está libre cuando ningún movimiento
> abierto lo sostiene. No es un tarjetón físico con inventario propio, así que no
> existe ni darla de baja ni cobrar su reposición.

## Épica E5.1 · Recibir una bicicleta y entregar su ficha — P1

### HU-5.1.1 · Recibir una bicicleta con los datos de quien la deja

> **Como** operario de taquilla
> **quiero** registrar una bicicleta anotando nombre, celular y cédula
> **para poder** saber a quién devolvérsela, ya que no tiene placa.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-006, FR-010, FR-026, FR-027 | E5.1 |

**Criterios de aceptación**

1. **Dado** que hay espacio para bicicletas, **cuando** el operario registra
   una con los tres datos, **entonces** el sistema le asigna un número de ficha
   sin que él tenga que elegirlo.
2. **Dado** la pantalla de recepción, **cuando** el operario la mira,
   **entonces** ve para qué se piden esos datos personales.
3. **Dado** una cédula ya registrada antes, **cuando** el operario la escribe,
   **entonces** el sistema propone el teléfono que esa cédula dio la vez
   anterior.

---

### HU-5.1.2 · Garantizar que una ficha no se entregue dos veces

> **Como** administrador de parqueadero
> **quiero** que dos operarios no puedan asignar el mismo número de ficha
> **para poder** confiar en que cada ficha identifica a una sola bicicleta.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-007 | E5.1 |

**Criterios de aceptación**

1. **Dado** dos recepciones simultáneas, **cuando** ambas se procesan,
   **entonces** reciben números de ficha distintos.
2. **Dado** una ficha entregada, **cuando** el sistema busca una libre,
   **entonces** no vuelve a proponer ésa.

---

### HU-5.1.3 · Emitir el comprobante con el número de ficha

> **Como** operario de taquilla
> **quiero** entregar un tique donde el número de ficha se lea de lejos
> **para poder** que el cliente lo identifique sin confundirse.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-011 | E5.1 |

**Criterios de aceptación**

1. **Dado** una bicicleta recibida, **cuando** se imprime el comprobante,
   **entonces** el número de ficha aparece destacado.
2. **Dado** la impresora fuera de servicio, **cuando** se recibe una bicicleta,
   **entonces** el movimiento queda registrado igual y el comprobante en
   pendientes.

---

## Épica E5.2 · Devolver la bicicleta y cobrar — P1

### HU-5.2.1 · Devolver escribiendo el número de ficha

> **Como** operario de taquilla
> **quiero** resolver la devolución escribiendo el número de ficha en el mismo
> campo donde escribo las placas
> **para poder** atender bicicletas y carros sin cambiar de pantalla.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-012, FR-013, FR-023, FR-024 | E5.2 |

**Criterios de aceptación**

1. **Dado** una ficha entregada, **cuando** el operario escribe su número,
   **entonces** el sistema muestra el total a cobrar, igual que con un carro.
2. **Dado** un número que podría ser ficha o placa, **cuando** el operario lo
   escribe, **entonces** el sistema distingue sin ambigüedad de cuál se trata.
3. **Dado** una ficha que no está entregada, **cuando** el operario la escribe,
   **entonces** el sistema lo rechaza sin registrar nada.

---

### HU-5.2.2 · Cobrar la bicicleta con su propia tarifa

> **Como** administrador de parqueadero
> **quiero** que las bicicletas se cobren con la tarifa de bicicleta vigente
> **para poder** aplicarles un precio distinto al de los carros.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-013 | E5.2 |

**Criterios de aceptación**

1. **Dado** una tarifa de bicicleta declarada, **cuando** se devuelve una,
   **entonces** el importe lo calcula el mismo motor que cobra los vehículos.
2. **Dado** un convenio que no aplica a bicicletas, **cuando** se cobra una,
   **entonces** no se le descuenta nada, salvo que el administrador haya
   habilitado lo contrario.

---

### HU-5.2.3 · Liberar el espacio al devolver

> **Como** operario de taquilla
> **quiero** que el espacio quede libre al cerrar el movimiento
> **para poder** recibir la siguiente bicicleta.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-014 | E5.2 |

**Criterios de aceptación**

1. **Dado** una bicicleta devuelta, **cuando** se cierra el movimiento,
   **entonces** el número de ficha vuelve a estar disponible.
2. **Dado** una devolución sin cobro, **cuando** el operario la cierra,
   **entonces** el sistema le exige un motivo, igual que con los vehículos.

---

## Épica E5.4 · El cliente perdió el tique — P2

### HU-5.4.1 · Encontrar la bicicleta por la cédula

> **Como** operario de taquilla
> **quiero** buscar el movimiento abierto por la cédula de quien dejó la
> bicicleta
> **para poder** devolvérsela aunque haya perdido el tique.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-017, FR-023 | E5.4 |

**Criterios de aceptación**

1. **Dado** una bicicleta adentro, **cuando** el operario busca por la cédula
   de quien la dejó, **entonces** encuentra el movimiento abierto.
2. **Dado** una cédula sin ninguna bicicleta adentro, **cuando** se busca,
   **entonces** el sistema lo dice sin exponer datos de otras personas.

---

## Épica E5.5 · Se acabaron las fichas — P3

### HU-5.5.1 · Rechazar la recepción cuando no queda espacio

> **Como** operario de taquilla
> **quiero** que el sistema me avise cuando no quedan fichas disponibles
> **para poder** decírselo al cliente en vez de aceptar una bicicleta que no
> puedo identificar.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P3 | 3 | FR-008, FR-009 | E5.5 |

**Criterios de aceptación**

1. **Dado** que todas las fichas están entregadas, **cuando** el operario
   intenta recibir otra bicicleta, **entonces** el sistema lo rechaza y dice
   por qué.
2. **Dado** la pantalla de taquilla, **cuando** el operario la mira,
   **entonces** ve cuántas fichas quedan disponibles.

---
---

# THEME M3 · Convenios y descuentos

## Épica E3.1 · Declarar los convenios que el establecimiento tiene — P1

### HU-3.1.1 · Declarar un convenio con su beneficio

> **Como** administrador de parqueadero
> **quiero** declarar un convenio eligiendo qué hace y cuándo se activa
> **para poder** reproducir el acuerdo que tengo con un comercio vecino.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-001 a FR-005 | E3.1 |

**Criterios de aceptación**

1. **Dado** el formulario de alta, **cuando** el administrador elige un
   beneficio, **entonces** el sistema le exige únicamente los datos que ese
   beneficio necesita.
2. **Dado** un beneficio de minutos gratis, **cuando** se declara sin indicar
   cuántos, **entonces** el sistema lo rechaza.
3. **Dado** un convenio declarado, **cuando** se consulta, **entonces** consta
   desde cuándo rige y hasta cuándo.

---

### HU-3.1.2 · Asociar placas a un convenio

> **Como** administrador de parqueadero
> **quiero** registrar qué placas cubre cada convenio
> **para poder** que el descuento se aplique solo en la taquilla.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-017, FR-019 | E3.1 |

**Criterios de aceptación**

1. **Dado** un convenio de activación por placa, **cuando** se le agrega una,
   **entonces** queda cubierta desde ese momento.
2. **Dado** una placa ya cubierta por otro convenio del mismo establecimiento,
   **cuando** se intenta agregar a un segundo, **entonces** el sistema lo
   rechaza.

---

### HU-3.1.3 · Vencer un convenio sin alterar lo ya cobrado

> **Como** administrador de parqueadero
> **quiero** poder vencer un convenio conservándolo
> **para poder** explicar los cobros que ya pasaron por él.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-005 | E3.1 |

**Criterios de aceptación**

1. **Dado** un convenio vigente con cobros hechos, **cuando** se vence,
   **entonces** deja de descontar pero sigue consultable.
2. **Dado** un cobro anterior al vencimiento, **cuando** se consulta,
   **entonces** muestra el mismo importe y el mismo desglose que tenía.

---

### HU-3.1.4 · Garantizar que el total nunca sea negativo

> **Como** administrador de parqueadero
> **quiero** que la combinación de varios convenios nunca produzca un valor
> negativo
> **para poder** confiar en que el sistema no va a pagarle al cliente.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-008, FR-009, FR-010 | E3.1 |

**Criterios de aceptación**

1. **Dado** varios convenios aplicables, **cuando** se calcula el cobro,
   **entonces** se aplican en un orden único y declarado.
2. **Dado** cualquier combinación de descuentos, **cuando** se obtiene el
   total, **entonces** nunca es negativo ni contiene fracciones de peso.
3. **Dado** el mismo caso calculado dos veces, **cuando** se comparan los
   resultados, **entonces** son idénticos.

---

## Épica E3.2 · Comprobar el efecto antes de que llegue el cliente — P2

### HU-3.2.1 · Consultar si una placa tiene convenio

> **Como** administrador de parqueadero
> **quiero** consultar qué convenio cubre a una placa
> **para poder** responderle a un cliente que dice tener uno.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-019 | E3.2 |

**Criterios de aceptación**

1. **Dado** una placa con convenio vigente, **cuando** se consulta,
   **entonces** el sistema dice cuál y qué hace.
2. **Dado** una placa sin convenio, **cuando** se consulta, **entonces** el
   sistema dice que se le cobra tarifa plena.

---

### HU-3.2.2 · Simular un cobro antes de prometerlo

> **Como** administrador de parqueadero
> **quiero** simular cuánto pagaría un vehículo con sus convenios aplicados
> **para poder** comprobar el efecto de un acuerdo antes de firmarlo.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-015 | E3.2 |

**Criterios de aceptación**

1. **Dado** un tipo de vehículo y una permanencia, **cuando** se simula el
   cobro, **entonces** el sistema entrega el total y su desglose.
2. **Dado** la misma simulación y un cobro real equivalente, **cuando** se
   comparan, **entonces** el importe coincide exactamente.

---
---

# THEME M1 · Plataforma y gestión de parqueaderos

## Épica E1.1 · Dar de alta un parqueadero y su administrador — P1

### HU-1.1.1 · Registrar un establecimiento nuevo

> **Como** administrador general
> **quiero** registrar un parqueadero con sus datos básicos
> **para poder** entregárselo listo a quien lo va a administrar.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-014, FR-016, FR-051 | E1.1 |

**Criterios de aceptación**

1. **Dado** el formulario de alta, **cuando** se registra un parqueadero,
   **entonces** el sistema le asigna un código legible derivado de su nombre.
2. **Dado** un establecimiento creado, **cuando** se intenta cambiar su código,
   **entonces** el sistema lo impide: es inmutable de por vida.
3. **Dado** el sistema en funcionamiento, **cuando** alguien sin cuenta lo
   consulta, **entonces** no existe ningún listado público de establecimientos.

---

### HU-1.1.2 · Asignar un administrador a un establecimiento

> **Como** administrador general
> **quiero** asignar y retirar administradores de un parqueadero
> **para poder** entregar y revocar el control de cada establecimiento.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-019, FR-020 | E1.1 |

**Criterios de aceptación**

1. **Dado** una cuenta existente, **cuando** se le asigna un parqueadero,
   **entonces** puede administrarlo.
2. **Dado** una cuenta ya asignada, **cuando** se intenta asignarla a un
   segundo establecimiento, **entonces** el sistema lo rechaza.

---

### HU-1.1.3 · Entrar al sistema con credenciales propias

> **Como** usuario del sistema
> **quiero** autenticarme con mi propia cuenta
> **para poder** que mis acciones queden atribuidas a mí.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-001, FR-032, FR-033 | E1.1 |

**Criterios de aceptación**

1. **Dado** una cuenta recién creada, **cuando** entra por primera vez,
   **entonces** el sistema le exige cambiar la contraseña temporal.
2. **Dado** credenciales incorrectas, **cuando** se intenta entrar,
   **entonces** el sistema no revela si el fallo fue el usuario o la clave.

---

## Épica E1.2 · Acceso aislado por establecimiento — P1

### HU-1.2.1 · Ver únicamente los datos del establecimiento propio

> **Como** administrador de parqueadero
> **quiero** que el sistema me muestre sólo lo de mi establecimiento
> **para poder** trabajar sin riesgo de ver ni tocar lo de otro.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-009, FR-010, FR-012 | E1.2 |

**Criterios de aceptación**

1. **Dado** dos establecimientos con datos, **cuando** una sesión de uno
   consulta cualquier entidad, **entonces** obtiene cero registros del otro.
2. **Dado** una consulta que olvidara filtrar por establecimiento, **cuando**
   se ejecuta, **entonces** la base de datos aplica el filtro igualmente.

---

### HU-1.2.2 · Responder igual a lo ajeno que a lo inexistente

> **Como** responsable del sistema
> **quiero** que pedir un recurso de otro establecimiento responda igual que
> pedir uno que no existe
> **para poder** impedir que se averigüe qué existe probando identificadores.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-011 | E1.2 |

**Criterios de aceptación**

1. **Dado** el identificador de un recurso ajeno, **cuando** se solicita,
   **entonces** la respuesta es idéntica a la de un identificador inventado.
2. **Dado** un intento de acceso fuera de ámbito, **cuando** ocurre,
   **entonces** queda registrado con la cuenta, el recurso y la fecha.

---

### HU-1.2.3 · Evaluar los permisos en el servidor

> **Como** responsable del sistema
> **quiero** que cada operación verifique el permiso en el servidor
> **para poder** impedir que esconder un botón se confunda con proteger algo.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-002, FR-003, FR-005 | E1.2 |

**Criterios de aceptación**

1. **Dado** una solicitud enviada sin pasar por la interfaz, **cuando** el rol
   no está autorizado, **entonces** el sistema la rechaza.
2. **Dado** un operario autenticado, **cuando** intenta abrir una pantalla de
   administración, **entonces** el sistema lo devuelve a la taquilla.

---

## Épica E1.3 · Suspender y reactivar un establecimiento — P2

### HU-1.3.1 · Suspender un establecimiento por falta de pago

> **Como** administrador general
> **quiero** suspender un establecimiento
> **para poder** cortar el servicio sin destruir su historial.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-023, FR-025, FR-026 | E1.3 |

**Criterios de aceptación**

1. **Dado** un establecimiento activo, **cuando** se suspende, **entonces**
   queda registrado quién lo hizo, cuándo y por qué.
2. **Dado** un establecimiento suspendido, **cuando** se reactiva,
   **entonces** sus usuarios recuperan el acceso pleno.

---

### HU-1.3.2 · Seguir sacando vehículos con el servicio suspendido

> **Como** operario de un establecimiento suspendido
> **quiero** poder cobrar y sacar los vehículos que ya están adentro
> **para poder** no dejar carros atrapados por una decisión comercial.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-027, FR-028, FR-030 | E1.3 |

**Criterios de aceptación**

1. **Dado** un establecimiento suspendido, **cuando** el operario intenta
   registrar una entrada nueva, **entonces** el sistema lo impide.
2. **Dado** el mismo establecimiento, **cuando** intenta cobrar una salida,
   **entonces** el sistema se lo permite.
3. **Dado** un usuario cuyo acceso quedó restringido, **cuando** entra,
   **entonces** el sistema le explica por qué.

---

## Épica E1.4 · Gestionar el ciclo de vida de las cuentas — P2

### HU-1.4.1 · Bloquear y desbloquear una cuenta

> **Como** administrador general
> **quiero** bloquear una cuenta y poder desbloquearla
> **para poder** cortar el acceso de alguien sin borrar lo que hizo.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-036, FR-038, FR-039 | E1.4 |

**Criterios de aceptación**

1. **Dado** una cuenta activa, **cuando** se bloquea, **entonces** el sistema
   exige confirmación explícita antes de hacerlo.
2. **Dado** una cuenta bloqueada, **cuando** intenta entrar, **entonces** el
   acceso se le niega, con independencia del estado del establecimiento.

---

### HU-1.4.2 · Restablecer la contraseña de una cuenta

> **Como** administrador general
> **quiero** asignar una contraseña temporal a una cuenta
> **para poder** devolverle el acceso a quien la perdió.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-034, FR-035 | E1.4 |

**Criterios de aceptación**

1. **Dado** una cuenta sin acceso, **cuando** se le restablece la contraseña,
   **entonces** al entrar se le exige cambiarla.
2. **Dado** el sistema en funcionamiento, **cuando** un usuario busca recuperar
   su clave solo, **entonces** no existe esa opción: la restablece un
   administrador.

---

### HU-1.4.3 · Anonimizar una cuenta conservando el historial

> **Como** administrador general
> **quiero** anonimizar los datos personales de una cuenta
> **para poder** atender una solicitud de supresión sin romper el historial.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P3 | 3 | FR-043, FR-044, FR-045, FR-046 | E1.4 |

**Criterios de aceptación**

1. **Dado** una cuenta anonimizada, **cuando** se consultan sus movimientos,
   **entonces** siguen existiendo, sin datos personales.
2. **Dado** una cuenta anonimizada, **cuando** intenta autenticarse,
   **entonces** no puede.

---

### HU-1.4.4 · Frenar los intentos de acceso por fuerza bruta

> **Como** responsable del sistema
> **quiero** que los intentos fallidos se demoren progresivamente
> **para poder** frenar un ataque sin dejar a nadie fuera para siempre.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-006, FR-007, FR-008 | E1.4 |

**Criterios de aceptación**

1. **Dado** varios intentos fallidos seguidos, **cuando** se intenta de nuevo,
   **entonces** la demora crece hasta un tope y nunca se vuelve permanente.
2. **Dado** un intento fallido, **cuando** ocurre, **entonces** queda
   registrado con la cuenta y la fecha.

---

## Épica E1.5 · Panel global de la plataforma — P3

### HU-1.5.1 · Ver el estado de todos los establecimientos

> **Como** administrador general
> **quiero** ver cuántos establecimientos hay en cada estado
> **para poder** saber cómo va la plataforma sin abrirlos uno por uno.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P3 | 3 | FR-021, FR-049, FR-050 | E1.5 |

**Criterios de aceptación**

1. **Dado** establecimientos en varios estados, **cuando** se abre el panel,
   **entonces** la suma de los cuatro estados coincide con el total.
2. **Dado** cuentas anonimizadas, **cuando** se cuenta el total de cuentas,
   **entonces** quedan excluidas.

---
---

# THEME M2 · Configuración del establecimiento

## Épica E2.1 · Definir cuánto cobra el parqueadero — P1

### HU-2.1.1 · Declarar una tarifa por tipo de vehículo

> **Como** administrador de parqueadero
> **quiero** declarar cuánto cobro por cada tipo de vehículo
> **para poder** empezar a operar con mis propios precios.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-001, FR-002, FR-003, FR-006 | E2.1 |

**Criterios de aceptación**

1. **Dado** un establecimiento recién creado, **cuando** se consultan sus
   tarifas, **entonces** no hay ninguna: el sistema no trae valores de fábrica.
2. **Dado** el modelo por intervalos, **cuando** se declara, **entonces** el
   sistema exige duración del intervalo, valor y tarifa plena.
3. **Dado** dos tipos de vehículo, **cuando** se declaran sus tarifas,
   **entonces** cada uno puede tener valores distintos.

---

### HU-2.1.2 · Rechazar tarifas incoherentes

> **Como** administrador de parqueadero
> **quiero** que el sistema rechace una tarifa que no tiene sentido
> **para poder** no descubrir el error cobrando de menos.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-007, FR-008 | E2.1 |

**Criterios de aceptación**

1. **Dado** una tarifa mínima mayor que la plena, **cuando** se intenta
   guardar, **entonces** el sistema la rechaza.
2. **Dado** un intervalo de cero minutos o negativo, **cuando** se intenta
   guardar, **entonces** el sistema lo rechaza.

---

### HU-2.1.3 · Conservar las versiones anteriores de una tarifa

> **Como** administrador de parqueadero
> **quiero** que al cambiar un precio se conserve el anterior con su periodo
> **para poder** explicar un cobro de hace meses.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-021, FR-022 | E2.1 |

**Criterios de aceptación**

1. **Dado** tres cambios de tarifa, **cuando** se consulta el historial,
   **entonces** aparecen tres versiones con periodos consecutivos y sin
   solapamiento.
2. **Dado** una tarifa que llegó a regir, **cuando** se intenta borrar,
   **entonces** el sistema lo impide.

---

### HU-2.1.4 · Calcular el cobro por jornadas tarifarias

> **Como** administrador de parqueadero
> **quiero** que la tarifa plena se aplique por jornada y no a toda la estadía
> **para poder** cobrar correctamente un vehículo que estuvo varios días.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-014 a FR-020 | E2.1 |

**Criterios de aceptación**

1. **Dado** un establecimiento con horario, **cuando** se calcula una
   permanencia larga, **entonces** la jornada va de la apertura al cierre.
2. **Dado** un establecimiento de 24 horas, **cuando** se calcula, **entonces**
   la jornada se reinicia a las 00:00.
3. **Dado** una permanencia que abarca varias jornadas, **cuando** se cobra,
   **entonces** el tope de plena se aplica a cada una por separado.

---

### HU-2.1.5 · Ver el total parcial de un vehículo que sigue adentro

> **Como** operario de taquilla
> **quiero** saber cuánto lleva acumulado un vehículo que aún no ha salido
> **para poder** responder cuando el cliente pregunta.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-024, FR-025 | E2.1 |

**Criterios de aceptación**

1. **Dado** un vehículo adentro, **cuando** se consulta, **entonces** el
   sistema entrega el importe acumulado hasta ese momento.
2. **Dado** ese importe, **cuando** se muestra, **entonces** viene con el
   desglose que lo justifica.

---

## Épica E2.2 · Declarar cuándo abre y cuánto cabe — P1

### HU-2.2.1 · Declarar el horario de atención

> **Como** administrador de parqueadero
> **quiero** declarar en qué horario atiendo
> **para poder** que el cobro respete mis horas de cierre.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-026, FR-027, FR-028, FR-029 | E2.2 |

**Criterios de aceptación**

1. **Dado** el formulario de horario, **cuando** se declara, **entonces**
   admite las tres formas: 24 horas, franjas por día y días de cierre.
2. **Dado** un horario que cruza la medianoche, **cuando** se declara,
   **entonces** el sistema lo admite sin caso especial.
3. **Dado** un momento cualquiera, **cuando** se consulta, **entonces** el
   sistema responde si el establecimiento está abierto.

---

### HU-2.2.2 · Declarar cuántos cupos hay por tipo

> **Como** administrador de parqueadero
> **quiero** declarar cuántos cupos tengo para cada tipo de vehículo
> **para poder** que la taquilla avise cuando se llene.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P1 | 8 | FR-031, FR-032, FR-033 | E2.2 |

**Criterios de aceptación**

1. **Dado** una capacidad negativa, **cuando** se intenta guardar,
   **entonces** el sistema la rechaza.
2. **Dado** una capacidad declarada, **cuando** se consulta la ocupación,
   **entonces** el conteo de ocupados se calcula aparte, no se almacena.

---

### HU-2.2.3 · Decidir si se cobran las horas cerradas

> **Como** administrador de parqueadero
> **quiero** decidir si le cobro al cliente las horas en que estuve cerrado
> **para poder** aplicar la política que de verdad uso.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-019, FR-020 | E2.2 |

**Criterios de aceptación**

1. **Dado** un vehículo que pasó la noche con el parqueadero cerrado,
   **cuando** se cobra y la política es no cobrarlas, **entonces** esas horas
   quedan fuera del importe.
2. **Dado** la política contraria, **cuando** se cobra, **entonces** las
   jornadas se tratan como contiguas.

---

## Épica E2.3 · Armar el equipo de la taquilla — P2

### HU-2.3.1 · Dar de alta un operario

> **Como** administrador de parqueadero
> **quiero** crear cuentas de operario para mi establecimiento
> **para poder** que atiendan la taquilla con su propia identidad.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-034, FR-052 | E2.3 |

**Criterios de aceptación**

1. **Dado** una cuenta creada por el administrador, **cuando** entra por
   primera vez, **entonces** se le exige cambiar la contraseña temporal.
2. **Dado** una cuenta nueva, **cuando** se crea, **entonces** recibe un código
   legible con la sigla del establecimiento.

---

### HU-2.3.2 · Limitar lo que un operario puede ver

> **Como** administrador de parqueadero
> **quiero** que un operario vea sólo la taquilla y lo suyo
> **para poder** no exponerle los datos del equipo ni la configuración.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-003, FR-025, FR-026 (M4) | E2.3 |

**Criterios de aceptación**

1. **Dado** un operario autenticado, **cuando** consulta cobros o reportes,
   **entonces** ve únicamente los de sus propios turnos.
2. **Dado** un operario, **cuando** escribe a mano la dirección de una pantalla
   de administración, **entonces** el sistema lo devuelve a la taquilla.

---

### HU-2.3.3 · Autorizar a un operario a corregir cobros

> **Como** administrador de parqueadero
> **quiero** poder autorizar a una persona concreta a corregir cobros cerrados
> **para poder** resolver un error de noche sin estar presente.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P3 | 3 | Delegación (constitución 1.1.0) | E2.3 |

**Criterios de aceptación**

1. **Dado** un operario sin autorización, **cuando** intenta corregir un cobro,
   **entonces** el sistema lo rechaza.
2. **Dado** una delegación otorgada, **cuando** se consulta, **entonces**
   consta quién la otorgó, a quién y cuándo, y puede revocarse.

---

## Épica E2.4 · Organizar quién trabaja y cuándo — P2

### HU-2.4.1 · Declarar los turnos del establecimiento

> **Como** administrador de parqueadero
> **quiero** declarar los turnos con su horario y sus días
> **para poder** que los operarios los abran desde la taquilla.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-034, FR-035 | E2.4 |

**Criterios de aceptación**

1. **Dado** un turno declarado, **cuando** se consulta, **entonces** tiene
   nombre, hora de inicio, hora de fin y los días en que aplica.
2. **Dado** un turno desactivado, **cuando** un operario intenta abrirlo,
   **entonces** el sistema lo impide.

---

### HU-2.4.2 · Asignar operarios a cada turno

> **Como** administrador de parqueadero
> **quiero** asignar personas a cada turno
> **para poder** ver de un vistazo quién cubre cada día de la semana.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P2 | 5 | FR-036, FR-037 | E2.4 |

**Criterios de aceptación**

1. **Dado** un turno con personas asignadas, **cuando** se abre el cuadrante,
   **entonces** cada día muestra quién lo cubre.
2. **Dado** un día marcado sin nadie asignado, **cuando** se mira el cuadrante,
   **entonces** el sistema lo señala como sin cubrir.

---

### HU-2.4.3 · Avisar de las horas de atención sin cubrir

> **Como** administrador de parqueadero
> **quiero** que el sistema me diga qué horas de atención no tienen turno
> **para poder** corregir el cuadrante antes de que falte alguien.

| Prioridad | Estimación | Requisitos | Épica |
|---|---|---|---|
| P3 | 3 | FR-038 | E2.4 |

**Criterios de aceptación**

1. **Dado** un horario de atención y unos turnos declarados, **cuando** hay
   franjas sin cubrir, **entonces** el sistema las enumera.
2. **Dado** ese aviso, **cuando** aparece, **entonces** no impide guardar la
   configuración: avisa, no bloquea.
