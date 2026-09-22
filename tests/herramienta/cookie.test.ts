import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { iniciarSesion } from "@/dominio/autenticacion/iniciar-sesion";

/**
 * Herramienta de verificación, no una prueba de la suite.
 *
 * Abre una sesión real contra la base de DESARROLLO y guarda su cookie, para
 * poder recorrer las pantallas con `curl` sin depender de un navegador. Vive
 * aparte y se ejecuta a mano:
 *
 *   PQ_EMAIL=… PQ_PASS=… PQ_SALIDA=/ruta/cookie.txt \
 *     npx vitest run --config ./vitest.herramienta.ts
 *
 * Hace DOS cosas, y el orden importa. Primero entra por la función de dominio,
 * que es el camino de verdad: comprueba la demora, anota el intento y valida el
 * estado de la cuenta. Sólo después pide la cookie, porque el dominio devuelve
 * un resultado y no cabeceras. Así la herramienta ejercita el mismo recorrido
 * que la persona y deja el mismo rastro, en vez de colarse por un atajo que la
 * aplicación ya no tiene.
 */
it("abre una sesión y guarda su cookie", async () => {
  const email = process.env.PQ_EMAIL!;
  const password = process.env.PQ_PASS!;

  const resultado = await iniciarSesion({ email, password, origen: "herramienta-local" });
  expect(["ok", "debe_cambiar_password"]).toContain(resultado.tipo);

  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookies = (headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  expect(cookies).toContain("session_token");

  writeFileSync(process.env.PQ_SALIDA!, cookies);
})
