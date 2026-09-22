# Quickstart — Bicicletas y fichas

Cómo comprobar que la funcionalidad hace lo que dice, de punta a punta.

## Requisitos

- La base de datos migrada: `npm run db:migrate`
- Un establecimiento activo con **tarifa de bicicleta declarada**. Sin ella se puede recibir
  pero no cobrar, que es un escenario legítimo y también hay que probarlo
- Sesión abierta como operario o administrador de ese establecimiento

## 1. Declarar el conjunto de fichas

1. Entrar a **Configuración → Fichas**
2. Declarar 40 fichas
3. **Esperado**: quedan las fichas 1 a 40, todas disponibles

## 2. Recibir una bicicleta

1. En **Taquilla**, pulsar **Recibir bicicleta**
2. Escribir una cédula y un teléfono
3. **Esperado**: el sistema propone la ficha 1, sin que haya que elegirla
4. Confirmar
5. **Esperado**: sale el comprobante con el número 1 destacado, y la taquilla muestra 39
   fichas disponibles

## 3. El cliente que vuelve

1. Recibir otra bicicleta con **la misma cédula**
2. **Esperado**: el teléfono aparece propuesto, sin escribirlo

## 4. Devolver y cobrar

1. En el campo único de la taquilla, escribir `1` y pulsar Enter
2. **Esperado**: aparece la permanencia y el importe según la tarifa de bicicleta
3. Cobrar
4. **Esperado**: sale el recibo y la ficha 1 vuelve a estar disponible
5. Volver a escribir `1`
6. **Esperado**: dice que esa ficha no está entregada. No cobra dos veces

## 5. El tarjetón perdido

1. Recibir una bicicleta con la cédula `1020304050`
2. Buscar por esa cédula, sin el número de ficha
3. **Esperado**: muestra qué ficha tiene esa persona, desde cuándo y cuánto se le cobra
4. Cerrar declarando que el tarjetón se perdió
5. **Esperado**: se cobra la permanencia más el valor de reposición si el establecimiento lo
   declaró, y la ficha queda **perdida**, no disponible
6. **Esperado**: al recibir otra bicicleta, esa ficha no se propone

## 6. Se acaban las fichas

1. Dejar el conjunto en 2 fichas y entregar las dos
2. Intentar recibir una tercera
3. **Esperado**: dice que no quedan fichas disponibles. No registra nada y no falla con un
   error técnico

## 7. Que no se puedan entregar dos veces

Esto no se comprueba a mano: lo cubre `tests/integracion/fichas-concurrencia.test.ts`, que
lanza dos recepciones simultáneas y verifica que reciben fichas distintas.

## 8. Aislamiento

`tests/aislamiento/fichas-ambito.test.ts`: la ficha 7 del establecimiento A no es visible ni
alcanzable desde B.

## 9. Retención

`tests/integracion/fichas-retencion.test.ts`: pasado el plazo, un movimiento cerrado ya no
conserva cédula, teléfono ni nota, **pero sí conserva su cobro**.

## Pruebas

```
npx vitest run
```
