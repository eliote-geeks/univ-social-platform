// URL de base de l'API NestJS. En local elle pointe sur le backend lancé sur la machine de dev ;
// en prod elle sera injectée au build via NEXT_PUBLIC_API_BASE_URL (variable publique, exposée
// au bundle client — normal pour une base URL d'API, ce n'est pas un secret).
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1';

// Même règle que côté backend (RegisterDto) : gardée ici pour valider côté client avant l'appel réseau.
export const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;
