import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { asc, sql } from "drizzle-orm";
import { comoPlataforma } from "@/db/ambito";
import { parqueadero, tipoVehiculo, usuario } from "@/db/esquema";
import { cerrarPools } from "@/db/pools";
import { crearParqueadero } from "@/dominio/parqueaderos/crear";
import { declararTarifa } from "@/dominio/tarifas/declarar";
import { aTarifaAplicable, tarifaVigenteEn, tiposSinTarifa } from "@/dominio/tarifas/consultar";
import { calcularImporte } from "@/dominio/tarifas/calcular";
import { declararHorario } from "@/dominio/horarios/declarar";
import { estaAbierto, horarioDelCobro } from "@/dominio/horarios/consultar";
import { capacidadDeclarada, declararCapacidad } from "@/dominio/capacidad/declarar";
import { asignarATurno, crearTurno } from "@/dominio/turnos/gestionar";
import { turnosDelEstablecimiento, turnosVigentesEn } from "@/dominio/turnos/consultar";
import { crearCuentaEnMiEstablecimiento, miEquipo } from "@/dominio/cuentas/en-establecimiento";
import { agregarPlaca, descuentoParaPlaca, declararConvenio } from "@/dominio/convenios/gestionar";
import type { EstadoParqueadero } from "@/db/esquema";
import type { Contexto } from "@/lib/sesion";

/**
 * SC-010 — toda la configuración de F2 se define y se verifica sin registrar un
 * solo movimiento de vehículo.
 *
 * No es una prueba de funcionalidad: es la que demuestra que F2 y F3 quedaron
 * bien separadas. Si algún día una de estas operaciones necesitara un
 * movimiento para funcionar, esta prueba lo diría, y significaría que la
 * frontera entre las dos features se corrió sin que nadie lo decidiera.
 *
 * Deja un establecimiento COMPLETAMENTE configurado y comprueba cada respuesta,
 * con la tabla de movimientos inexistente.
 */

const ADMIN: Contexto = { tipo: "plataforma", usuarioId: "u-sm", rol: "admin_general" };
const CLAVE = "ClaveLargaSegura2026";

const comoAdminDe = (parqueaderoId: string, estado: EstadoParqueadero = "activo"): Contexto => ({
  tipo: "establecimiento",
  usuarioId: "u-sm",
  rol: "admin_parqueadero",
  parqueaderoId,
  estado,
});

async function limpiar() {
  await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.execute(sql`delete from convenio_placa`);
    await tx.execute(sql`delete from convenio`);
    await tx.execute(sql`delete from turno_asignacion`);
    await tx.execute(sql`delete from turno_dia`);
    await tx.execute(sql`delete from turno`);
    await tx.execute(sql`delete from horario_franja`);
    await tx.execute(sql`delete from horario_atencion`);
    await tx.execute(sql`delete from capacidad`);
    await tx.execute(sql`delete from tarifa`);
    await tx.execute(sql`delete from session`);
    await tx.execute(sql`delete from account`);
    await tx.execute(sql`delete from asignacion`);
    await tx.execute(sql`delete from cambio_estado`);
    await tx.execute(sql`delete from ${parqueadero}`);
    await tx.execute(sql`delete from uso_privilegio`);
    await tx.execute(sql`delete from acceso_denegado`);
    await tx.execute(sql`delete from intento_login`);
    await tx.execute(sql`delete from ${usuario}`);
    await tx.insert(usuario).values({ id: "u-sm", name: "Admin", email: "sm@ejemplo.co" });
  });
}

beforeEach(limpiar);
afterAll(async () => {
  await limpiar();
  await cerrarPools();
});

describe("un establecimiento queda listo para operar sin ningún movimiento", () => {
  it("se configura entero y responde todo lo que la taquilla necesitará", async () => {
    const p = await crearParqueadero(ADMIN, { nombre: "Parqueadero Completo" });
    const ctx = comoAdminDe(p.id);

    const catalogo = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.select().from(tipoVehiculo).orderBy(asc(tipoVehiculo.orden)),
    );
    const automovil = catalogo.find((t) => t.codigo === "automovil")!;
    const bicicleta = catalogo.find((t) => t.codigo === "bicicleta")!;

    // ── 1. Tarifas, una de cada modelo ────────────────────────────────
    await declararTarifa(ctx, {
      tipoVehiculoId: automovil.id,
      modelo: "por_minuto",
      alcancePlena: "jornada",
      tarifaMinima: 500,
      valorMinuto: 60,
      tarifaPlena: 14_000,
    });
    await declararTarifa(ctx, {
      tipoVehiculoId: bicicleta.id,
      modelo: "por_intervalo",
      alcancePlena: "jornada",
      intervaloMinutos: 30,
      valorIntervalo: 500,
      tarifaPlena: 4_000,
    });

    // ── 2. Horario y capacidad ────────────────────────────────────────
    await declararHorario(ctx, {
      abierto24h: false,
      cobraHorasCerradas: false,
      franjas: [1, 2, 3, 4, 5].map((diaSemana) => ({
        diaSemana,
        horaApertura: "07:00",
        horaCierre: "20:00",
      })),
    });
    await declararCapacidad(ctx, automovil.id, 40);

    // ── 3. Equipo y turnos ────────────────────────────────────────────
    const persona = await crearCuentaEnMiEstablecimiento(ctx, {
      email: "operario.sm@ejemplo.co",
      nombre: "Operario",
      passwordTemporal: CLAVE,
      rol: "operario",
    });
    const turno = await crearTurno(ctx, {
      nombre: "Mañana",
      horaInicio: "07:00",
      horaFin: "15:00",
      dias: [1, 2, 3, 4, 5],
    });
    await asignarATurno(ctx, turno.id, persona.usuarioId);

    // ── 4. Convenios ──────────────────────────────────────────────────
    const convenio = await declararConvenio(ctx, { nombre: "Clínica", activacion: "placa", beneficio: "porcentaje", valor: 20 });
    await agregarPlaca(ctx, convenio.id, "ABC123");

    // ── Todo lo que la taquilla preguntará, ya se puede responder ──────
    const lunes10 = new Date("2026-08-17T10:00:00-05:00");
    const horario = await horarioDelCobro(ctx);

    expect(await tiposSinTarifa(ctx)).toHaveLength(catalogo.length - 2);
    expect(estaAbierto(horario, lunes10)).toBe(true);
    expect((await capacidadDeclarada(ctx))[0]!.capacidad.cupos).toBe(40);
    expect(turnosVigentesEn(await turnosDelEstablecimiento(ctx), lunes10)).toHaveLength(1);
    expect(await miEquipo(ctx)).toHaveLength(1);
    expect((await descuentoParaPlaca(ctx, "abc 123", lunes10))?.valor).toBe(20);

    // Y el cobro se puede calcular con momentos inventados.
    //
    // La tarifa se consulta para AHORA y no para el lunes de ejemplo: se acaba
    // de declarar, así que en aquel momento no regía ninguna. Que devuelva null
    // para una fecha anterior es el versionado funcionando, no un fallo.
    const tarifa = await tarifaVigenteEn(ctx, automovil.id, new Date());
    const cobro = calcularImporte({
      entrada: lunes10,
      salida: new Date("2026-08-17T11:00:00-05:00"),
      tarifa: aTarifaAplicable(tarifa!),
      horario,
    });
    expect(cobro.importe).toBe(3_600);
    expect(cobro.tramos).toHaveLength(1);
  });

  it("todo lo anterior ocurrió sin registrar un solo movimiento", async () => {
    // Esta prueba nació diciendo que la tabla de movimientos NO EXISTÍA, y ella
    // misma anotaba que se actualizaría cuando llegara la taquilla. Llegó. Lo
    // que sigue valiendo, y es lo que de verdad importaba, es que un
    // establecimiento se configura entero —tarifas, horario, capacidad,
    // convenios, turnos— sin atender a un solo vehículo. La configuración es
    // independiente de la operación.
    const r = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`select count(*)::int as n from movimiento`),
    );

    expect(r.rows).toEqual([{ n: 0 }]);
  });

  it("no existe ninguna tabla de fichas, y no debe existir", async () => {
    // Esta prueba nació diciendo que las bicicletas eran de otra funcionalidad.
    // Llegó esa funcionalidad, y resultó que tampoco entonces hacía falta una
    // tabla: una ficha ES el ticket —el mismo papel que sale para un carro, con
    // un número en vez de una placa— y cuántas hay es la capacidad de
    // bicicletas ya declarada. No hay tarjetón que administrar.
    //
    // Se comprueba que la tabla NO exista para que nadie la reintroduzca sin
    // discutirlo: sería un segundo sitio donde guardar cuántas fichas hay, y
    // los dos podrían discrepar.
    const r = await comoPlataforma("administracion_plataforma", (tx) =>
      tx.execute(sql`
        select c.relname
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relkind = 'r' and c.relname = 'ficha'
      `),
    );

    expect(r.rows).toEqual([]);
  });
});
