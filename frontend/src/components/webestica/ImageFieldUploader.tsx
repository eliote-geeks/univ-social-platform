'use client';

import { useRef, useState, type ReactNode } from 'react';
import { apiFetch } from '@/lib/api-client';
import { uploadMedia } from '@/lib/media-upload';

// Bouton d'upload compact réutilisé pour la couverture d'un groupe et l'avatar/couverture d'une
// page (le profil utilisateur a son propre écran de réglages dédié, plus riche). `field` pilote
// à la fois le purpose d'upload et le nom de la clé envoyée au PATCH ; `endpoint` reçoit la
// réponse mise à jour dont on extrait `avatarUrl`/`coverUrl` pour prévenir l'appelant.
export function ImageFieldUploader({
  endpoint,
  field,
  onUpdated,
  className,
  children,
}: {
  endpoint: string;
  field: 'avatarKey' | 'coverKey';
  onUpdated: (url: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const urlField = field === 'avatarKey' ? 'avatarUrl' : 'coverUrl';

  async function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const key = await uploadMedia(file, 'IMAGE', field === 'avatarKey' ? 'avatar' : 'cover');
      const updated = await apiFetch<Record<string, unknown>>(endpoint, { method: 'PATCH', body: { [field]: key } });
      const url = updated[urlField];
      if (typeof url === 'string') onUpdated(url);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? '…' : children}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />
    </>
  );
}
