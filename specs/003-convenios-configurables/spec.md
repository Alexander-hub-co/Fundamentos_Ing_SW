# Feature Specification: Convenios y descuentos configurables

**Feature Branch**: `003-convenios-configurables`

**Created**: 2026-08-18

**Status**: Draft

**Input**: Un convenio hoy es un único porcentaje aplicado a una placa en lista, y eso cubre apenas uno de los casos reales. Los parqueaderos colombianos tienen convenios variados: comercios vecinos que sellan el ticket a cambio de tiempo gratis, clientes frecuentes con descuento porcentual, y mensualidades a las que no se les cobra la salida. Se reemplaza el campo único por un vocabulario pequeño y componible, con vigencias que se declaran por su nombre —mensual, trimestral, semestral, anual—, y se define cómo se calcula.

## Clarifications

### Session 2026-08-18

- Q: Cuando a una misma salida le aplican dos convenios que descuentan de la misma forma (por ejemplo dos porcentajes), ¿qué debe hacer el sistema? → A: Sumar los porcentajes, con el total de descuento acotado al 100 %.
- Q: ¿Existe algún acuerdo real que deba aplicarse a todos los vehículos, sin sello ni lista de placas, o la activación "siempre" sobra? → A: Sobra; se retira del vocabulario por el Principio V.
- Q: ¿El administrador general de la plataforma puede declarar o modificar los convenios de un establecimiento, para darle soporte por teléfono? → A: Sí, por la misma puerta de soporte acotada y auditada que ya se usa para las tarifas.
- Q: Las tres opciones de redondeo —al peso, a la cincuentena, a la centena— ¿alcanzan? → A: Sí; las tres son el conjunto definitivo para esta entrega.

### Session 2026-08-19

- Q: ¿Hace falta un asistente de IA para cubrir la variedad de los convenios? → A: No. Se descarta por completo, no se aplaza. La variedad es grande pero acotada, y se cubre enumerando más opciones.
- Q: ¿Qué opciones faltaban? → A: Vigencias con nombre —mensual, trimestral, semestral, anual—, que son como el negocio nombra sus acuerdos de larga duración.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Declarar los convenios que el establecimiento realmente tiene (Priority: P1)

La administradora de un parqueadero tiene cuatro acuerdos distintos y hoy sólo puede
expresar uno. Necesita declarar los cuatro sin que nadie toque el código: el fruver de
al lado que sella el ticket a cambio de una hora, la carnicería que hace lo mismo con
media hora, la clienta frecuente a la que se le cobra la mitad, y el vecino con
mensualidad al que no se le cobra la salida.

Cada convenio se declara respondiendo dos preguntas —cuándo aplica y qué hace— más los
límites que quiera ponerle.

**Why this priority**: Sin esto no hay nada. Es la única historia que, entregada sola,
ya cambia lo que el producto puede vender: hoy un parqueadero con convenios de sello
simplemente no es cliente.

**Independent Test**: Se declara cada uno de los cuatro convenios desde la pantalla de
configuración, se listan, y el comprobador (Historia 2) o una prueba automatizada
demuestra que cada uno produce el importe esperado.

**Acceptance Scenarios**:

1. **Given** un establecimiento sin convenios, **When** la administradora declara "Fruver
   La Esquina" con activación por sello y beneficio de 60 minutos gratis, **Then** el
   convenio queda vigente y aparece en la lista con su activación y su beneficio en
   palabras.
2. **Given** un convenio con beneficio de porcentaje, **When** se intenta guardar sin el
   valor del porcentaje, **Then** el sistema lo rechaza indicando qué falta, y no guarda
   una regla incompleta.
3. **Given** un convenio de porcentaje al 50 %, **When** se le agrega una placa a su
   lista, **Then** esa placa queda cubierta y ninguna otra placa del establecimiento lo
   está.
4. **Given** un convenio vigente, **When** se declara una vigencia que ya venció,
   **Then** deja de aplicar sin que su historial se destruya.
4b. **Given** el formulario de un convenio, **When** la administradora declara la
   mensualidad del vecino de la Torre B eligiendo la duración "mensual", **Then** el
   sistema calcula el vencimiento a un mes del inicio y la lista lo muestra como
   mensualidad, no como una fecha suelta.
5. **Given** un convenio de sello, **When** la administradora declara que sólo puede
   usarse una vez al día por placa, **Then** el límite queda registrado y el comprobador
   lo respeta.
6. **Given** el formulario de un convenio, **When** la administradora elige "sin límite",
   **Then** queda registrado como una decisión suya y el convenio se aplica cuantas veces
   se presente en el día.
7. **Given** el formulario de un convenio, **When** se intenta guardar un límite de cero,
   **Then** el sistema lo rechaza y señala que para eso se desactiva el convenio.
8. **Given** los convenios que existían antes de esta entrega (un porcentaje sobre una
   lista de placas), **When** se despliega la nueva versión, **Then** siguen vigentes y
   se leen como activación por placa con beneficio de porcentaje, sin intervención
   manual.

---

### User Story 2 - Comprobar el efecto antes de que llegue el cliente (Priority: P2)

La administradora acaba de declarar un convenio y quiere saber qué va a cobrar de
verdad, no confiar en que entendió bien. Escribe una permanencia de ejemplo, elige qué
convenios aplicarían, y ve el total con el desglose de cómo se llegó a él.

**Why this priority**: Un convenio mal declarado no falla, cobra mal, y eso se descubre
semanas después revisando ingresos. El desglose convierte un error silencioso en uno
visible. Depende de la Historia 1 pero se entrega y se prueba aparte.

**Independent Test**: Con un convenio ya declarado, se introduce una entrada y una
salida, se marca el convenio, y la pantalla muestra el importe base, cada beneficio
aplicado con su efecto en pesos, y el total.

**Acceptance Scenarios**:

1. **Given** una tarifa de $700 cada 15 minutos y un convenio de 60 minutos gratis,
   **When** se comprueba una permanencia de 5 horas, **Then** el resultado muestra los
   minutos cobrables antes y después del beneficio, y el total corresponde a 4 horas.
2. **Given** una permanencia de 40 minutos y un convenio de 60 minutos gratis, **When**
   se comprueba, **Then** el total es cero y nunca un número negativo.
3. **Given** una placa con 50 % de descuento que además presenta el sello del fruver,
   **When** se comprueban ambos, **Then** el desglose lista los dos beneficios en el
   orden en que se aplicaron y el total refleja los dos.
4. **Given** un convenio con tope de $5.000 y un descuento que sin tope sería de $9.000,
   **When** se comprueba, **Then** el descuento efectivo es de $5.000 y el desglose lo
   dice explícitamente.
5. **Given** dos convenios aplicables del 50 % y del 20 %, **When** se comprueba una
   permanencia, **Then** el descuento es del 70 % y el desglose muestra el aporte de cada
   convenio por separado.
6. **Given** tres convenios aplicables del 40 % cada uno, **When** se comprueba, **Then**
   el descuento se acota al 100 %, el total es cero y el desglose dice que la suma se
   recortó.
7. **Given** un convenio limitado a una vez al día y una placa que ya lo usó hoy, **When**
   se comprueba una segunda salida, **Then** el convenio no se aplica y el desglose dice
   que se descartó por haber alcanzado su límite diario.
8. **Given** un establecimiento que declaró redondeo a la centena y un importe calculado
   de $6.850, **When** se comprueba, **Then** el total es $6.800 y no $6.900, porque el
   redondeo nunca sube.

---


### Edge Cases

- **Los minutos gratis superan la permanencia.** El total es cero. Nunca negativo, y
  nunca un saldo a favor.
- **Coinciden un beneficio de tiempo y uno de importe fijo.** El importe fijo y el "sin
  cobro" determinan el total por sí solos; los beneficios de tiempo dejan de tener
  efecto y el desglose lo dice, en lugar de mostrar un descuento que no se aplicó.
- **Llegan dos sellos a la vez** (el cliente compró en el fruver y en la carnicería). Se
  pueden confirmar los dos; sus minutos se suman y el desglose los lista por separado.
- **El convenio vence mientras el vehículo está adentro.** La vigencia se evalúa en el
  instante de la salida, que es cuando se cobra. Un solo instante de evaluación evita
  que el mismo movimiento tenga dos respuestas posibles.
- **Los porcentajes suman más del 100 %.** El descuento se acota al 100 %, el total queda
  en cero y el desglose dice que la suma se recortó. Nunca se genera un saldo a favor.
- **El descuento supera el tope declarado.** Se recorta al tope y el desglose indica que
  se recortó.
- **Un porcentaje del 100 %.** Total cero, y se distingue en el desglose de "sin cobro",
  porque son declaraciones distintas aunque coincidan en el resultado.
- **Una duración con nombre cae en un mes más corto.** Una mensualidad que empieza el 31
  de enero vence el 28 o el 29 de febrero, no el 3 de marzo. Se respeta el mes, que es lo
  que la persona acordó, en lugar de contar treinta días.
- **El vehículo entra un día y sale al siguiente.** La aplicación cuenta en el día de la
  salida. Un carro que entró el martes a las 11 de la noche y salió el miércoles a las 2
  de la mañana gasta el cupo del miércoles, no el del martes.
- **El cliente vuelve el mismo día y el convenio tiene límite diario.** No se aplica la
  segunda vez, y quien atiende ve por qué. Un convenio que desaparece sin explicación se
  interpreta como una falla del sistema.
- **La placa está en la lista de un convenio suspendido o vencido.** No aplica, y la
  pantalla lo dice en vez de omitirlo en silencio.

## Requirements *(mandatory)*

### Functional Requirements

#### El vocabulario

- **FR-001**: El sistema MUST permitir declarar, para cada convenio, exactamente una
  forma de activación entre dos: por sello (alguien lo confirma en el momento de la
  salida) y por placa (la placa figura en la lista del convenio). No existe una activación
  que aplique a todos los vehículos: ningún acuerdo real la necesita, y el Principio V
  prohíbe construirla sin una especificación que la respalde.
- **FR-002**: El sistema MUST permitir declarar, para cada convenio, exactamente un
  beneficio entre: minutos gratis, porcentaje sobre el total, tarifa fija, o sin cobro.
- **FR-003**: El sistema MUST exigir los parámetros que el beneficio declarado necesita y
  MUST rechazar los que no le corresponden, de modo que no pueda existir un convenio con
  un beneficio de porcentaje y un valor en minutos.
- **FR-004**: El sistema MUST permitir declarar un tope en pesos por convenio, que limita
  cuánto puede descontar ese convenio en una sola salida.
- **FR-004a**: El sistema MUST permitir declarar cuántas veces al día puede aplicarse un
  convenio a una misma placa. El administrador MUST poder elegir cualquier número desde
  una vez al día hasta sin límite; el sistema MUST NOT imponer un máximo ni sugerir una
  cifra "razonable", porque cuál es razonable depende del acuerdo y sólo lo sabe quien lo
  pactó.
- **FR-004a-bis**: "Sin límite" MUST ser una elección explícita del administrador y MUST
  NOT deducirse de un campo vacío. Un campo en blanco no distingue "quiero que sea
  ilimitado" de "se me olvidó llenarlo", y en un convenio que descuenta dinero esa
  diferencia importa.
- **FR-004a-ter**: El sistema MUST rechazar un límite de cero. Un convenio que no puede
  aplicarse nunca no es un convenio limitado sino uno desactivado, y para eso ya existe el
  estado activo.
- **FR-004b**: "Al día" MUST significar el día calendario en la zona horaria del
  establecimiento, de medianoche a medianoche, y no una ventana móvil de veinticuatro
  horas. Es lo que entiende quien lleva la contabilidad, y es lo que puede explicarle un
  operario a un cliente que reclama.
- **FR-004c**: Cuando una permanencia cruza la medianoche, la aplicación MUST contarse en
  el día de la SALIDA, porque es el instante en que el convenio se aplica y se cobra. Un
  mismo cobro nunca MUST poder contarse en dos días.
- **FR-005**: El sistema MUST conservar la vigencia por fechas y el estado activo que ya
  existen, y MUST evaluar ambos en el instante de la salida.
- **FR-005a**: El sistema MUST permitir declarar la vigencia como una duración con nombre
  —mensual, trimestral, semestral o anual— además de como una fecha concreta o sin
  vencimiento. Son los nombres con los que el negocio llama a sus acuerdos de larga
  duración, y pedirle a alguien que traduzca "mensualidad" a una fecha es pedirle que haga
  a mano una cuenta que el sistema puede hacer sola.
- **FR-005b**: Cuando se declara una duración con nombre, el sistema MUST calcular la
  fecha de vencimiento a partir del inicio de la vigencia, y MUST conservar la duración
  declarada además de la fecha. Guardar sólo la fecha perdería la intención: la lista
  diría "vence el 19 de septiembre" en lugar de "mensualidad", que es lo que quien
  administra reconoce de un vistazo.
- **FR-005c**: Una duración con nombre MUST producir siempre una fecha de vencimiento. No
  puede existir un convenio declarado como mensual y sin vencimiento, porque sería una
  mensualidad que no vence.
- **FR-006**: El sistema MUST convertir los convenios que ya existen a activación por
  placa con beneficio de porcentaje, conservando su valor, sus placas y su vigencia, sin
  que ningún administrador tenga que volver a declararlos.

#### El cálculo

- **FR-007**: El sistema MUST restar los minutos gratis del tiempo cobrable ANTES de
  aplicar la tarifa, no del importe resultante, porque el valor de un minuto depende de
  la tarifa, de la tarifa plena y de la tarifa mínima, y por lo tanto una hora gratis no
  equivale a un monto fijo.
- **FR-008**: El sistema MUST aplicar los beneficios en un orden único y declarado:
  primero los de tiempo, luego la tarifa, luego los de porcentaje, luego los topes.
- **FR-008a**: Cuando varios convenios otorgan minutos gratis, sus minutos MUST sumarse.
- **FR-008b**: Cuando varios convenios otorgan un porcentaje, sus porcentajes MUST sumarse
  antes de aplicarse, de modo que 50 % y 20 % descuenten el 70 % del importe y no el 60 %
  que resultaría de encadenarlos. Se suman porque es lo que un operario puede explicarle a
  un cliente en la caja sin hacer cuentas.
- **FR-008c**: La suma de porcentajes MUST acotarse al 100 %. Tres convenios del 40 %
  descuentan el 100 %, no el 120 %, y el desglose MUST decir que la suma se acotó. Sin ese
  freno, sumar produciría un total negativo, que es exactamente lo que FR-010 prohíbe.
- **FR-008d**: El desglose MUST mostrar cada convenio con su aporte individual además del
  descuento total, para que se pueda auditar qué acuerdo puso cuánto.
- **FR-009**: El sistema MUST tratar la tarifa fija y el sin cobro como determinantes del
  total, ignorando el resto de beneficios, y MUST dejar constancia de ello en el
  desglose.
- **FR-010**: El sistema MUST garantizar que el total nunca sea negativo.
- **FR-011**: La regla de redondeo MUST ser configuración declarada por establecimiento,
  no una constante del sistema, porque el Principio II la nombra explícitamente entre lo
  que cada parqueadero decide. Las opciones MUST ser exactamente tres: sin redondeo más
  allá del peso, a la cincuentena y a la centena. Las dos últimas existen porque en
  Colombia apenas circulan monedas por debajo de cincuenta pesos, y un parqueadero no
  puede devolver un sencillo que no tiene.
- **FR-011a**: El valor inicial de esa configuración MUST ser "sin redondeo más allá del
  peso, truncando hacia abajo", MUST vivir en los datos de inicialización marcado como
  valor por defecto, y MUST ser sobrescribible por el administrador del establecimiento.
- **FR-011b**: Ninguna regla de redondeo MUST poder producir un total mayor que el importe
  calculado. El redondeo puede favorecer al cliente; nunca al establecimiento.
- **FR-012**: El sistema MUST producir, junto al total, un desglose que nombre el importe
  base, cada beneficio aplicado, cuánto restó cada uno y si alguno fue recortado por su
  tope.
- **FR-013**: El sistema MUST producir el mismo total para la misma permanencia, la misma
  tarifa y los mismos convenios, cuantas veces se calcule y en cualquier momento futuro.
- **FR-013a**: El cálculo MUST recibir, para cada convenio candidato, cuántas veces se
  aplicó ya ese convenio a esa placa en el día, y MUST descartar el convenio cuando ese
  número alcanza el límite declarado. El desglose MUST decir que se descartó por límite
  diario y no omitirlo en silencio.
- **FR-013b**: Contar las aplicaciones previas MUST ser responsabilidad de quien invoca el
  cálculo, no del cálculo mismo. La regla del límite se declara y se verifica aquí; la
  cuenta la aporta el historial de movimientos cuando exista.
- **FR-014**: El cálculo MUST funcionar sin acceso a ningún servicio externo.

#### Verificación

- **FR-015**: Los administradores MUST poder comprobar el efecto de sus convenios sobre
  una permanencia de ejemplo, eligiendo cuáles aplicarían, y ver el desglose completo.
- **FR-015a**: La comprobación MUST permitir simular cuántas veces se aplicó ya el
  convenio ese día, para que el administrador vea con sus propios ojos qué pasa cuando el
  cliente vuelve por segunda vez.

#### Aislamiento e historial

- **FR-016**: Un convenio MUST pertenecer a exactamente un establecimiento, y ningún
  administrador de establecimiento MUST poder ver, aplicar ni modificar los convenios de
  otro.
- **FR-016a**: El administrador general de la plataforma MUST poder declarar y modificar
  los convenios de un establecimiento para darle soporte, por la misma puerta acotada que
  ya se usa para las tarifas: la que estrecha su alcance al establecimiento indicado en
  lugar de elevar privilegios.
- **FR-016b**: Todo cambio hecho por soporte MUST quedar distinguible del que hizo el
  propio establecimiento, tanto en la auditoría como en el dato: el administrador del
  local MUST poder ver que ese convenio no lo declaró él. Sin esa distinción, vería
  aparecer cambios que no hizo y sin forma de saber quién los hizo.
- **FR-017**: Una placa MUST poder pertenecer a lo sumo a un convenio por establecimiento,
  para que la respuesta a "qué descuento le corresponde a esta placa" sea única.
- **FR-018**: El sistema MUST definir, como contrato para la funcionalidad de taquilla,
  que toda salida guarde una copia de los convenios aplicados —su nombre, su activación,
  su beneficio y el valor descontado— y no sólo una referencia a ellos, de modo que
  cambiar un convenio mañana no altere lo que ya se cobró.

#### La taquilla se genera del dato

- **FR-019**: El sistema MUST exponer, para una placa y un instante dados, qué convenios
  se aplican solos —los de activación por placa— y qué convenios requieren la confirmación
  de un sello, cada uno con su nombre, para que la pantalla de taquilla se arme a partir
  de esa información.
- **FR-020**: El sistema MUST NOT contener ninguna condición que mencione un convenio o un
  comercio concreto. Declarar un convenio nuevo MUST bastar para que aparezca donde
  corresponde.

### Key Entities

- **Convenio**: un acuerdo del establecimiento. Tiene nombre, una de las dos formas de
  activación —sello o placa—, un beneficio con su valor, un tope opcional en pesos, un
  límite de aplicaciones por día y por placa, una vigencia —que puede declararse como una
  duración con nombre— y un estado. Pertenece a un establecimiento.
- **Regla de redondeo**: cómo redondea sus totales un establecimiento. Es configuración
  suya, con un valor inicial sobrescribible.
- **Placa cubierta**: la relación entre una placa y el convenio que la cubre, para los
  convenios de activación por placa. Una placa pertenece a lo sumo a un convenio por
  establecimiento.
- **Desglose del cobro**: el resultado del cálculo. Lleva el importe base, la lista de
  beneficios aplicados con su efecto, los recortes por tope, los convenios descartados por
  límite diario con esa razón dicha, el efecto del redondeo y el total.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los cuatro acuerdos del negocio —comercio con sello de una hora, comercio
  con sello de media hora, cliente con la mitad del precio y cliente sin cobro— se pueden
  declarar sin escribir ni desplegar código.
- **SC-002**: Declarar un convenio nuevo toma menos de un minuto para alguien que ya sabe
  qué acuerdo quiere expresar.
- **SC-003**: Para cualquier permanencia y cualquier combinación de convenios, el sistema
  muestra el importe base, cada beneficio con su efecto en pesos y el total.
- **SC-004**: Dos establecimientos con convenios distintos producen totales distintos para
  la misma permanencia y la misma tarifa.
- **SC-005**: El total nunca es negativo ni contiene fracciones de peso, en ninguna
  combinación de beneficios y límites.
- **SC-005a**: Ninguna combinación de convenios, topes y reglas de redondeo produce un
  total mayor que el importe que arroja la tarifa sola.
- **SC-005d**: Ninguna combinación de porcentajes, por muchos convenios que se acumulen,
  produce un total negativo ni un saldo a favor del cliente.
- **SC-005b**: Un convenio con límite diario deja de aplicarse exactamente cuando alcanza
  ese número de aplicaciones en el día, ni antes ni después, para cualquier número que el
  administrador haya declarado.
- **SC-005c**: Un convenio declarado sin límite se aplica todas las veces que se presente
  en el mismo día, sin tope impuesto por el sistema.
- **SC-006**: Un administrador de un establecimiento no logra ver ni aplicar ningún
  convenio de otro establecimiento.
- **SC-006a**: Todo convenio declarado o modificado por soporte queda identificado como
  tal, y el administrador del establecimiento puede distinguirlo de los suyos sin
  preguntarle a nadie.
- **SC-007**: Los acuerdos de larga duración —mensual, trimestral, semestral y anual— se
  declaran eligiendo la duración, sin que nadie tenga que calcular una fecha de
  vencimiento a mano.
- **SC-008**: El mismo cálculo repetido en momentos distintos da el mismo resultado.

## Assumptions

- **El redondeo es configuración del establecimiento, no una constante.** El Principio II
  nombra las "reglas de redondeo" entre lo que cada parqueadero decide, y se acata tal
  como está escrito. El valor inicial —sin redondeo más allá del peso, truncando hacia
  abajo— es un dato de inicialización sobrescribible, no una decisión enterrada en el
  código. Se elige truncar y no aproximar porque el redondeo hacia arriba cobraría pesos
  que ningún cálculo produjo, y ése es exactamente el problema contable que hay que
  evitar.
- **La activación por sello no verifica la condición del comercio.** Los treinta mil pesos
  de compra que exige el fruver los comprueba el fruver; el sistema sólo observa que
  alguien confirmó el sello. Se modela únicamente lo que el sistema puede observar.
- **Varios sellos en una misma salida son legítimos** y sus beneficios se suman: los
  minutos entre sí y los porcentajes entre sí. Se asume que un cliente puede haber
  comprado en dos comercios aliados y que ambos acuerdos deben honrarse, no sólo el mayor.
- **La vigencia se evalúa en el instante de la salida**, no en el de la entrada, porque es
  cuando se cobra. Por la misma razón, el límite diario se cuenta contra el día de la
  salida: un solo instante de evaluación para todo, para que el mismo movimiento no tenga
  dos respuestas posibles.
- **Esta entrega no aplica convenios a movimientos reales**, porque los movimientos no
  existen todavía. Entrega la declaración, el cálculo completo —límite diario incluido— y
  la comprobación; la pantalla de taquilla y el registro histórico los consume la
  funcionalidad de taquilla, contra el contrato de FR-018, FR-019 y FR-013b. Que el
  cálculo reciba la cuenta de aplicaciones previas como dato en vez de averiguarla es lo
  que permite entregar y probar la regla hoy, sin esperar al historial.
- Se asume que el establecimiento ya tiene tarifas declaradas, porque un convenio
  descuenta sobre un cobro que debe existir primero.

## Out of Scope

- **Un asistente de IA que interprete descripciones en prosa.** Se especificó, se aprobó y
  después se descartó por completo —no se aplazó—. La razón la dio el propietario del
  producto y es la correcta: la variedad de los convenios es grande pero **acotada**, y una
  variedad acotada se enumera. Los cuatro acuerdos reales caben en dos activaciones por
  cuatro beneficios, y lo que faltaba para cubrir el resto no era interpretación sino una
  lista más larga de opciones (FR-005a). Enumerar no trae dependencia externa, ni clave de
  API, ni costo por uso, ni respuestas que cambien entre una vez y otra.

- **La pantalla de taquilla** y el registro de lo aplicado en cada salida. Esta
  especificación define el contrato; la funcionalidad de taquilla lo implementa.
- **Contar las aplicaciones previas de un convenio** sobre una placa en el día. La regla
  del límite diario se declara y se verifica aquí (FR-004a, FR-013a); quien la alimenta
  con la cuenta real es el historial de movimientos, que llega con la taquilla. Hasta
  entonces la cuenta se aporta explícitamente y el comprobador permite simularla.
- **El cobro de la mensualidad en sí** —quién pagó, cuándo y cuánto—. El convenio sólo
  declara que a esa placa no se le cobra la salida. La facturación pertenece a la
  funcionalidad de pagos, diferida.
- **La condición de compra mínima** de los convenios de sello, por lo dicho en Assumptions.
- **Una activación que aplique a todos los vehículos** (promociones de temporada del tipo
  "20 % todo diciembre"). Se consideró y se descartó en clarificación: ningún acuerdo real
  la necesita hoy. Si algún día hace falta, entra con su caso de uso por delante.

## Constitutional Notes

- **Principio II (cero valores quemados)**: esta funcionalidad existe precisamente para
  sacar del código la última condición de convenio que quedaba fija. FR-020 lo hace
  verificable. La regla de redondeo entra por la misma puerta: el Principio II la nombra
  entre lo que cada establecimiento decide, así que se declara y no se supone. Una
  versión anterior de esta especificación argumentaba que redondear al peso no contaba
  como "regla de redondeo"; se descartó ese argumento por lo que es, una interpretación a
  conveniencia de un principio que está escrito sin ambigüedad.
- **Principio III (la taquilla es la ruta crítica)**: FR-019 agrega botones a la pantalla
  de taquilla, y el Principio III exige justificar por qué no pueden vivir en el panel
  administrativo. La justificación es que el sello es un objeto físico que llega con el
  cliente en el instante de la salida, y sólo quien atiende puede verlo. No hay ningún
  momento anterior en el que un administrador pudiera declararlo. Los convenios por placa,
  en cambio, no agregan ni un clic: se aplican solos.
- **Principio IV (integridad del historial)**: FR-018 recoge la exigencia de guardar copia
  del convenio aplicado y no una referencia. FR-016b agrega la trazabilidad del soporte:
  un cambio hecho por la plataforma queda distinguible del que hizo el local.
- **Principio I (aislamiento)**: FR-016 mantiene la frontera entre establecimientos.
  FR-016a abre la única excepción que la propia especificación de configuración ya había
  abierto para las tarifas, y lo hace por la misma puerta: acotando el alcance, no
  elevando privilegios, y dejando asiento de auditoría.
- **Principio V (alcance deliberado)**: dos cosas se retiraron en lugar de construirse. La
  activación "siempre" cabía en el modelo y ningún acuerdo real la pedía. Y el asistente de
  IA se descartó al comprobar que la variedad que iba a interpretar se cubría enumerando
  opciones: construirlo habría sido pagar una dependencia externa por un problema que no
  existía. Lo que sí entra —el límite diario, las vigencias con nombre— entra porque sirve
  a establecimientos reales, no porque el modelo lo admitiera.
