# Casos de uso más importantes

**Parquivo** · Fundamentos de Ingeniería de Software (12946) · 2026-2

De los doce casos de uso del sistema, dos son el corazón del producto:

| Caso de uso | Actor | Carpeta |
|---|---|---|
| **CU-07 · Registrar la entrada de un vehículo** | Operario | [`CU-07-registrar-entrada/`](CU-07-registrar-entrada/) |
| **CU-08 · Cobrar la salida de un vehículo** | Operario | [`CU-08-cobrar-salida/`](CU-08-cobrar-salida/) |

---

## Por qué estos dos

**Lo declara la constitución del proyecto.** Su Principio III es *«La Taquilla es
la Ruta Crítica»*, y estos dos casos **son** la taquilla.

**Son la propuesta de valor.** El canvas resume el producto en una frase —«cada
cobro se puede explicar»— y esa frase describe CU-08.

**Son el único ciclo cerrado.** Un vehículo que entra y no sale no produce
ingreso, y la salida no puede existir sin la entrada. Los demás casos existen
para servirlos: las tarifas para que la salida pueda cobrar, los turnos para
atribuir los movimientos, los convenios para modificar el importe.

**Concentran el plan.** Los sprints 3 y 4 están dedicados por completo a ellos:
48 de los 83 puntos que quedan por delante.

> **Un matiz.** Medido por tamaño, el caso más grande es CU-04 · Configurar el
> cobro, con 8 historias y 25 requisitos. Pero es un medio y no un fin: existe
> para que CU-08 pueda ocurrir. Nadie usa un parqueadero para configurar
> tarifas.

---

## Qué hay en cada carpeta

| Archivo | Qué contiene |
|---|---|
| `README.md` | El caso de uso: actor, precondición, flujo principal y alternativos |
| `1-diagrama-de-clases.md` | Los tipos y funciones que lo implementan, y cómo se relacionan |
| `2-modelo-de-base-de-datos.md` | Las tablas que toca, con sus columnas y restricciones |
| `3-diagrama-de-componentes.md` | Las piezas del sistema que intervienen y cómo se hablan |
| `4-diagrama-de-despliegue.md` | Dónde se ejecuta cada pieza |
| `5-diagrama-de-interfaz.md` | Las pantallas y los estados por los que pasa el operario |
| `codigo/` | Los archivos fuente que lo implementan |

Los archivos de `codigo/` son **copias** de `src/`, reunidas aquí para poder
revisar un caso de uso completo sin recorrer el árbol. La versión que se compila
y se prueba es la de `src/`; si las dos difieren, manda `src/`.

Los diagramas están escritos en Mermaid, que GitHub dibuja solo al abrir el
archivo.
