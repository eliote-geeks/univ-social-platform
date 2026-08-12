'use client';

// Partagé entre le layout (qui charge le profil une seule fois et gère le suivi) et les onglets
// enfants (Publications/À propos/Abonnés/Abonnements), pour éviter de refaire l'appel API à
// chaque changement d'onglet — le layout persiste entre les navigations des enfants.
import { createContext, useContext } from 'react';
import type { PublicProfile } from '@/lib/types';

export const ProfileContext = createContext<{ profile: PublicProfile; username: string } | null>(null);

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfileContext doit être utilisé sous profile/[username]/layout');
  return ctx;
}
