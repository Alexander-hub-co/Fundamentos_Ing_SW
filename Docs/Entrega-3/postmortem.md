# Informe de postmortem

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2
**Fecha:** 20 de noviembre de 2026
**Periodo analizado:** 17 de agosto al 20 de noviembre de 2026 (seis sprints)
**Equipo:** Cristian Quevedo (Product Owner), Sergio Alexander Lara Bonilla (Scrum Master · Configuration Manager), Santiago Arias (Sprint Planner · QA Lead), Jacob Riveros (DevOps Engineer)

Este informe mira el proyecto completo en retrospectiva. No busca culpables,
sino entender qué decisiones dieron resultado, cuáles no, por qué, y qué
haríamos distinto en el próximo proyecto.

---

## 1. Qué nos propusimos y qué logramos

**El objetivo:** una aplicación web que reemplace la libreta y la calculadora en
parqueaderos pequeños, de modo que todo el dinero que entra quede registrado,
atribuido a alguien y explicable, y que una sola instalación atienda a varios
establecimientos con sus datos separados.

| Dimensión | Lo planeado | Lo logrado |
|---|---|---|
| Alcance | 122 puntos en seis sprints | 108 puntos (89 %) |
| Cumplimiento por sprint | 100 % en cada sprint | 100 % en los sprints 1 a 4; 69 % en el 5 y 33 % en el 6 |
| Entregas | Tres, en fecha | Entregas 1 y 2 en fecha; la final con el despliegue 12 días tarde respecto al Sprint 6 |
| Calidad | Reglas de cobro probadas | 727 de 729 pruebas automatizadas aprobadas; 14 casos de prueba con 10 aprobados y 4 defectos registrados; SonarQube de 10 hallazgos a 0 |
| Puesta en marcha | Aplicación disponible de forma remota | Desplegada en <https://parquivo.vercel.app> con el aislamiento verificado en la base real |
| Backlog completo | 39 historias adicionales en el documento de historias | Quedaron en el milestone Backlog, sin sprint (228 puntos) |

El núcleo del producto —el ciclo de un vehículo con su cobro explicado, las
tarifas versionadas, los convenios, los turnos y las bicicletas con fichas—
quedó construido y probado. Lo que no se alcanzó está en la periferia: la
búsqueda del historial para el propietario, parte del manual de usuario y las
pruebas de acceso remoto.

---

## 2. Línea de tiempo

| Fecha | Hito |
|---|---|
| 17 de agosto | Inicio del Sprint 1: planeación y especificación |
| 25 de agosto | Acta 001: se formalizan roles, cadencia (martes y viernes) y marco Scrum |
| 1 de septiembre | Cierre del Sprint 1 (18/18 puntos). Se decide partir toda historia hasta que quepa en un sprint |
| 15 de septiembre | Cierre del Sprint 2 (21/21): plataforma, autenticación y aislamiento por filas |
| 22 de septiembre | **Entrega 1:** planeación ágil, historias, estimación y reporte gerencial |
| 29 de septiembre | Cierre del Sprint 3 (24/24): taquilla de entrada. Se detecta que el tablero no refleja el avance |
| 13 de octubre | Cierre del Sprint 4 (24/24): salida y cobro. Se exige integración continua en verde para fusionar |
| 22 de octubre | Retrospectiva Starfish del Sprint 5: 52 aportes, 19 ideas |
| 23 de octubre | **Entrega 2:** SDD, diagramas, primer prototipo (HU-008) y reporte gerencial. Última acta registrada |
| 8 de noviembre | Análisis con SonarQube: de 10 hallazgos a 0 (PR #174, sin fusionar) |
| 10 de noviembre | Registro de deuda técnica: 5 elementos, 63 horas de principal |
| 17 de noviembre | Plan de pruebas en Azure DevOps: 14 casos ejecutados, 4 bugs registrados |
| 20 de noviembre | Despliegue en producción en Vercel con PostgreSQL en Neon |

---

## 3. Métricas del proceso

| Sprint | Comprometido | Entregado | Velocidad acumulada media |
|---|:---:|:---:|:---:|
| 1 | 18 | 18 | 18 |
| 2 | 21 | 21 | 19,5 |
| 3 | 24 | 24 | 21 |
| 4 | 24 | 24 | 21,75 |
| 5 | 26 | 18 | 21 |
| 6 | 9 | 3 | 18 |

- **Precisión de la estimación:** en los sprints 1 a 4 la desviación fue de 0 %.
  Estimar entre los cuatro, desde el Sprint 3, dio compromisos realistas.
- **Registro:** 18 actas entre el 25 de agosto y el 23 de octubre; ninguna después.
- **Integración:** 35 *pull requests* fusionados; 72 *issues* cerrados.

La curva de velocidad cuenta la historia del proyecto: subió y se estabilizó
mientras hubo cadencia, y cayó cuando el trabajo dejó de pasar por el tablero.

---

## 4. Qué salió bien

1. **Especificar antes de construir.** Dedicar el Sprint 1 entero a la
   especificación evitó discutir el alcance a mitad de la construcción. Las
   especificaciones por funcionalidad, con sus requisitos numerados, después
   sirvieron de base directa para diseñar los casos de prueba.
2. **Decisiones de arquitectura argumentadas.** El aislamiento entre
   establecimientos con seguridad a nivel de fila y tres roles de base se eligió
   comparando alternativas y se escribió el porqué. Esa decisión obligó a buscar
   un proveedor que permitiera crear roles con `BYPASSRLS`, y se verificó antes
   de desplegar en lugar de descubrirlo en producción.
3. **Estimar entre los cuatro con un plan de recorte.** Dos sprints seguidos con
   24 de 24 puntos, y cuando el Sprint 5 no alcanzó, la historia que quedó afuera
   (#8) fue justamente la que se había marcado para recortar.
4. **Pruebas automatizadas desde temprano.** Las reglas de cobro tuvieron prueba
   desde los sprints 3 y 4. Al final, los diez casos de prueba se pudieron
   automatizar sin reescribir nada del dominio.
5. **Probar sobre una base nueva antes de cada cierre.** Encontró tres fallas
   en el Sprint 4 que en la demostración habrían sido evidentes.
6. **La actitud del grupo**, que la Starfish señaló como lo que había que seguir
   haciendo.

---

## 5. Qué salió mal

1. **El tablero nunca reflejó bien el avance.** Pasó en el Sprint 3, se acordó
   una solución (`Closes #N`) que no se cumplió en el Sprint 4, y desde el 23 de
   octubre no se registra ningún cierre. Es el problema que más se repitió en el
   proyecto.
2. **El trabajo se concentró alrededor de las entregas.** La Starfish lo dijo con
   todas las letras: «trabajar sin esperar a que llegue una entrega» y «dejar de
   procrastinar». Después de la Entrega 2 la cadencia de reuniones se perdió y
   no hay actas.
3. **El repositorio fue difícil de seguir.** Diagramas en cuatro carpetas, dos
   diagramas de clases que no coincidían, archivos subidos directo a `main` y
   52 hallazgos de retrospectiva cargados como *issues*. «Cuidar la presentación
   del GitHub» fue la idea más votada de la Starfish (11 veces).
4. **La especificación y el código se separaron en dos puntos.** La ficha de un
   tiquete perdido y la validación de placas siguen una decisión de diseño que
   la especificación nunca recogió. Las pruebas lo encontraron (bugs 215 y 216).
5. **Lo operativo quedó para el final.** El despliegue, las pruebas de acceso
   remoto y el manual de usuario estaban en el último sprint, que fue el que
   menos se cumplió.
6. **Carga desigual en algunos momentos.** «Dejarle todo a un solo integrante»
   apareció tres veces en la Starfish.

---

## 6. Causas raíz

| Síntoma | Causa raíz |
|---|---|
| Tablero desactualizado | Actualizarlo dependía de que cada persona se acordara. Ninguna acción lo hizo automático ni lo volvió parte de la definición de terminado |
| Trabajo concentrado en las entregas | La cadencia se sostenía con reuniones fijas; cuando las reuniones se dejaron después de la Entrega 2, no había otro mecanismo que marcara el ritmo |
| Repositorio desordenado | No había una convención escrita de carpetas y ramas desde el inicio; cada uno subió su parte donde le pareció |
| Especificación desactualizada | Cuando el código tomó otra decisión de diseño, no había un paso que obligara a volver a la especificación |
| Lo operativo al final | El plan ordenó el trabajo por valor de negocio y dejó el despliegue como tarea de documentación, cuando también era un riesgo técnico |

---

## 7. Lecciones aprendidas

1. **Lo que depende de la memoria no se cumple.** Las acciones que funcionaron
   fueron las que cambiaron una regla (integración continua obligatoria,
   reuniones fijas). Las que dependían de acordarse (mover tarjetas, publicar
   actas) fallaron una y otra vez.
2. **Desplegar temprano reduce el riesgo.** El requisito de roles de la base se
   habría descubierto semanas antes con un despliegue de prueba en el Sprint 2.
3. **La especificación es la fuente de verdad solo si se mantiene.** Cada vez
   que el código decide distinto, hay que actualizar la especificación en el
   mismo cambio.
4. **Probar contra requisitos encuentra lo que la revisión no ve.** Los cuatro
   defectos aparecieron al diseñar casos contra los requisitos, no al revisar
   código.
5. **La cadencia es lo que sostiene el proceso.** Sin reuniones ni actas, el
   proceso Scrum se desarmó aunque el producto siguió avanzando.

---

## 8. Qué haríamos distinto

| Práctica | Cómo |
|---|---|
| Definición de terminado con el tablero adentro | Una historia no está terminada hasta que su *pull request* la cierra con `Closes #N`; la revisión del *pull request* lo verifica |
| Desplegar desde el segundo sprint | Un entorno de prueba en la nube desde el Sprint 2, aunque la aplicación haga poco |
| Convención de repositorio el primer día | Carpetas, ramas y mensajes de *commit* escritos en el README antes del primer *commit* |
| Especificación y código en el mismo cambio | Si un *pull request* cambia una regla, también cambia la especificación |
| Cadencia hasta el final | Las reuniones de martes y viernes siguen hasta la sustentación, con acta |
| Pruebas contra requisitos en cada sprint | Diseñar y ejecutar casos de prueba al cerrar cada sprint, no solo al final |

---

## 9. Evaluación de las herramientas

| Herramienta | Uso | Valoración |
|---|---|---|
| GitHub (repositorio, *issues*, *projects*) | Código, tablero y revisión | Bien para el código y la revisión; el tablero se usó de forma irregular |
| GitHub Actions | Integración continua con PostgreSQL real | Muy útil una vez que se exigió en verde para fusionar |
| Spec Kit | Especificaciones por funcionalidad | Dio especificaciones claras y requisitos numerados que sirvieron para probar |
| Next.js, TypeScript, Drizzle, PostgreSQL | Construcción | Adecuados; la seguridad por filas cumplió su objetivo |
| Vitest | Pruebas automatizadas | Rápido y suficiente; la suite necesita estabilizar la limpieza entre archivos |
| Azure DevOps Test Plans | Plan y ejecución de pruebas | Ordenó los casos, los resultados y los bugs en un solo lugar |
| SonarQube | Análisis estático | Encontró dos fallas de fiabilidad alta que las pruebas no habían visto |
| Vercel y Neon | Producción | Despliegue rápido; Neon cumplió el requisito de roles |

---

## 10. Conclusión

Parquivo cumplió su objetivo central: el sistema registra, atribuye y explica
cada cobro, separa los datos de cada establecimiento y está disponible en
producción. El proceso funcionó bien mientras tuvo cadencia —cuatro sprints
seguidos al 100 %— y se debilitó al final, cuando el trabajo siguió pero dejó de
registrarse. La principal lección para el próximo proyecto es convertir en
reglas lo que hoy depende de la memoria del equipo.
