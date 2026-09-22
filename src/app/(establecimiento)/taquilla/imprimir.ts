/**
 * EL ÚNICO ARCHIVO QUE SABE DE IMPRESIÓN.
 *
 * La decisión que implementa está en `specs/004-taquilla-vehiculos/research.md`,
 * D1: el trabajo sale desde la máquina de la taquilla, delegando en el sistema
 * operativo, porque es lo único que sabe hablar con las tres conexiones que hay
 * en el campo —cable, red y Bluetooth—. Una impresora de red en el local tiene
 * dirección privada, así que desde el servidor es tan inalcanzable como una por
 * cable.
 *
 * **Por qué un marco y no la propia página.** El documento se mete en un
 * `<iframe>` con su propio `@page`. Si se imprimiera la página de la taquilla
 * con una hoja de estilos de impresión, las reglas de la aplicación y las del
 * rollo convivirían en el mismo documento y cualquier cambio de pantalla podría
 * salir por el papel. Con el marco, lo que se imprime es exactamente el
 * documento que armó el servidor y nada más.
 *
 * **El diálogo.** Con el navegador en `--kiosk-printing` y la térmica como
 * predeterminada, esto sale sin preguntar nada. Sin ese modo aparece el diálogo
 * del sistema, que sigue funcionando pero frena la fila; es configuración de la
 * máquina, no del programa.
 */

/** Cuánto se espera a que el navegador termine antes de retirar el marco. */
const RESPIRO_MS = 1_500;

/** Cuánto se espera a que el documento cargue antes de darlo por fallido. */
const ESPERA_MAXIMA_MS = 5_000;

export type ResultadoImpresion = { ok: true } | { ok: false; motivo: string };

export function imprimirDocumento(html: string): Promise<ResultadoImpresion> {
  return new Promise((resolver) => {
    if (typeof window === "undefined") {
      resolver({ ok: false, motivo: "No hay navegador" });
      return;
    }

    let marco: HTMLIFrameElement | null = null;
    let terminado = false;
    /** `print()` se llama EXACTAMENTE una vez. Dos llamadas son dos trabajos. */
    let yaImpreso = false;

    const limpiar = (resultado: ResultadoImpresion) => {
      if (terminado) return;
      terminado = true;
      // El marco se retira después, no en el acto: algunos navegadores siguen
      // usando su documento mientras arman el trabajo de impresión, y quitarlo
      // antes de tiempo saca una hoja en blanco.
      window.setTimeout(() => marco?.remove(), RESPIRO_MS);
      resolver(resultado);
    };

    try {
      marco = document.createElement("iframe");
      marco.setAttribute("aria-hidden", "true");
      marco.style.position = "fixed";
      marco.style.width = "0";
      marco.style.height = "0";
      marco.style.border = "0";
      marco.style.opacity = "0";
      // Fuera de la vista, pero NO con `display:none`: un marco oculto así no
      // se compagina y sale en blanco.
      marco.style.left = "-9999px";

      /**
       * EL ORDEN IMPORTA Y COSTÓ PAPEL.
       *
       * `srcdoc` se asigna ANTES de insertar el marco en la página. Al revés
       * —insertar primero— el navegador carga `about:blank` y dispara `load` en
       * el acto, así que `print()` salía sobre un documento vacío; con el modo
       * silencioso eso no abre ningún diálogo que avise, y Chrome cae de vuelta
       * a imprimir la página que contiene el marco: la taquilla entera,
       * paginada a tamaño carta sobre un rollo de 58 mm. Diez hojas de interfaz
       * y ninguna factura.
       */
      marco.srcdoc = html;

      marco.onload = () => {
        try {
          const ventana = marco?.contentWindow;
          const cuerpo = ventana?.document?.body;

          // Segunda defensa, por si algún navegador dispara `load` igual con
          // `about:blank`: sólo se imprime un documento que lleve la marca que
          // `comprobanteHtml` le pone. Sin ella no es nuestro ticket, y lo
          // correcto es no mandar nada a la impresora.
          if (!ventana || cuerpo?.dataset.parquivoTicket !== "1") return;

          if (yaImpreso) return;
          yaImpreso = true;

          ventana.focus();
          ventana.print();
          limpiar({ ok: true });
        } catch (error) {
          limpiar({ ok: false, motivo: describir(error) });
        }
      };

      document.body.appendChild(marco);

      // Si el documento nunca llega a ser el nuestro, la promesa no puede
      // quedarse colgada: quien llama tiene un botón esperando respuesta.
      window.setTimeout(() => {
        limpiar({ ok: false, motivo: "El documento del ticket no llegó a cargarse" });
      }, ESPERA_MAXIMA_MS);
    } catch (error) {
      limpiar({ ok: false, motivo: describir(error) });
    }
  });
}

/**
 * Qué significa que `print()` devuelva sin error.
 *
 * Significa poco, y hay que decirlo: el navegador no informa si el papel salió.
 * Un "ok" acá quiere decir "el trabajo se entregó al sistema", no "se imprimió".
 * Por eso el comprobante se marca como emitido pero la lista de pendientes
 * sigue existiendo y se puede reimprimir: la única verificación real de que
 * salió el papel es que alguien lo vea salir.
 */
function describir(error: unknown): string {
  return error instanceof Error ? error.message : "No se pudo imprimir";
}
