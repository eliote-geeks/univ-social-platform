import { API_BASE_URL } from './config';
import { tokenStore } from './token-store';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  // Sur les endpoints publics (GET /feed, GET /groups...), on veut quand même joindre le token
  // s'il est présent (réponse différente pour un visiteur connecté) mais ne jamais échouer si
  // le refresh échoue — d'où ce flag qui désactive la déconnexion automatique en cas de 401.
  optionalAuth?: boolean;
};

// Un seul refresh en vol à la fois : si plusieurs requêtes se prennent un 401 en parallèle, elles
// partagent la même promesse plutôt que de déclencher N appels /auth/refresh concurrents (ce qui
// invaliderait mutuellement leurs sessions, cf. rotation de refresh token côté backend).
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore.getRefreshToken();
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        tokenStore.setTokens(data.accessToken, data.refreshToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const doFetch = async (): Promise<Response> => {
    const token = tokenStore.getAccessToken();
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  };

  let response = await doFetch();

  if (response.status === 401 && tokenStore.getRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await doFetch();
    } else if (!options.optionalAuth) {
      tokenStore.clear();
    }
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const message = data?.message ? (Array.isArray(data.message) ? data.message[0] : data.message) : `Erreur ${response.status}`;
    throw new ApiError(response.status, message);
  }

  return data as T;
}
