# Diagrama de Clases

![Diagrama de clases de Parquivo](clases.png)

Fuente: [`fuentes/clases.puml`](fuentes/clases.puml)

## Qué modela

El modelo de diseño de las historias HU-008, HU-007 y HU-004. Tiene tres
grupos:

- **Servicios**, que contienen la lógica de negocio: `ServicioTaquilla` y
  `CalculadoraCobro`.
- **Interfaces**, que son los contratos de los que dependen los servicios:
  `ICalculadoraCobro`, `IRepositorioMovimientos`, `IRepositorioTarifas`,
  `IRepositorioConvenios` e `IAutorizador`.
- **Dominio**, que son los datos del negocio: `Parqueadero`, `Movimiento`,
  `Tarifa` y sus modelos, `Convenio`, `Cobro`, etcétera.

Parquivo está escrito en TypeScript con módulos y funciones; varias de estas
clases existen en el código como tipos y módulos con el mismo nombre (por
ejemplo, los tres modelos de tarifa son la unión `TarifaAplicable` en
`src/dominio/tarifas/modelos.ts`). El diagrama los expresa en notación de clases.

## Relaciones

| Tipo | Entre | Por qué |
|---|---|---|
| **Herencia** | `Tarifa` ◁— `TarifaPorMinuto`, `TarifaPorIntervalo`, `TarifaPrimeraHoraYFraccion` | Los tres modelos de cobro comparten la tarifa plena y su vigencia, y cada uno calcula a su manera |
| **Realización** | `ICalculadoraCobro` ◁┄ `CalculadoraCobro` | La taquilla depende del contrato, no de la implementación |
| **Composición** | `Movimiento` ◆— `Cobro` (1 — 0..1) | El cobro es la copia (snapshot) de HU-004: nace al cerrar el movimiento y no existe sin él |
| **Composición** | `Cobro` ◆— `TramoCobrado` (1 — 1..*), `Cobro` ◆— `BeneficioAplicado` (1 — 0..*) | El desglose de HU-007 forma parte del cobro |
| **Composición** | `Movimiento` ◆— `Placa` (1 — 1) | La placa normalizada pertenece al movimiento |
| **Agregación** | `Parqueadero` ◇— `Tarifa`, `Convenio`, `Movimiento` (1 — 0..*) | El establecimiento agrupa lo que declara y registra |
| **Asociación** | `Movimiento` → `TipoVehiculo` (0..* — 1), `Movimiento` → `Usuario` (0..* — 1), `Movimiento` → `SesionTurno` (0..* — 0..1), `Tarifa` → `TipoVehiculo` (0..* — 1) | Referencias entre objetos que viven por separado |

## Principios SOLID

| Principio | Cómo se aplica |
|---|---|
| **S** — Responsabilidad única | Cada clase tiene un solo motivo de cambio: `Placa` normaliza y clasifica, `PoliticaCobro` sólo redondea, `CalculadoraCobro` sólo calcula y `ServicioTaquilla` sólo orquesta el flujo. En el código son módulos separados: `vehiculos/placa.ts`, `cobro/redondeo.ts`, `tarifas/calcular.ts` y `taquilla/resolver.ts`. |
| **O** — Abierto/cerrado | Un modelo de cobro nuevo se agrega como una subclase más de `Tarifa`, sin modificar `CalculadoraCobro` ni `ServicioTaquilla`. |
| **L** — Sustitución de Liskov | Cualquier subclase de `Tarifa` puede usarse donde se espera una `Tarifa`: todas cumplen el mismo contrato de `calcular(minutos)`, que devuelve un importe entero, no negativo y que nunca supera la tarifa plena. La base de datos lo garantiza con restricciones `CHECK`. |
| **I** — Segregación de interfaces | Hay interfaces pequeñas y específicas en lugar de un repositorio general: `ServicioTaquilla` sólo conoce `IRepositorioMovimientos` e `IAutorizador`, y `CalculadoraCobro` sólo `IRepositorioTarifas` e `IRepositorioConvenios`. Ninguna clase depende de métodos que no usa. |
| **D** — Inversión de dependencias | `ServicioTaquilla` depende de la abstracción `ICalculadoraCobro` y no de `CalculadoraCobro`; las dos dependen del contrato. Lo mismo ocurre con el acceso a datos: los servicios piden repositorios por su interfaz y no conocen PostgreSQL. |
