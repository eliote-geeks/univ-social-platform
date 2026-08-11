// Stockage des tokens en localStorage : simple et suffisant pour ce projet (API à JWT bearer,
// pas de cookies côté serveur). Toutes les fonctions sont no-op côté serveur (SSR) puisque
// localStorage n'existe pas là-bas — chaque appelant doit de toute façon être un Client Component.
const ACCESS_KEY = 'univsocial.accessToken';
const REFRESH_KEY = 'univsocial.refreshToken';

export const tokenStore = {
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  setTokens(accessToken: string, refreshToken: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
