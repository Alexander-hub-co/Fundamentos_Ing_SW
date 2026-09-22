import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La aplicación corre en un solo despliegue sobre plataforma gestionada.
  // Ver specs/001-gestion-parqueaderos/research.md, decisión D4.
  reactStrictMode: true,
};

export default nextConfig;
