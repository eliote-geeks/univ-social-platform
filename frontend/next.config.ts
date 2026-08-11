import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le lockfile le plus proche remonté par Turbopack est celui de /home/paul (hors du dépôt git
  // du projet) ; on fixe explicitement la racine pour qu'il utilise celui du projet.
  turbopack: {
    root: path.join(__dirname),
  },
  // Image de production minimale (copie uniquement les fichiers nécessaires à l'exécution,
  // sans le node_modules complet) — cf. frontend/Dockerfile.
  output: "standalone",
};

export default nextConfig;
