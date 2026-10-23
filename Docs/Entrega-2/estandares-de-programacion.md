# Estándares de programación

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

Reglas que sigue todo el código del repositorio. Las que se pueden comprobar
automáticamente las verifica la integración continua en cada *pull request*
([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).

---

## 1. Lenguaje y verificación

| Regla | Cómo se comprueba |
|---|---|
| Todo el código es **TypeScript en modo estricto** (`"strict": true`) | `npm run typecheck` |
| Sin errores de análisis estático con la configuración de Next.js para TypeScript y Core Web Vitals | `npm run lint` |
| Formato uniforme con Prettier: punto y coma, comillas dobles, coma final y líneas de hasta 88 caracteres | `npm run format` |
| Toda regla de negocio tiene prueba automatizada | `npm test` (Vitest) |

## 2. Nombres

- **En español**, como el dominio del negocio: `registrarEntrada`,
  `tarifaVigenteEn`, `Movimiento`. Un operario dice «placa» y «convenio», y el
  código usa las mismas palabras.
- **Funciones con verbo** (`calcularImporte`, `resolverPlaca`) y **tipos con
  sustantivo en singular** (`Tarifa`, `Cobro`).
- **Constantes en mayúsculas** cuando son valores fijos del dominio:
  `MINUTOS_PRIMERA_HORA`, `REDONDEO_INICIAL`.
- **Archivos en minúsculas con guiones**: `campo-placa.tsx`, `sesion-turno.ts`.
- En la base de datos, **tablas y columnas en `snake_case`** (`salida_en`,
  `tipo_vehiculo_id`); en TypeScript, `camelCase` (`salidaEn`).

## 3. Organización del código

| Carpeta | Qué va ahí | Qué NO va ahí |
|---|---|---|
| `src/app/` | Pantallas (vista) y *Server Actions* (controlador) | Reglas de negocio ni SQL |
| `src/dominio/` | Reglas de negocio, una carpeta por concepto (`taquilla`, `tarifas`, `convenios`…) | Componentes de interfaz |
| `src/db/` | Esquema, migraciones y acceso a datos | Lógica de negocio |
| `src/lib/` | Servicios transversales: sesión, autorización, entorno | — |
| `tests/` | Pruebas unitarias y de integración | — |

- Toda consulta de un establecimiento pasa por `conAmbito()`. Nunca se abre una
  conexión directa.
- Toda operación protegida empieza con `exigir(contexto, "operación")`.
- El dinero se representa en **pesos enteros** (`integer`), nunca en punto
  flotante.

## 4. Comentarios y documentación del código

- Se comenta el **porqué**, no el qué. El nombre de la función ya dice qué hace;
  el comentario explica la decisión que no es obvia.
- Cada módulo de dominio abre con un bloque que explica su responsabilidad y las
  decisiones que tomó.
- Las restricciones de la base de datos llevan comentario con la regla de
  negocio que protegen.

## 5. Manejo de errores

- Los errores de negocio son clases propias (`TaquillaInvalida`, `SinTarifa`,
  `TarifaInvalida`) con mensajes que el operario puede entender.
- La validación en el código existe para dar un buen mensaje; la garantía real
  la dan las restricciones `CHECK` y los índices únicos de la base.

## 6. Control de versiones

| Regla | Detalle |
|---|---|
| Ramas | `main` estable · `develop` integración · `feature/…`, `fix/…` o `docs/…` por cambio |
| Integración | Siempre por *pull request* hacia `develop`, con revisión. Nunca commit directo a `main` ni a `develop` |
| Mensajes de commit | Formato *Conventional Commits* en español: `feat(taquilla): …`, `fix(db): …`, `docs(diagramas): …` |
| Vínculo con el tablero | Cada commit referencia su *issue* (`Refs #N`) y el *pull request* lo cierra (`Closes #N`) |
