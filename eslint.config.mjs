import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next 16 ya exporta configuración plana, así que no hace falta
// la capa de compatibilidad con el formato antiguo.
const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "coverage/**",
      "next-env.d.ts",
      // Extractos del código para la documentación: no compilan por sí solos
      // porque les faltan los módulos que importan. El código real está en src/.
      "Casos-de-uso-mas-importantes/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
];

export default config;
