# Reporte gerencial — Entrega Final

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2
**Corte:** 20 de noviembre de 2026
**Periodo que cubre:** cierre del Sprint 5, Sprint 6 y preparación de la Entrega Final (24 de octubre al 20 de noviembre de 2026)

---

## 1. Resumen ejecutivo

Parquivo llega a la Entrega Final **desplegado en producción** en
<https://parquivo.vercel.app>, sobre Vercel y una base PostgreSQL gestionada
(Neon), con el aislamiento entre establecimientos verificado en esa base real.

Del alcance planificado de 122 puntos se entregaron **119 (98 %)**. Los cuatro
primeros sprints cumplieron el 100 % dentro de su fecha. Los sprints 5 y 6 se
completaron después de su fecha: #8 y #13 se terminaron el 20 de noviembre, y de
#12 solo falta la prueba desde datos móviles.

La calidad se midió con tres fuentes independientes: un plan de pruebas en
Azure DevOps con **14 casos (10 aprobados, 4 fallidos con su bug)**, la suite
automatizada del proyecto (**727 de 729 pruebas aprobadas**) y un análisis con
SonarQube que bajó los hallazgos **de 10 a 0**.

El problema principal del periodo fue de gestión, no de construcción: **el
tablero de GitHub no registró ningún cierre entre el 23 de octubre y el 20 de
noviembre**, aunque en ese tiempo se hizo el plan de pruebas, el análisis de
calidad, el registro de deuda técnica y el despliegue. Se corrigió el 20 de
noviembre; la sección 6 lo detalla.

---

## 2. Indicadores

| Indicador | Entrega 1 (22 sep) | Entrega 2 (23 oct) | Entrega Final (20 nov) |
|---|:---:|:---:|:---:|
| Sprints cerrados en el tablero | 2 | 4 | **5** |
| Puntos entregados (con evidencia) | 39 | 105 | **119** |
| Puntos que quedan del plan | 83 | 17 | **3** |
| Avance del plan (puntos) | 32 % | 86 % | **98 %** |
| *Issues* cerrados en el tablero | 18 | 42 | **133** |
| *Pull requests* fusionados | 18 | 25 | **35** |
| Casos de prueba ejecutados (Azure) | — | — | **14** (10 aprobados · 4 fallidos) |
| Pruebas automatizadas aprobadas | — | — | **727 / 729** |
| Hallazgos de SonarQube | — | — | **10 → 0** (fiabilidad D → A) |
| Elementos de deuda técnica registrados | — | — | **5** (63 h de principal) |
| Aplicación desplegada | No | No | **Sí** · parquivo.vercel.app |

Los 35 *pull requests* incluyen los diez que se fusionaron el mismo 23 de
octubre, después del corte de la Entrega 2.

---

## 3. Valores estimados frente a reales

### 3.1 Puntos por sprint

| Sprint | Periodo | Comprometido | Entregado | Desviación |
|---|---|:---:|:---:|:---:|
| Sprint 1 | 17 al 31 de agosto | 18 | 18 | 0 % |
| Sprint 2 | 1 al 14 de septiembre | 21 | 21 | 0 % |
| Sprint 3 | 15 al 28 de septiembre | 24 | 24 | 0 % |
| Sprint 4 | 29 de septiembre al 12 de octubre | 24 | 24 | 0 % |
| Sprint 5 | 13 al 26 de octubre | 26 | 26 | 0 % (8 puntos fuera de fecha) |
| Sprint 6 | 27 de octubre al 8 de noviembre | 9 | 6 | −33 % (todo fuera de fecha) |
| **Total** | | **122** | **119** | **−2 %** |

La desviación se concentra al final y es sobre todo de fechas. En el Sprint 5,
#8 (consulta y supervisión remota, 8 puntos), que era la historia prevista para
recortar, se terminó el 20 de noviembre con la búsqueda del historial por placa y
por fecha. Del Sprint 6, #6 y #13 se terminaron el mismo día, y #12 quedó
ejecutada desde wifi, con la prueba en datos móviles pendiente.

### 3.2 Fechas: plan frente a lo real

| Hito | Fecha planeada | Fecha real | Diferencia |
|---|---|---|---|
| Entrega 1 | 22 de septiembre | 22 de septiembre | 0 días |
| Entrega 2 | 23 de octubre | 23 de octubre | 0 días |
| Cierre del Sprint 5 | 26 de octubre | 20 de noviembre | 25 días de atraso |
| Cierre del Sprint 6 | 8 de noviembre | Abierto: falta la prueba de #12 en datos móviles | — |
| Análisis de calidad (SonarQube) | — | 8 de noviembre (PR #174) | — |
| Registro de deuda técnica | — | 10 de noviembre | — |
| Plan y ejecución de pruebas | — | 17 de noviembre | — |
| Despliegue en producción | Sprint 6 (8 de noviembre) | 20 de noviembre | 12 días de atraso |
| Entrega Final (*milestone*) | 16 de noviembre | Sustentación en las semanas 17-18 | — |

### 3.3 Esfuerzo de la deuda técnica

El registro de deuda técnica estima **63 horas** para saldar los cinco elementos
identificados (16 h, 12 h, 24 h, 8 h y 3 h). Ninguno se ha saldado todavía; el
más barato —cerrar en el tablero las historias ya construidas, 3 h— es también
el problema de gestión que describe la sección 6.

---

## 4. Estado de las tareas

### 4.1 Historias pendientes del plan

| Sprint | Historia | Puntos | Responsable | En el tablero | Estado real |
|---|---|:---:|---|---|---|
| 5 | #8 · Consulta y supervisión remota | 8 | Cristian Quevedo | Cerrada | ✅ Terminada el 20 de noviembre: ocupación en tiempo real y búsqueda del historial por placa y por fecha, con aviso de «Sin resultados» |
| 6 | #6 · Documentar despliegue en producción | 3 | Jacob Riveros | Cerrada | ✅ Terminada: manual de despliegue y aplicación desplegada el 20 de noviembre |
| 6 | #13 · Manual de usuario para empleados | 3 | Santiago Arias | Cerrada | ✅ Terminada el 20 de noviembre: la guía del operario incluye la comparación con el sistema anterior en Access |
| 6 | #12 · Pruebas de acceso remoto y disponibilidad | 3 | Jacob Riveros | Abierta | 🔄 Ejecutada desde wifi el 20 de noviembre ([resultados](pruebas-acceso-remoto.md)); falta la prueba desde datos móviles |

### 4.2 Pruebas (Entrega Final)

| Elemento | Resultado | Dónde |
|---|---|---|
| Plan de pruebas en Azure DevOps | 14 casos: CP-01 a CP-10 aprobados, CP-11 a CP-14 fallidos | Test Plan 146 · ejecuciones 1000013 y 1000014 |
| Defectos abiertos | 4 bugs (214 a 217), uno por cada caso fallido | Azure DevOps · Boards |
| Pruebas automatizadas de los casos | 17 pruebas de CP-01 a CP-10, todas aprobadas | `tests/integracion/casos-de-prueba.test.ts` |
| Suite completa del proyecto | 727 de 729 aprobadas; las 2 fallas son intermitentes y ajenas a los casos | Informe de casos de prueba |
| Informe de casos de prueba | 31 páginas, formato APA, con evidencia por caso | [informe-casos-de-prueba.pdf](informe-casos-de-prueba.pdf) |

Responsables de los casos: Sergio Lara (CP-01, 05, 09, 11), Cristian Quevedo
(CP-02, 06, 10, 12), Santiago Arias (CP-03, 07, 13) y Jacob Riveros (CP-04, 08, 14).

### 4.3 Defectos abiertos

| Bug | Caso | Defecto | Severidad | Decisión pendiente |
|---|---|---|---|---|
| 214 | CP-11 | El formulario de tarifas cambia de modelo y borra lo escrito tras un error | Alta | Corregir el formulario |
| 215 | CP-12 | Con tiquete perdido, la ficha vuelve a estar disponible (spec 005, FR-019) | Alta | Corregir el código o actualizar la especificación |
| 216 | CP-13 | Una placa sin dígitos (ABCDE) se acepta como moto (spec 004, FR-004) | Alta | Corregir el código o actualizar la especificación |
| 217 | CP-14 | El mensaje de cobro de una bicicleta dice «El vehículo salió» | Media | Corregir el texto |

---

## 5. Entregables de la Entrega Final

| Lo que pide la entrega | Dónde está |
|---|---|
| Prototipo final | <https://parquivo.vercel.app> · código en el repositorio |
| Reporte de pruebas | [informe-casos-de-prueba.pdf](informe-casos-de-prueba.pdf) · [casos-de-prueba.docx](casos-de-prueba.docx) · Test Plan 146 en Azure DevOps |
| Repositorio de código actualizado | `Alexander-hub-co/Fundamentos_Ing_SW` (rama `main`) |
| Informe de postmortem | [postmortem.md](postmortem.md) |
| Reporte gerencial | Este documento |
| Manuales de instalación, administración y ejecución | README · [despliegue](../UserGuide/despliegue.md) · guías del administrador y del operario |
| Evidencias del trabajo | 18 actas, *dailys*, planeaciones, revisiones y retrospectivas en `Docs/` |

---

## 6. Problemas y soluciones

| # | Problema | Impacto | Causa | Solución |
|---|---|---|---|---|
| 1 | El tablero no registró ningún cierre entre el 23 de octubre y el 20 de noviembre | Alto: quien mirara el tablero creía que el proyecto se había detenido | Después de la Entrega 2 el trabajo se movió a otras herramientas (Azure, SonarQube, Vercel) y nadie volvió al tablero; la acción de la Starfish «cerrar una tarjeta por semana» no se cumplió | Se actualizó el 20 de noviembre: 40 historias cerradas como completadas tras verificarlas en el código, #8 y #13 terminadas, y los 19 aportes de la retrospectiva cerrados como no planificados porque no eran tareas |
| 2 | El despliegue se hizo 12 días después de lo planeado | Medio: las pruebas de acceso remoto (#12) se corrieron recién el 20 de noviembre | Faltaba una base que permitiera crear roles con `BYPASSRLS`, requisito del aislamiento | Se eligió Neon tras verificar ese permiso antes de migrar; el aislamiento se comprobó sobre la base real |
| 3 | El *pull request* de SonarQube (#174) sigue sin fusionar desde el 8 de noviembre | Medio: las correcciones de fiabilidad no están en `main` | Nadie lo revisó después de abrirlo | Revisarlo y fusionarlo antes de la sustentación |
| 4 | Las pruebas encontraron 4 defectos, dos de ellos discrepancias entre el código y la especificación | Medio | La especificación de bicicletas y la de placas no se actualizaron cuando el código tomó otra decisión de diseño | Quedan registrados como bugs; el equipo decide en cada caso si corrige el código o la especificación |
| 5 | La suite completa tiene fallas intermitentes (2 en la última corrida, 14 en una anterior) | Bajo: una falla intermitente puede tapar una real | Las pruebas comparten base y dependen del orden y del tiempo de ejecución | Registrado como deuda; estabilizar la limpieza entre archivos de prueba |
| 6 | Al registrar las ejecuciones en Azure quedaron 4 casos y una ejecución duplicados | Bajo | Un corte de conexión hizo que el registro se ejecutara dos veces | Se sacaron del plan, se marcaron «[DUPLICADO]» y se cerraron |

---

## 7. Riesgos para la sustentación

| Riesgo | Impacto | Probabilidad | Qué se hace |
|---|---|---|---|
| Falla de internet durante la demostración | Alto | Baja | Llevar también la aplicación corriendo en local |
| Que se pregunte por los defectos abiertos | Medio | Alta | Presentarlos como resultado de las pruebas, con su decisión pendiente |
| El tablero desactualizado contradiga el avance presentado | Medio | Baja | Se actualizó el 20 de noviembre (problema 1) |
| La base de producción quede sin datos de demostración | Medio | Media | Crear el administrador y un establecimiento de prueba antes de sustentar |

---

## 8. Reparto de la carga

| Integrante | Rol | Puntos del plan (S1–S6) | Casos de prueba | Pendientes a su cargo |
|---|---|:---:|:---:|---|
| Sergio Alexander L. | Scrum Master · Configuration Manager | 34 | 4 | — |
| Cristian Quevedo | Product Owner | 32 | 4 | — |
| Jacob Riveros | DevOps Engineer | 32 | 3 | #12 (datos móviles) |
| Santiago Arias | Sprint Planner · QA Lead | 24 | 3 | — |

Los puntos son los del reparto de la Entrega 2, que ya incluía las historias del
Sprint 6 y suma los 122 puntos del plan.

---

## 9. Próximos pasos

1. Probar #12 desde datos móviles, cerrarla y cerrar el milestone del Sprint 6.
2. Revisar y fusionar el *pull request* #174 (SonarQube).
3. Decidir, para los bugs 215 y 216, si se corrige el código o la especificación; corregir 214 y 217.
4. Fusionar los *pull requests* de la entrega final (#175) y de la búsqueda del historial.
5. Preparar los datos de demostración en producción y ensayar la sustentación de 30 minutos.
