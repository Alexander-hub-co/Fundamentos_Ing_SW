# Planeación del Sprint 1

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 1 · Planeación y especificación |
| **Periodo** | 17 al 31 de agosto de 2026 |
| **Planeación** | Lunes 17 de agosto de 2026 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |

Esta planeación es anterior a la cadencia fija de martes y viernes, que el
equipo adoptó el 25 de agosto y quedó registrada en el
[acta 001](../Actas/ACTA-001-2026-08-25.md). Por eso no tiene acta propia: los
acuerdos que aquí constan se ratificaron en esa primera reunión formal, y la
[retrospectiva del Sprint 1](../Retrospective/sprint-1-retrospectiva.md) señala
justamente la falta de registro escrito como uno de los puntos a corregir.

---

## Objetivo del sprint

Entender el problema y dejarlo escrito antes de construir nada.

## Compromiso

**18 puntos.** Es el primer sprint, así que no había velocidad medida contra la
cual contrastar: los puntos se pusieron por comparación entre las tres tareas,
no contra un histórico.

| # | Tarea | Puntos | Responsable |
|---|---|:---:|---|
| [#3](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/3) | Diseñar el modelo de base de datos | 8 | Jacob Riveros |
| [#4](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/4) | Diseñar los wireframes de la interfaz web | 5 | Cristian Quevedo |
| [#11](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/11) | Diseñar la arquitectura general del sistema | 5 | Sergio Alexander L. |

Además, fuera del tablero porque su producto son documentos y no código, se
comprometió la especificación: los cinco módulos, los requisitos funcionales y
no funcionales, y las historias de usuario con sus criterios de aceptación.

## Por qué un sprint entero sin escribir código

Se discutió arrancar directamente por la taquilla, que es la pantalla que el
cliente quiere ver. Se decidió lo contrario.

El dominio tiene reglas que no se adivinan mirando una pantalla: qué pasa con un
vehículo que se queda tres días, cómo se cobra la noche en que el parqueadero
estuvo cerrado, qué ocurre cuando un convenio y otro alcanzan la misma placa.
Descubrir esas reglas a mitad de la construcción obliga a rehacer lo construido,
y rehacer sale más caro que averiguar.

El modelo de datos entró en este sprint por la misma razón: la frontera de
aislamiento entre establecimientos se dibuja al principio o no se dibuja nunca.

## Reparto y por qué

- **El modelo de datos** se le asignó a quien iba a trabajar después sobre la
  integridad del historial, para que quien define la forma de los datos sea
  quien responde por que no se corrompan.
- **Los wireframes** al Product Owner, que es la fuente de verdad del dominio:
  la taquilla se dibuja sabiendo cómo se cobra, no al revés.
- **La arquitectura** a quien administra el repositorio y la configuración.

## Riesgos identificados al planear

| Riesgo | Mitigación acordada |
|---|---|
| Un sprint sin código no deja nada demostrable y el equipo pierde impulso | La revisión se hace sobre los documentos, con demostración de los wireframes y del modelo |
| Especificar de más y no llegar nunca a construir | El alcance se cierra en cinco módulos y lo que no quepa se deja anotado, no se especifica |
| No hay velocidad previa para calibrar el compromiso | Se asume que este sprint es más lento por naturaleza y su resultado se toma como primera medida, no como techo |

## Definición de terminado

Para un sprint de diseño, una tarea está terminada cuando su producto está
escrito, es revisable por los otros tres y sostiene una decisión: el modelo de
datos declara qué entidad lleva la frontera de aislamiento, la arquitectura
compara al menos dos alternativas y dice por qué se eligió una, y los wireframes
resuelven el flujo completo de la taquilla y no sólo su aspecto.

## Resultado

**18 de 18 puntos.** El detalle está en la
[revisión del Sprint 1](../Review/sprint-1-revision.md).
