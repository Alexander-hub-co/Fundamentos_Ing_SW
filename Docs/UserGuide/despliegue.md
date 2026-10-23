# Despliegue

Parquivo se despliega como una sola aplicación sobre plataforma gestionada, con
PostgreSQL gestionado al lado. El diseño no depende de cuál sea la plataforma;
sólo exige dos cosas: PostgreSQL 16 o superior, y **permiso para crear roles**.

Ese segundo requisito no es negociable. Si un proveedor no deja crear roles con
`BYPASSRLS`, no sirve: el aislamiento del producto se apoya en tener tres roles
con privilegios distintos, y sin ellos habría que degradar el Principio I.

## Lo que hay que verificar antes de elegir proveedor

| Requisito | Por qué |
|---|---|
| PostgreSQL 16+ | Row-Level Security con `FORCE` |
| Crear roles y otorgar `BYPASSRLS` | Los tres roles del diseño |
| Agrupador en **modo transacción**, si lo hay | El ámbito se fija con `SET LOCAL` dentro de una transacción. El modo sesión rompería el aislamiento de forma intermitente |

Sobre lo tercero conviene ser explícito: nuestro diseño es compatible con el
modo transacción precisamente porque nunca fija variables fuera de una
transacción. Un diseño que lo hiciera fallaría de forma esporádica y casi
imposible de diagnosticar.

## Variables de entorno en producción

Las mismas cinco que en desarrollo. La diferencia está en los valores:

```
DATABASE_URL_MIGRATOR=...   rol dueño del esquema
DATABASE_URL_PLATFORM=...   rol con BYPASSRLS
DATABASE_URL_TENANT=...     rol sin BYPASSRLS ni propiedad
AUTH_SECRET=...             openssl rand -base64 32
APP_URL=https://…           el dominio real, no localhost
```

**`AUTH_SECRET` debe ser distinto del de desarrollo.** Si se reutiliza, cualquiera
con acceso al repositorio de desarrollo podría falsificar sesiones de producción.

**`APP_URL` debe apuntar al dominio real.** Sin ese valor el origen se deduce de
la petición entrante, y los redireccionamientos pueden terminar donde no
corresponde.

## Migraciones en el arranque

`npm run db:migrate` aplica, en este orden y sólo en este orden:

1. Los roles, con las contraseñas leídas del entorno.
2. Las migraciones de Drizzle, que crean tablas y políticas.
3. El blindaje: permisos, `FORCE ROW LEVEL SECURITY`, el disparador de
   inmutabilidad del código y la guardia contra tablas de tenencia sin política.
4. Los índices.

El orden importa: el paso 3 opera sobre tablas que crea el paso 2, y el paso 2
otorga permisos a roles que crea el paso 1.

Conviene ejecutarlo como paso previo al arranque, no dentro del proceso de la
aplicación: si falla, se quiere que falle el despliegue, no que la aplicación
levante contra un esquema a medias.

## Primera puesta en marcha

```bash
npm run db:migrate
npm run db:semilla -- correo@real.com "Nombre" "contraseña-fuerte"
```

La semilla sólo crea la primera cuenta. Si ya existe un administrador general,
se niega — así no se puede crear un segundo por accidente.

Después de entrar por primera vez, conviene cambiar esa contraseña desde la
propia aplicación.

## Comprobaciones posteriores al despliegue

Antes de dar por bueno un despliegue, correr las verificaciones del
[quickstart](../../specs/001-gestion-parqueaderos/quickstart.md) contra el entorno
real. Las cinco primeras —V1 a V5— son las que no se pueden omitir: verifican
que el aislamiento está activo en esa base concreta, con esos roles concretos.

Un error de configuración de roles no lo detecta ninguna prueba de integración
continua, porque allí los roles son otros.

## Copias de seguridad

El Principio IV dice que el historial no se destruye. Eso incluye el caso de que
lo destruya un accidente:

- Copias automáticas diarias, como mínimo.
- Probar una restauración antes de tener el primer cliente real. Una copia que
  nunca se restauró es una suposición, no una copia.

## Qué NO hace falta

- **Servicio de correo.** Parquivo no envía correo: no hay invitaciones, ni
  notificaciones, ni recuperación de contraseña autogestionada. Es una decisión
  deliberada, tomada en clarificación.
- **Pasarela de pagos.** El cobro a los parqueaderos ocurre fuera del sistema.
- **Almacenamiento de archivos.** Todavía no hay carga de imágenes ni documentos.
