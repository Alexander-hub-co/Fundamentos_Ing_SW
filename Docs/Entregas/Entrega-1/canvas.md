# Propuesta del producto — Lean Canvas

**Parquivo** · Sistema de gestión para parqueaderos

---

## 1. Problema

Los parqueaderos pequeños y medianos cobran con una libreta y una calculadora.
De ahí salen tres problemas que el dueño sufre a diario:

1. **No sabe cuánto entró, ni por qué.** Al cerrar sólo hay un total en un
   cuaderno. Si no cuadra, no hay forma de reconstruir dónde se perdió.
2. **No puede explicar un cobro.** Cuando un cliente reclama, la única
   respuesta es «así me dio la cuenta». Eso cuesta clientes y discusiones.
3. **Los acuerdos con comercios se manejan de palabra.** El almacén de al lado
   sella tiques y a fin de mes nadie sabe cuánto se dejó de cobrar por eso.

### Alternativas que existen hoy

| Alternativa | Por qué no alcanza |
|---|---|
| Libreta y calculadora | No deja rastro, no cuadra y no explica nada |
| Hoja de cálculo | Mejora el registro, pero nadie la llena con fila delante |
| Sistemas de cadenas grandes | Caros, pensados para cientos de cupos, exigen instalación y contrato anual |

---

## 2. Segmentos de clientes

**Cliente objetivo:** parqueaderos independientes de 30 a 150 cupos, en zonas
comerciales de ciudad, con uno o dos operarios por turno.

**Primeros usuarios:** los que tienen **convenios con comercios vecinos**. Son
los que más sufren el problema —porque el descuento se aplica de memoria— y los
que antes ven el beneficio.

**Quien decide y quien usa no son la misma persona:**

| Rol | Qué le importa |
|---|---|
| Dueño o administrador | Saber cuánto entró y cuánto se dejó de cobrar |
| Operario | Que atender un carro cueste dos segundos y no equivocarse |

---

## 3. Propuesta única de valor

> **Cada cobro se puede explicar.**

Parquivo no sólo registra cuánto se cobró: guarda **por qué**. Cada movimiento
almacena una copia de la tarifa y del convenio que se le aplicaron en ese
instante.

Subir los precios en marzo no altera ni un peso de lo cobrado en febrero, y un
cobro de hace un año se puede justificar delante de un cliente aunque esa
tarifa ya no exista.

**Concepto de alto nivel:** el libro de contabilidad de un parqueadero, que
además cobra.

---

## 4. Solución

| Problema | Cómo lo resuelve |
|---|---|
| Cobrar rápido sin equivocarse | **Un solo campo**: se escribe la placa y el sistema decide si entra o sale |
| Explicar un cobro | El total viene siempre con su **desglose**: tarifa, convenios aplicados, los que no aplicaron y por qué, y el redondeo |
| Manejar acuerdos con comercios | **Convenios declarados**, que se aplican solos y quedan medidos: cuánto se usó cada uno y cuánto costó |
| Cuadrar la caja | **Turnos** con hora real de apertura y cierre, y cada movimiento atribuido a quien lo atendió |
| Que nadie altere el pasado | **Historial inmutable**: un cobro cerrado no se edita; si hubo error se emite una corrección al lado |

---

## 5. Canales

- **Venta directa** al administrador del parqueadero, con una demostración de
  quince minutos en su propia caseta.
- **Referidos entre parqueaderos** de la misma zona, que suelen conocerse.
- **Los comercios vecinos** con convenio, que tienen interés en que su
  parqueadero aliado lo use.

---

## 6. Flujo de ingresos

Suscripción mensual por establecimiento. Sin instalación, sin contrato anual y
sin cobro por número de vehículos: un parqueadero pequeño no puede pagar por
adelantado un sistema que todavía no sabe si va a usar.

El sistema ya contempla el estado de la cuenta —activo, pendiente, suspendido—
y el modo restringido: un establecimiento suspendido no recibe vehículos
nuevos, pero **los que están adentro sí pueden salir**. Cortar el servicio no
puede dejar carros atrapados.

---

## 7. Estructura de costes

| Concepto | Naturaleza |
|---|---|
| Servidor y base de datos | Fijo, compartido entre todos los establecimientos |
| Soporte y acompañamiento | Variable, alto al principio de cada cliente |
| Desarrollo y mantenimiento | Fijo |

La arquitectura multi-establecimiento es lo que hace viable el costo: una sola
instalación atiende a muchos clientes, y cada uno ve únicamente lo suyo.

---

## 8. Métricas clave

| Métrica | Qué indica |
|---|---|
| Establecimientos activos | Crecimiento real del negocio |
| Movimientos registrados por día | Si el sistema se usa de verdad o se abandonó |
| Veces que se consulta el desglose de un cobro | Si la propuesta de valor se está usando |
| Monto dejado de cobrar por convenios | El dato que el dueño no tenía antes |
| Turnos cerrados con caja cuadrada | Si resuelve el problema del cierre |

---

## 9. Ventaja difícil de copiar

**El modelo de datos.** Guardar una copia de las condiciones del cobro dentro
de cada movimiento parece un detalle, y es lo que sostiene toda la propuesta.
Un competidor que guarde una referencia a la tarifa en lugar de una copia no
puede explicar un cobro viejo, y cambiar eso después obliga a rehacer el
historial entero.

**El aislamiento impuesto por la base de datos.** Está construido desde la
primera línea, con políticas a nivel de fila. Añadirlo después, sobre un
esquema que ya tiene movimientos y tarifas, es un trabajo que nunca se termina
de hacer bien.
