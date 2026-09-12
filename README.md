# Parquivo — Sistema de gestión para parqueaderos

**Fundamentos de Ingeniería de Software** · código 12946 · segundo semestre de 2026
Pontificia Universidad Javeriana — Bogotá

---

## Descripción

Un parqueadero cobra por tiempo, y ese cobro tiene que poder explicarse. Ésa es
la idea que gobierna el sistema: cada movimiento guarda copia de la tarifa y del
convenio que se le aplicaron, de modo que un cobro de hace un año puede
justificarse aunque la tarifa ya no exista.

Una sola instalación atiende a **varios establecimientos a la vez**, y cada uno
mantiene sus tarifas, horarios, turnos, convenios e historial completamente
separados de los demás.

El producto se organiza alrededor de una pantalla, la **taquilla**, donde un
operario pasa el día de pie con una fila delante. Todo lo demás —configurar
tarifas, declarar convenios, revisar reportes— se visita una vez al mes.

### Qué resuelve

- Entrada y salida de vehículos con **un solo campo**: se escribe la placa y el
  sistema decide si el vehículo entra o sale.
- Bicicletas mediante fichas numeradas, con los datos de quien la deja.
- Tarifas por minuto o por intervalos, **versionadas por fecha**.
- Convenios y descuentos configurables por establecimiento.
- Turnos, cuadre de caja e **historial inmutable**.
- Reportes por día, semana, mes y turno.

### Fuera del alcance

Pasarela de pagos en línea, facturación electrónica, reconocimiento automático
de placas por cámara y aplicación móvil nativa.

---

## Equipo del proyecto

| Integrante | Usuario de GitHub |
|---|---|
| Cristian Quevedo | [@CristianQ8907E](https://github.com/CristianQ8907E) |
| Sergio Alexander L. | [@Alexander-hub-co](https://github.com/Alexander-hub-co) |
| Jacob Riveros | [@JacobRiveros67](https://github.com/JacobRiveros67) |
| Santiago Arias | [@IngSantiArias](https://github.com/IngSantiArias) |

**Docente:** Ing. Kerwin de Jesús Barros Somerson — [@kbarrosDev](https://github.com/kbarrosDev)

---

## Tecnologías

| Capa | Herramienta | Por qué |
|---|---|---|
| Lenguaje | TypeScript | Los errores de tipo salen al compilar, no delante de un cliente |
| Interfaz | React 19 | Estándar de la industria |
| Servidor | Next.js 16 (App Router) | La página se arma en el servidor: llega dibujada y sin parpadeo |
| Base de datos | PostgreSQL | Aísla inquilinos de verdad, con seguridad a nivel de fila |
| Acceso a datos | Drizzle ORM | Consultas con tipos verificados, sin SQL suelto en cadenas |
| Autenticación | better-auth | Autenticación probada, sin criptografía propia |
| Pruebas | Vitest | Se ejecuta contra una base de datos real |

**Seis dependencias en total.** No se usa librería de componentes, de estilos ni
de gráficos: todo eso está escrito a medida.

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
bash Script/crear-roles.sh     # crea los tres roles de PostgreSQL
npm run migrar                 # aplica las migraciones

# 4. Levantar en desarrollo
npm run dev                    # http://localhost:3000
```

### Comprobar que todo funciona

```bash
npx tsc --noEmit     # verificación de tipos
npx eslint src       # análisis estático
npx vitest run       # suite de pruebas automatizadas
npm run build        # compilación para producción
```

---

## Estructura del proyecto

```
.
├── Docs/
│   ├── SRS/            Especificación de requisitos de software
│   ├── Entrega-1/      Canvas, modelo de características, casos de uso,
│   │                   historias de usuario, organigrama, calendario
│   ├── Arquitectura/   Decisiones de diseño y hoja de ruta
│   ├── Mockups/        Maquetas de las pantallas
│   ├── Dailys/         Reuniones diarias
│   ├── Planning/       Planeación de cada sprint
│   ├── Review/         Revisión al cerrar cada sprint
│   ├── Retrospective/  Retrospectiva de cada sprint
│   ├── Actas/          Actas de reunión
│   └── UserGuide/      Guía de uso e instalación
├── Database/           Esquema y diagrama entidad-relación
├── Script/             Scripts de instalación y mantenimiento
└── Gráficas/           Gráficos de avance y métricas
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
- **Ceremonias:** planeación, sincronización dos veces por semana, revisión y retrospectiva, descritas en [`Docs/Entrega-1/organigrama.md`](Docs/Entrega-1/organigrama.md)
- **Roles Scrum y responsabilidades:** [`Docs/Entrega-1/organigrama.md`](Docs/Entrega-1/organigrama.md)

---

## Documentación

| Documento | Dónde |
|---|---|
| Especificación de requisitos (SRS) | [`Docs/SRS/`](Docs/SRS/) |
| Historias de usuario | [`Docs/Entrega-1/historias-de-usuario.md`](Docs/Entrega-1/historias-de-usuario.md) |
| Casos de uso | [`Docs/Entrega-1/casos-de-uso.md`](Docs/Entrega-1/casos-de-uso.md) |
| Propuesta del producto (Canvas) | [`Docs/Entrega-1/canvas.md`](Docs/Entrega-1/canvas.md) |
| Modelo de características | [`Docs/Entrega-1/feature-model.md`](Docs/Entrega-1/feature-model.md) |
| Organigrama y roles | [`Docs/Entrega-1/organigrama.md`](Docs/Entrega-1/organigrama.md) |
| Calendario de actividades | [`Docs/Entrega-1/calendario.md`](Docs/Entrega-1/calendario.md) |
| Reporte gerencial | [`Docs/Entrega-1/reporte-gerencial.md`](Docs/Entrega-1/reporte-gerencial.md) |
| Hoja de ruta y decisiones de arquitectura | [`Docs/Arquitectura/roadmap.md`](Docs/Arquitectura/roadmap.md) |
| Guía de uso por rol | [`Docs/UserGuide/`](Docs/UserGuide/) |
| Wiki del proyecto | [Wiki](../../wiki) |

---

## Contacto

**Cristian Quevedo** — cristianq8907e@gmail.com
