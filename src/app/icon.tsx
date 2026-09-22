import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * El icono de la pestaña.
 *
 * Se genera desde código y no es un archivo dibujado aparte, y eso resuelve lo
 * que pasó con el logo anterior: había una imagen suelta que se quedó vieja
 * cuando la marca cambió, y nadie se enteró hasta verla en una pestaña.
 *
 * A 32 píxeles no cabe una palabra, así que va el GESTO de la marca: el pivote
 * y el brazo de la talanquera levantándose. Es lo único del logo que sobrevive
 * a ese tamaño, y basta para reconocerlo entre veinte pestañas.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "flex-end",
          background: "#08080b",
          borderRadius: 7,
          padding: 6,
        }}
      >
        {/* El pivote. */}
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            background: "#6c8ad6",
            flexShrink: 0,
          }}
        />
        {/* El brazo, levantado. */}
        <div
          style={{
            width: 15,
            height: 4,
            borderRadius: 2,
            marginLeft: 2,
            marginBottom: 6,
            background: "#6c8ad6",
            transform: "rotate(-20deg)",
          }}
        />
      </div>
    ),
    size,
  );
}
