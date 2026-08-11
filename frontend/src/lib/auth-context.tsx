'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from './api-client';
import { tokenStore } from './token-store';
import type { Me } from './types';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: Me | null;
  // null tant qu'on n'a pas fini la vérification initiale (évite un flash "non connecté" au
  // premier rendu alors qu'un token valide existe déjà en localStorage).
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; username: string; password: string; displayName: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.getAccessToken() && !tokenStore.getRefreshToken()) {
      setUser(null);
      return;
    }
    try {
      const me = await apiFetch<Me>('/users/me');
      setUser(me);
    } catch {
      // Token absent/invalide/expiré et refresh impossible : apiFetch a déjà nettoyé le storage.
      setUser(null);
    }
  }, []);

  useEffect(() => {
    // Patron standard "vérifier la session au montage" ; voir le commentaire équivalent dans
    // app/(main)/page.tsx à propos de react-hooks/set-state-in-effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
    tokenStore.setTokens(res.accessToken, res.refreshToken);
    await refreshUser();
  }, [refreshUser]);

  const register = useCallback(
    async (input: { email: string; username: string; password: string; displayName: string }) => {
      const res = await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: input });
      tokenStore.setTokens(res.accessToken, res.refreshToken);
      await refreshUser();
    },
    [refreshUser],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // On nettoie le storage local même si l'appel serveur échoue (session déjà expirée, etc.) —
      // l'utilisateur s'attend à être déconnecté localement dans tous les cas.
    }
    tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous AuthProvider');
  return ctx;
}

export { ApiError };
