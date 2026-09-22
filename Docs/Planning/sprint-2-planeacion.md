# Planeación del Sprint 2

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

| | |
|---|---|
| **Sprint** | 2 · Plataforma y seguridad |
| **Periodo** | 1 al 14 de septiembre de 2026 |
| **Planeación** | Martes 1 de septiembre de 2026, 20:10 – 21:00 |
| **Asistentes** | Cristian Quevedo, Sergio Alexander L., Jacob Riveros, Santiago Arias |
| **Acta** | [ACTA-003](../Actas/ACTA-003-2026-09-01.md) |

---

## Objetivo del sprint

Que existan cuentas, que cada quien vea sólo lo suyo y que el dinero se
represente bien desde el primer registro.

## Compromiso

**21 puntos**, con una velocidad medida de 18 en el sprint anterior.

| # | Historia | Puntos | Responsable |
|---|---|:---:|---|
| [#24](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/24) | Aislamiento en consulta de movimientos | 8 | Cristian Quevedo |
| [#25](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/25) | Autorización de rol para operaciones de creación | 5 | Sergio Alexander L. |
| [#2](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/2) | Login en el sistema | 5 | Jacob Riveros |
| [#28](https://github.com/Alexander-hub-co/Fundamentos_Ing_SW/issues/28) | Registro de montos en pesos sin decimales | 3 | Santiago Arias |

## Por qué este orden y no otro

Se discutió si empezar por la taquilla, que es la pantalla que se ve, o por el
aislamiento, que no se ve. Se decidió lo segundo.

Montar la frontera entre establecimientos después, sobre un esquema que ya tiene
movimientos y tarifas, es el trabajo que nunca se termina de hacer bien: basta
una consulta olvidada para que un establecimiento vea los movimientos de otro, y
esa consulta puede aparecer meses más tarde.

Los montos en enteros entran en este sprint por la misma razón. Cambiar el tipo
de dato del dinero cuando ya hay cobros registrados obliga a migrar el
historial, y el historial es justamente lo que no se puede tocar.

## Riesgos identificados al planear

| Riesgo | Mitigación acordada |
|---|---|
| El aislamiento es la historia más grande y de ella dependen las demás | Se asigna a quien tiene el contexto del dominio y se ataca primero |
| Coinciden parciales de otras asignaturas | Lo que no se termine se decide historia por historia en la revisión, sin arrastrar el sprint completo |

## Definición de terminado

Una historia está terminada cuando cumple sus criterios de aceptación escritos,
tiene prueba automatizada y está integrada en `develop` mediante una rama y su
revisión. No basta con que funcione en la máquina de quien la escribió.
