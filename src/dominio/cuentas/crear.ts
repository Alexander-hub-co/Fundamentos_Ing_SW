import { eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { comoPlataforma } from "@/db/ambito";
import { asignacion, usuario } from "@/db/esquema";
import type { RolUsuario } from "@/db/esquema";
import { auth } from "@/lib/auth";
import { exigirPasswordFuerte } from "@/dominio/autenticacion/password";
import { exigir } from "@/lib/autorizacion";
import type { Contexto } from "@/lib/sesion";
import { siguienteCodigoDeCuenta } from "./codigo";

export class CorreoYaRegistrado extends Error {
  constructor() {
    super("Ya existe una cuenta con ese correo");
    this.name = "CorreoYaRegistrado";
  }
}

export class AmbitoInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "AmbitoInvalido";
  }
}

export type DatosNuevaCuenta = {
  email: string;
  nombre: string;
  passwordTemporal: string;
  rol: RolUsuario;
  parqueaderoId?: string | null;
};

/**
 * Crea una cuenta con contraseña temporal (FR-028, FR-031, FR-032).
 *
 * La contraseña la fija el administrador general y se la entrega a su titular
 * FUERA del sistema —por teléfono o mensaje— porque Parquivo no envía correo.
 * La cuenta nace con `debeCambiarPassword`, así que esa clave sólo sirve para
 * el primer ingreso.
 */
export async function crearCuenta(
  contexto: Contexto,
  datos: DatosNuevaCuenta,
): Promise<{ usuarioId: string; codigo: string }> {
  exigir(contexto, "cuenta.crear");
  return altaDeCuenta(contexto, datos);
}

/**
 * La mecánica del alta, sin decidir quién puede hacerla.
 *
 * Existe porque hay dos caminos legítimos con permisos distintos: el
 * administrador general dando de alta en cualquier establecimiento, y el
 * administrador de un local dando de alta en el suyo. Cada uno exige SU
 * operación antes de llegar acá; lo que comparten es el cómo, no el quién.
 *
 * No se resolvió ampliando los roles de `cuenta.crear`, y es deliberado: esa
 * operación acepta un `parqueaderoId` arbitrario, así que dársela al
 * administrador de un local le permitiría crear cuentas en otro.
 */
export async function altaDeCuenta(
  contexto: Contexto,
  datos: DatosNuevaCuenta,
): Promise<{ usuarioId: string; codigo: string }> {

  const email = datos.email.toLowerCase().trim();
  const nombre = datos.nombre.trim();

  if (!email || !nombre) {
    throw new AmbitoInvalido("El correo y el nombre son obligatorios");
  }

  // La contraseña temporal es una credencial que abre sesión hasta que se
  // cambie, así que se le exige lo mismo que a cualquier otra.
  exigirPasswordFuerte(datos.passwordTemporal);

  // La misma invariante que el CHECK de la tabla, comprobada antes para dar un
  // error con significado en vez de un fallo de integridad.
  const esGlobal = datos.rol === "admin_general";
  if (esGlobal && datos.parqueaderoId) {
    throw new AmbitoInvalido(
      "Un administrador general no pertenece a ningún establecimiento",
    );
  }
  if (!esGlobal && !datos.parqueaderoId) {
    throw new AmbitoInvalido(
      "Un administrador de parqueadero o un operario necesitan un establecimiento",
    );
  }

  let usuarioId: string;
  try {
    const creada = await auth.api.createUser({
      body: { email, name: nombre, password: datos.passwordTemporal },
    });
    usuarioId = creada.user.id;
  } catch (error) {
    if (error instanceof APIError) throw new CorreoYaRegistrado();
    throw error;
  }

  const codigo = await comoPlataforma("administracion_plataforma", async (tx) => {
    await tx.insert(asignacion).values({
      usuarioId,
      parqueaderoId: datos.parqueaderoId ?? null,
      rol: datos.rol,
    });

    // El código legible se calcula DENTRO de esta transacción, después de
    // insertar la asignación: así el correlativo cuenta a esta cuenta entre las
    // del establecimiento y dos altas simultáneas no pueden proponer el mismo.
    const asignado = await siguienteCodigoDeCuenta(tx, datos.parqueaderoId ?? null);

    // Explícito aunque `debeCambiarPassword` sea el valor por defecto de la
    // columna: que la cuenta nazca obligada a cambiar la contraseña es un
    // requisito (FR-033), no un detalle heredado del esquema.
    await tx
      .update(usuario)
      .set({ debeCambiarPassword: true, codigo: asignado })
      .where(eq(usuario.id, usuarioId));

    return asignado;
  });

  return { usuarioId, codigo };
}
