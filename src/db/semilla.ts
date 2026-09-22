/**
 * Crea la única cuenta de administrador general inicial.
 *
 * La especificación lo declara como suposición: esa cuenta no se crea desde la
 * interfaz, porque no habría quién la creara. Es el punto de arranque del
 * sistema.
 *
 * Uso:
 *   npm run db:semilla -- correo@ejemplo.com "Nombre Apellido" "contraseña"
 */
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { comoPlataforma } from "./ambito";
import { asignacion, usuario } from "./esquema";
import { cerrarPools } from "./pools";

async function main() {
  const [email, nombre, password] = process.argv.slice(2);

  if (!email || !nombre || !password) {
    console.error(
      'Uso: npm run db:semilla -- <correo> "<nombre>" "<contraseña>"',
    );
    process.exit(1);
  }

  const yaExiste = await comoPlataforma("administracion_plataforma", (tx) =>
    tx
      .select({ id: asignacion.id })
      .from(asignacion)
      .where(eq(asignacion.rol, "admin_general"))
      .limit(1),
  );

  if (yaExiste.length > 0) {
    console.error(
      "Ya existe un administrador general. La semilla sólo crea el primero;\n" +
        "los demás se crean desde el panel, que es lo que exige FR-031.",
    );
    process.exit(1);
  }

  // El rol NO se pasa acá a propósito. La fuente de verdad del rol es
  // `asignacion.rol`, no el campo `role` del plugin de administración: tenerlo
  // en dos sitios garantiza que algún día discrepen, y el que manda es el que
  // la restricción CHECK mantiene coherente con el ámbito.
  const creada = await auth.api.createUser({
    body: { email, name: nombre, password },
  });

  await comoPlataforma("administracion_plataforma", async (tx) => {
    // El administrador general no pertenece a ningún establecimiento: su
    // asignación lleva parqueadero_id nulo, y el CHECK de la tabla exige
    // exactamente esa combinación.
    await tx.insert(asignacion).values({
      usuarioId: creada.user.id,
      parqueaderoId: null,
      rol: "admin_general",
    });

    // La contraseña la eligió quien corre la semilla, así que no hay nada
    // temporal que cambiar en el primer ingreso.
    await tx
      .update(usuario)
      .set({ debeCambiarPassword: false })
      .where(eq(usuario.id, creada.user.id));
  });

  console.log(`Administrador general creado: ${email}`);
  await cerrarPools();
}

await main();
