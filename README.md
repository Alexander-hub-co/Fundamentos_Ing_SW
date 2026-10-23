# Parquivo — Sistema de gestión para parqueaderos

**Fundamentos de Ingeniería de Software** · código 12946 · segundo semestre de 2026
Pontificia Universidad Javeriana — Bogotá

---

## Descripción

**Parquivo es una aplicación web para administrar parqueaderos.** Reemplaza la
libreta, la calculadora y el tarjetón de cartón con los que hoy trabaja la
mayoría de los parqueaderos pequeños y medianos del país.

Su objetivo es que **todo el dinero que entra a un parqueadero quede registrado,
atribuido a alguien y explicable**. Que al cerrar la caja se sepa cuánto entró,
en qué turno y por qué; y que cuando un cliente reclame por un cobro, la
respuesta no sea «así me dio la cuenta» sino el detalle de cómo se calculó.

Una sola instalación atiende a **varios establecimientos a la vez**, y cada uno
mantiene sus tarifas, horarios, turnos, convenios e historial completamente
separados de los demás.

### El problema que resuelve

Un parqueadero que cobra a mano tiene tres problemas que el dueño sufre a
diario:

1. **No sabe cuánto entró, ni por qué.** Al cerrar solo hay un total en un
   cuaderno. Si no cuadra, no hay manera de reconstruir dónde se perdió.
2. **No puede explicar un cobro.** Cuando un cliente reclama, no hay con qué
   sustentar la cuenta. Eso cuesta clientes y discusiones.
3. **Los acuerdos con los comercios vecinos se manejan de palabra.** El almacén
   de al lado sella tiques y a fin de mes nadie sabe cuánto se dejó de cobrar
   por eso.

### Qué hace

**Para el operario que atiende la taquilla**

- Registra entradas y salidas de vehículos con **un solo campo**: se escribe la
  placa y el sistema decide si el vehículo entra o sale, sin que haya que
  elegir entre las dos opciones.
- Deduce solo si es carro o moto, a partir del último carácter de la placa.
- Calcula el cobro al salir y muestra **el desglose completo**: el importe base,
  cada convenio con su efecto, los que no se aplicaron y por qué, y el redondeo.
- Recibe bicicletas y les asigna un número de ficha automáticamente, con los
  datos de quien la deja para poder devolvérsela aunque pierda el tique.
- Imprime el comprobante, y si la impresora falla no detiene la fila: el
  movimiento queda registrado y el comprobante pasa a pendientes.
- Abre y cierra su turno, guardando la hora real además de la programada.

**Para el administrador del establecimiento**

- Declara las tarifas por tipo de vehículo, en dos modelos: por minuto o por
  intervalos. Cada cambio **versiona** la tarifa anterior en vez de borrarla.
- Declara el horario de atención, incluidos los que cruzan la medianoche y los
  días de cierre.
- Configura los convenios con comercios vecinos: qué descuento dan, si se
  activan por placa o por sello, y cuántas veces al día aplican.
- Da de alta operarios, arma el cuadrante de turnos y ve si quedan horas de
  atención sin nadie asignado.
- Consulta reportes por día, semana, mes y turno.

**Para el administrador de la plataforma**

- Da de alta establecimientos y sus administradores.
- Gestiona el estado de cada cuenta: activa, pendiente o suspendida.
- Con el establecimiento suspendido, el sistema impide entradas nuevas pero
  **permite cerrar las que ya están adentro**, para que nadie quede encerrado
  por un problema de facturación.

### Qué lo distingue

- **Cada cobro se puede explicar.** Todo movimiento cerrado guarda una copia de
  la tarifa y de los convenios que se le aplicaron en ese instante, no una
  referencia. Cambiar una tarifa hoy no altera lo que se cobró el año pasado.
- **El historial no se reescribe.** Un movimiento cerrado no se edita ni se
  borra; las correcciones se registran como asientos nuevos que apuntan al
  original.
- **El aislamiento entre establecimientos lo garantiza la base de datos**, con
  seguridad a nivel de fila, no una comprobación en el código que alguien pueda
  olvidar.
- **La taquilla manda sobre el resto.** El producto se organiza alrededor de una
  sola pantalla, donde un operario pasa el día de pie con una fila delante. Todo
  lo demás —configurar tarifas, declarar convenios, revisar reportes— se visita
  una vez al mes.

### Fuera del alcance

Pasarela de pagos en línea, facturación electrónica, reconocimiento automático
de placas por cámara, aplicación móvil nativa y reserva anticipada de cupo. El
porqué de cada exclusión está en la
[hoja de ruta](Docs/Arquitectura/roadmap.md).

---

## Equipo del Proyecto

El equipo de **Parquivo** se encuentra organizado mediante roles definidos para
apoyar la gestión, planificación, calidad y desarrollo del proyecto.

| Integrante | Rol | GitHub |
|---|---|---|
| **Cristian Quevedo** | Product Owner | [@CristianQ8907E](https://github.com/CristianQ8907E) |
| **Sergio Alexander L.** | Scrum Master | [@Alexander-hub-co](https://github.com/Alexander-hub-co) |
| **Sergio Alexander L.** | Configuration Manager | [@Alexander-hub-co](https://github.com/Alexander-hub-co) |
| **Santiago Arias** | Sprint Planner | [@IngSantiArias](https://github.com/IngSantiArias) |
| **Santiago Arias** | QA Lead | [@IngSantiArias](https://github.com/IngSantiArias) |
| **Jacob Riveros** | DevOps Engineer | [@JacobRiveros67](https://github.com/JacobRiveros67) |

Los cuatro integran además el equipo de desarrollo: en un equipo de este tamaño,
dejar a dos personas fuera de la construcción no tendría sentido. El detalle de
qué responde cada rol está en el
[organigrama](Docs/Entregas/Entrega-1/organigrama.md).

**Docente:** Ing. Kerwin de Jesús Barros Somerson — [@kbarrosDev](https://github.com/kbarrosDev)

---

## Tecnologías Utilizadas

- **Lenguaje:** TypeScript
- **Frontend:** React 19
- **Framework de aplicación:** Next.js 16 (App Router)
- **Base de Datos:** PostgreSQL con seguridad a nivel de fila
- **Acceso a datos:** Drizzle ORM
- **Autenticación:** better-auth
- **Pruebas:** Vitest contra una base de datos real
- **Gestión de dependencias:** npm + package-lock.json
- **Control de versiones:** Git

**Seis dependencias de producción en total.** No se usa librería de componentes,
de estilos ni de gráficos: todo eso está escrito a medida. Cada elección responde
a una razón concreta —TypeScript para que los errores de tipo salgan al compilar
y no delante de un cliente, PostgreSQL porque aísla inquilinos de verdad— y esas
razones están en la [hoja de ruta](Docs/Arquitectura/roadmap.md).

---

## Requisitos previos

- **Node.js 20** o superior
- **PostgreSQL 16** o superior
- **npm** (viene con Node)

---

## Instalación y ejecución

```bash
# 1. Clonar e instalar dependencias
git clone https://github.com/Alexander-hub-co/Fundamentos_Ing_SW.git
cd Fundamentos_Ing_SW
npm install

# 2. Configurar el entorno
cp .env.example .env
#    Editar .env con las credenciales de PostgreSQL.
#    Generar el secreto de sesión con:  openssl rand -base64 32

# 3. Preparar la base de datos
#    El usuario de DATABASE_URL_MIGRATOR debe existir y ser dueño de la base.
#    El migrador crea los roles app_tenant y app_platform con las contraseñas
#    de .env, y luego aplica las migraciones y el blindaje.
npm run db:migrate
npm run db:semilla -- admin@ejemplo.com "Nombre Apellido" "contraseña"
#                              # crea la cuenta inicial de administrador general

# 4. Levantar en desarrollo
npm run dev                    # http://localhost:3000
```

### Comprobar que todo funciona

```bash
npm run typecheck          # verificación de tipos
npm run lint               # análisis estático
npm run db:migrate:test    # prepara la base de pruebas (lee .env.test)
npm test                   # suite de pruebas automatizadas
npm run build              # compilación para producción
```

---

## Estructura del Proyecto

```
Fundamentos_Ing_SW/
│
├── Docs/
│   ├── SRS/
│   │   └── Especificación de requisitos de software del sistema.
│   │
│   ├── Entregas/
│   │   ├── Entrega-1/          Canvas, casos de uso, historias de usuario,
│   │   │                       organigrama, calendario y reporte gerencial.
│   │   ├── Entrega-2/          Diseño de la solución (SDD), reporte gerencial
│   │   │                       y estándares de programación.
│   │   └── Taller-de-Diseno/   Explicación de los diagramas del taller e informe.
│   │
│   ├── Diagramas/
│   │   └── TODOS los diagramas del proyecto en PNG, con sus fuentes
│   │       en fuentes/.
│   │
│   ├── Informes/
│   │   └── Informe técnico y acuerdo de uso académico.
│   │
│   ├── Actas/
│   │   └── Actas de las reuniones del equipo, martes y viernes.
│   │
│   ├── Arquitectura/
│   │   └── Hoja de ruta por módulos y decisiones de arquitectura.
│   │
│   ├── UserGuide/
│   │   └── Guía de uso por rol y manual de despliegue.
│   │
│   ├── Planning/
│   │   └── Planeación de cada sprint.
│   │
│   ├── Review/
│   │   └── Revisión al cerrar cada sprint.
│   │
│   ├── Retrospective/
│   │   └── Retrospectiva de cada sprint.
│   │
│   ├── Dailys/
│   │   └── Sesiones de trabajo de martes y viernes.
│   │
│   └── Mockups/
│       └── Capturas de las pantallas del sistema.
│
├── src/
│   ├── app/
│   │   └── Las pantallas y sus acciones de servidor, por rol:
│   │       acceso, establecimiento y plataforma.
│   │
│   ├── dominio/
│   │   └── Las reglas de negocio puras: cálculo del cobro,
│   │       clasificación por placa, jornadas y convenios.
│   │
│   ├── db/
│   │   └── Esquema, migraciones y el blindaje de seguridad
│   │       a nivel de fila.
│   │
│   └── lib/
│       └── Autenticación, autorización y utilidades comunes.
│
├── tests/
│   ├── aislamiento/
│   │   └── Que un establecimiento no alcance nada de otro.
│   │
│   ├── integracion/
│   │   └── Reglas de negocio contra PostgreSQL real.
│   │
│   └── unit/
│       └── Cálculos puros y forma de las pantallas.
│
├── specs/
│   └── Especificación, plan técnico y tareas de cada módulo.
│
├── scripts/
│   └── Preparación de la base de datos y datos de ejemplo.
│
├── design_handoff_parquivo/
│   └── Maquetas de las pantallas, entregadas por diseño.
│
├── Casos-de-uso-mas-importantes/
│   ├── CU-07-registrar-entrada/
│   │   └── Descripción del caso de uso y el código que lo implementa.
│   │
│   └── CU-08-cobrar-salida/
│       └── Descripción del caso de uso y el código que lo implementa.
│
├── Database/
│   └── Modelo entidad-relación y decisiones del esquema.
│
├── Script/
│   └── Comprobación de coherencia de la documentación del repositorio.
│
├── Gráficas/
│   └── Avance por sprint, trabajo restante y reparto de la carga.
│
├── .github/workflows/
│   └── Integración continua: tipos, análisis estático y pruebas.
│
├── package.json
│   └── Seis dependencias de producción y las órdenes del proyecto.
│
├── .env.example
│   └── Las variables de entorno que hay que definir. El .env real
│       nunca se versiona.
│
└── README.md
    └── Este documento.
```

---

## Flujo de trabajo con Git

| Rama | Para qué |
|---|---|
| `main` | Versión estable. Sólo recibe fusiones desde `develop` |
| `develop` | Integración del trabajo en curso |
| `feature/<funcionalidad>` | Una por funcionalidad. Sale de `develop` y vuelve a ella |

**Antes de empezar una funcionalidad:** `git pull`
**Nunca** se hace commit directo sobre `main` ni sobre `develop`.

---

## Gestión del proyecto

- **Tablero:** [KAMBAN_FIS_2630_G#](https://github.com/users/Alexander-hub-co/projects/1)
- **Issues:** etiquetados por módulo, prioridad y estimación en puntos de historia
- **Sprints:** de dos semanas, registrados como *milestones*
- **Comprobación:** `bash Script/verificar.sh` revisa que los enlaces resuelvan, que los conteos de requisitos cuadren y que ningún documento quede a medio llenar
- **Ceremonias:** revisión, retrospectiva y planeación el martes posterior al cierre del sprint; sesiones de trabajo los martes y viernes después de clase, de 7 a 9 de la noche, descritas en [`Docs/Entregas/Entrega-1/organigrama.md`](Docs/Entregas/Entrega-1/organigrama.md)
- **Roles Scrum y responsabilidades:** [`Docs/Entregas/Entrega-1/organigrama.md`](Docs/Entregas/Entrega-1/organigrama.md)

---

## Documentación

| Documento | Dónde |
|---|---|
| Especificación de requisitos (SRS) | [`Docs/SRS/`](Docs/SRS/) |
| Historias de usuario | [`Docs/Entregas/Entrega-1/historias-de-usuario.md`](Docs/Entregas/Entrega-1/historias-de-usuario.md) |
| Casos de uso | [`Docs/Entregas/Entrega-1/casos-de-uso.md`](Docs/Entregas/Entrega-1/casos-de-uso.md) |
| Los dos casos de uso más importantes, con sus diagramas y su código | [`Casos-de-uso-mas-importantes/`](Casos-de-uso-mas-importantes/) |
| Propuesta del producto (Canvas) | [`Docs/Entregas/Entrega-1/canvas.md`](Docs/Entregas/Entrega-1/canvas.md) |
| Modelo de características | [`Docs/Entregas/Entrega-1/feature-model.md`](Docs/Entregas/Entrega-1/feature-model.md) |
| Organigrama y roles | [`Docs/Entregas/Entrega-1/organigrama.md`](Docs/Entregas/Entrega-1/organigrama.md) |
| Calendario de actividades | [`Docs/Entregas/Entrega-1/calendario.md`](Docs/Entregas/Entrega-1/calendario.md) |
| Reporte gerencial — Entrega 1 | [`Docs/Entregas/Entrega-1/reporte-gerencial.md`](Docs/Entregas/Entrega-1/reporte-gerencial.md) |
| **Entrega 2: diseño de la solución (SDD)** | [`Docs/Entregas/Entrega-2/SDD.md`](Docs/Entregas/Entrega-2/SDD.md) |
| **Reporte gerencial — Entrega 2** | [`Docs/Entregas/Entrega-2/reporte-gerencial.md`](Docs/Entregas/Entrega-2/reporte-gerencial.md) |
| Estándares de programación | [`Docs/Entregas/Entrega-2/estandares-de-programacion.md`](Docs/Entregas/Entrega-2/estandares-de-programacion.md) |
| **Todos los diagramas (PNG)** | [`Docs/Diagramas/`](Docs/Diagramas/) |
| Taller de Diseño: explicación de los diagramas e informe | [`Docs/Entregas/Taller-de-Diseno/`](Docs/Entregas/Taller-de-Diseno/) |
| Manual de despliegue | [`Docs/UserGuide/despliegue.md`](Docs/UserGuide/despliegue.md) |
| Actas de reunión | [`Docs/Actas/`](Docs/Actas/) |
| Planeación de cada sprint | [`Docs/Planning/`](Docs/Planning/) |
| Revisión de cada sprint | [`Docs/Review/`](Docs/Review/) |
| Retrospectiva de cada sprint | [`Docs/Retrospective/`](Docs/Retrospective/) |
| Capturas de las pantallas | [`Docs/Mockups/`](Docs/Mockups/) |
| Informe técnico del sistema | [`Docs/Informes/informe-tecnico.pdf`](Docs/Informes/informe-tecnico.pdf) · [`.docx`](Docs/Informes/informe-tecnico.docx) |
| Acuerdo de uso académico | [`Docs/Informes/contrato-uso-academico.pdf`](Docs/Informes/contrato-uso-academico.pdf) |
| Diseño de la taquilla | [`Docs/Arquitectura/interfaz-taquilla.md`](Docs/Arquitectura/interfaz-taquilla.md) |
| Modelo entidad-relación | [`Database/modelo-entidad-relacion.md`](Database/modelo-entidad-relacion.md) |
| Gráficas de avance | [`Gráficas/avance.md`](Gráficas/avance.md) |
| Hoja de ruta y decisiones de arquitectura | [`Docs/Arquitectura/roadmap.md`](Docs/Arquitectura/roadmap.md) |
| Guía de uso por rol | [`Docs/UserGuide/`](Docs/UserGuide/) |
| Wiki del proyecto | [Wiki](../../wiki) |

---

## Contacto

**Equipo de desarrollo.** Los cuatro son estudiantes de cuarto semestre de
Ingeniería de Sistemas en la Pontificia Universidad Javeriana.

**Cristian Quevedo**
Estudiante de Ingeniería de Sistemas, cuarto semestre — Pontificia Universidad Javeriana
[quevedoecj@javeriana.edu.co](mailto:quevedoecj@javeriana.edu.co) · [@CristianQ8907E](https://github.com/CristianQ8907E)

**Sergio Alexander Lara Bonilla**
Estudiante de Ingeniería de Sistemas, cuarto semestre — Pontificia Universidad Javeriana
[sergioalexlb@gmail.com](mailto:sergioalexlb@gmail.com) · [@Alexander-hub-co](https://github.com/Alexander-hub-co)

**Santiago Arias**
Estudiante de Ingeniería de Sistemas, cuarto semestre — Pontificia Universidad Javeriana
[santiagoariast1@gmail.com](mailto:santiagoariast1@gmail.com) · [@IngSantiArias](https://github.com/IngSantiArias)

**Jacob Riveros**
Estudiante de Ingeniería de Sistemas, cuarto semestre — Pontificia Universidad Javeriana
[@JacobRiveros67](https://github.com/JacobRiveros67)

**Docente:** Ing. Kerwin de Jesús Barros Somerson — [@kbarrosDev](https://github.com/kbarrosDev)
