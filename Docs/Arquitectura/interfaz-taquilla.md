# Referencia de interfaz: la taquilla

Documento de diseño para **F3**, escrito ahora porque el propietario entregó dos capturas de
referencia durante la especificación de F2 y conviene no perderlas hasta entonces.

No es una especificación: no tiene requisitos numerados ni criterios de aceptación. Es la forma
acordada de la pantalla, para que el `/speckit-specify` de F3 arranque desde acá.

## La decisión central: un solo campo resuelve entrada y salida

El operario escribe la placa y pulsa Enter. **No elige antes entre "registrar entrada" y "registrar
salida"**: el sistema averigua si ese vehículo ya está adentro y actúa en consecuencia.

- Si no está adentro → registra la entrada.
- Si ya está adentro → ofrece la salida, mostrando **cuánto tiempo lleva** y **cuánto debe pagar**.

Esta es la decisión que hay que respetar aunque todo lo demás cambie. La alternativa —dos pantallas
separadas— obliga a quien atiende a clasificar antes de escribir, que es trabajo que el sistema
puede hacer solo y que se equivoca justo cuando hay fila.

Corolario para F3: mientras el vehículo está adentro, el sistema debe poder informar el **total
parcial hasta el momento**, no sólo el total final al salir.

## Disposición

**Barra lateral fija** con las secciones del producto: vehículos, bicicletas, ingresos, salidas,
convenios, usuarios, reportes y configuración.

**Panel de turno** al pie de la barra lateral: turno abierto, su nombre, el empleado, la hora de
inicio y de fin, y un botón para cerrarlo.

**Área principal**, de arriba abajo:

1. Título y una línea que explica qué hacer.
2. El campo de la placa, **centrado y dominante**, con la placa en letra muy grande estilo
   matrícula. Es lo único que el operario mira mientras atiende, así que ocupa el lugar que le
   corresponde. Debajo, la indicación de que Enter confirma.
3. Un campo opcional de observaciones, con contador de caracteres, para dejar constancia de daños
   visibles del vehículo al entrar.
4. Un botón de acción ancho que repite que Enter también sirve.
5. Un aviso de confirmación con la tarifa que se va a aplicar. Si la placa tiene convenio, el aviso
   cambia de color y nombra el convenio en lugar del importe.
6. Una tira al pie con los datos del movimiento: hora de entrada, tipo de vehículo, tarifa, empleado
   y fecha.

## El turno, repartido entre tres features

Las capturas mostraban un turno abierto y el roadmap no lo contemplaba. El propietario detalló
después el sistema completo, y quedó claro que no es una sola cosa sino tres:

| Parte | Feature | Qué es |
|---|---|---|
| Configuración de turnos | **F2** | Nombre, horario, días, personas asignadas, activo o inactivo |
| Sesiones de turno | **F3** | Iniciar y finalizar, con hora real frente a programada |
| Turno en el movimiento | **F3** | Cada entrada y salida guarda quién la hizo y bajo qué turno |
| Reportes por turno | **F5** | Entradas, salidas e ingresos por turno, operario, día, semana y mes |

Lo que F3 hereda y hay que resolver allá:

- **La entrada y la salida pueden ser de turnos distintos.** Un vehículo entra a las 10:32 con Juan
  en el turno de mañana y sale a las 16:15 con Pedro en el de la tarde. El movimiento conserva
  **ambos** registros: quién hizo la entrada y bajo qué turno, y quién hizo la salida y bajo cuál.
  No es un dato único del movimiento sino uno por extremo.
- **Hora programada frente a hora real.** El turno de mañana empieza a las 07:00 y Juan lo abre a
  las 07:03. Guardar las dos permite después saber si alguien llegó tarde, salió antes o trabajó de
  más. Esas funciones vienen luego; el dato hay que guardarlo desde el principio o no se puede
  reconstruir.
- ¿Cerrar turno exige cuadrar caja?
- ¿Qué pasa si se desactiva un turno mientras alguien lo está cubriendo?

## Lo que NO se copia de la referencia

La referencia usa una barra lateral oscura fija. Parquivo ya tiene su propia paleta, tomada del
logo, y la regla de que el tema lo elige la persona y nunca el sistema. **De la referencia se toma
la estructura y el flujo, no los colores.**
