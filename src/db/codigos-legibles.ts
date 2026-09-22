import type { Client } from "pg";
import { siglaConDesempate, siglaDe, esSiglaValida } from "@/dominio/parqueaderos/sigla";
import { codigoDeCuenta, SIGLA_PLATAFORMA } from "@/dominio/parqueaderos/sigla";

/**
 * Migración de datos a los códigos legibles.
 *
 * Antes, un establecimiento se identificaba con `PQV-A3F7K2` —único, pero
 * imposible de leer o comparar— y una cuenta sólo con el identificador opaco de
 * Better Auth. Ahora el establecimiento lleva su sigla (`PCH`) y cada cuenta
 * suya un correlativo bajo esa sigla (`PCH-001`).
 *
 * Se escribe en TypeScript y no en SQL a propósito: la derivación de la sigla
 * ya vive en `dominio/parqueaderos/sigla.ts` y traducirla a plpgsql crearía dos
 * versiones de la misma regla, condenadas a separarse con el tiempo.
 *
 * Es IDEMPOTENTE: sólo toca las filas que todavía no tienen la forma nueva, así
 * que correr el migrador dos veces no renumera a nadie.
 */
export async function asignarCodigosLegibles(admin: Client): Promise<void> {
  await migrarEstablecimientos(admin);
  await migrarCuentas(admin);
}

/**
 * Reescribe los códigos con la forma vieja.
 *
 * El disparador `parqueadero_codigo_inmutable_trg` existe justamente para que
 * ningún código cambie nunca (FR-016), así que hay que desactivarlo. Se hace de
 * la forma más acotada posible —dentro de una transacción, sólo para esta
 * operación, y se reactiva pase lo que pase— porque un disparador de integridad
 * apagado y olvidado es peor que no haberlo tenido.
 *
 * La inmutabilidad se sigue respetando de cara al futuro: lo que cambia acá es
 * el formato de identificadores emitidos antes de que existiera el formato
 * definitivo, no el código de un establecimiento en operación.
 */
async function migrarEstablecimientos(admin: Client): Promise<void> {
  const pendientes = await admin.query<{ id: string; nombre: string; codigo: string }>(
    `select id, nombre, codigo from parqueadero order by creado_en`,
  );

  const porMigrar = pendientes.rows.filter((p) => !esSiglaValida(p.codigo));
  if (porMigrar.length === 0) {
    console.log("  establecimientos: ya tienen sigla");
    return;
  }

  const tomadas = new Set(
    pendientes.rows.filter((p) => esSiglaValida(p.codigo)).map((p) => p.codigo),
  );

  await admin.query("begin");
  try {
    await admin.query("alter table parqueadero disable trigger parqueadero_codigo_inmutable_trg");

    for (const p of porMigrar) {
      const base = siglaDe(p.nombre);
      let sigla = base;
      for (let intento = 1; tomadas.has(sigla); intento++) {
        sigla = siglaConDesempate(base, intento + 1);
      }
      tomadas.add(sigla);

      await admin.query("update parqueadero set codigo = $1 where id = $2", [sigla, p.id]);
      console.log(`  ${p.codigo} -> ${sigla}  (${p.nombre})`);
    }

    await admin.query("alter table parqueadero enable trigger parqueadero_codigo_inmutable_trg");
    await admin.query("commit");
  } catch (error) {
    await admin.query("rollback");
    // El rollback deshace el ALTER, pero reactivar explícitamente cuesta poco y
    // cierra el caso en que la transacción hubiera quedado a medias.
    await admin
      .query("alter table parqueadero enable trigger parqueadero_codigo_inmutable_trg")
      .catch(() => {});
    throw error;
  }
}

/**
 * Numera las cuentas que no tienen código.
 *
 * El orden es por fecha de creación, así que quien llegó primero al
 * establecimiento se queda con el `-001`. En la práctica esa primera cuenta
 * suele ser la de su administrador, que es lo que uno espera al leer `PCH-001`.
 */
async function migrarCuentas(admin: Client): Promise<void> {
  const filas = await admin.query<{
    id: string;
    sigla: string | null;
    rol: string | null;
  }>(
    `select u.id, p.codigo as sigla, a.rol
       from "user" u
       left join asignacion a on a.usuario_id = u.id
       left join parqueadero p on p.id = a.parqueadero_id
      where u.codigo is null
      order by u.created_at`,
  );

  if (filas.rowCount === 0) {
    console.log("  cuentas: ya tienen código");
    return;
  }

  // Se arranca desde el mayor correlativo ya emitido por sigla, para no repetir
  // ninguno si la migración corre sobre una base que ya tenía algunos puestos.
  const usados = await admin.query<{ codigo: string }>(
    `select codigo from "user" where codigo is not null`,
  );
  const ultimo = new Map<string, number>();
  for (const { codigo } of usados.rows) {
    const partes = codigo.split("-");
    const sigla = partes.slice(0, -1).join("-");
    const numero = Number.parseInt(partes[partes.length - 1] ?? "", 10);
    if (Number.isFinite(numero)) {
      ultimo.set(sigla, Math.max(ultimo.get(sigla) ?? 0, numero));
    }
  }

  for (const fila of filas.rows) {
    const sigla = fila.sigla ?? SIGLA_PLATAFORMA;
    const numero = (ultimo.get(sigla) ?? 0) + 1;
    ultimo.set(sigla, numero);

    const codigo = codigoDeCuenta(sigla, numero);
    await admin.query('update "user" set codigo = $1 where id = $2', [codigo, fila.id]);
    console.log(`  cuenta ${fila.rol ?? "sin rol"} -> ${codigo}`);
  }
}
