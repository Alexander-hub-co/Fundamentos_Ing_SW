# Diagrama de Componentes

> Historia principal: **HU-008 (#31)**

![Diagrama de Componentes](img/diagrama-componentes.png)

## ¿Qué muestra?

Parquivo es **una sola aplicación Next.js** organizada en 7 componentes por capas. Además hay dos elementos externos: el **navegador web** y **PostgreSQL**. Las flechas punteadas son dependencias de uso.

| Componente | Responsabilidad |
|---|---|
| Pantallas (`page.tsx`) | Páginas que el servidor genera: taquilla, panel de salida, configuración. |
| Formularios cliente (`use client`) | Partes interactivas, como el campo de placa. |
| Acciones del servidor (`acciones.ts`) | Punto de entrada de toda operación (Server Actions). |
| Autenticación (`better-auth`) | Inicio de sesión y sesión del usuario. |
| Autorización | Verifica que el rol permita la operación (`exigir()`). |
| Dominio | Reglas de negocio: taquilla, tarifas, cobro, turnos. |
| Acceso a datos (Drizzle + `ambito.ts`) | Consultas limitadas al parqueadero de la sesión. |

## Flujo

1. El navegador pide las páginas por **HTTP**.
2. Los formularios envían la placa a las acciones del servidor con una **Server Action (POST)**.
3. Las acciones obtienen la **sesión** y llaman al **Dominio**.
4. El Dominio verifica permisos (`exigir()`) y lee o guarda a través de **Acceso a datos**.
5. Acceso a datos consulta **PostgreSQL** por **SQL**.

Las dependencias siempre van hacia abajo, y **solo Acceso a datos habla con la base**. Ahí `ambito.ts` fija el parqueadero antes de cada consulta, para que la seguridad por filas (RLS) aísle los datos de cada establecimiento.
