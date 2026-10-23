# Diagrama de Despliegue

> Historia principal: **HU-008 (#31)**

![Diagrama de Despliegue](despliegue.png)

## ¿Qué muestra?

Dónde corre cada parte del sistema: **5 nodos físicos** y cómo se comunican entre sí.

| Nodo «device» | Qué contiene |
|---|---|
| PC de la caja | Navegador web (Chrome) con la interfaz de taquilla |
| Impresora térmica | Imprime tiquetes y comprobantes |
| Celular / tablet (admin) | Navegador para configurar tarifas, convenios y turnos |
| Servidor de aplicación | Node.js ejecutando el artefacto `parquivo` (Next.js) |
| Servidor de BD | PostgreSQL 16 |

## Comunicación

| Desde → Hacia | Protocolo |
|---|---|
| PC de la caja → Servidor de aplicación | HTTPS |
| Celular / tablet → Servidor de aplicación | HTTPS |
| Servidor de aplicación → Servidor de BD | TCP/IP `:5432` |
| PC de la caja → Impresora térmica | USB |

## A tener en cuenta

- La impresora está conectada por **USB a la PC de la caja**, no al servidor. Por eso el comprobante se imprime desde el navegador.
- El servidor de BD necesita **permiso para crear roles**: el aislamiento por parqueadero usa `app_migrator`, `app_platform` y `app_tenant`.
- Requisitos: Node.js 20.9 o superior, PostgreSQL 16 o superior y certificado TLS para el dominio.
