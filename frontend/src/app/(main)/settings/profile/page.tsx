'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { uploadMedia } from '@/lib/media-upload';
import type { Me } from '@/lib/types';

export default function SettingsProfilePage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) router.replace('/sign-in');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- voir lib/auth-context.tsx
      setDisplayName(user.displayName);
      setBio(user.bio ?? '');
    }
  }, [user]);

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAvatarFile(file);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }

  function pickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const avatarKey = avatarFile ? await uploadMedia(avatarFile, 'IMAGE', 'avatar') : undefined;
      const coverKey = coverFile ? await uploadMedia(coverFile, 'IMAGE', 'cover') : undefined;
      await apiFetch<Me>('/users/me', {
        method: 'PATCH',
        body: { displayName: displayName.trim(), bio: bio.trim(), avatarKey, coverKey },
      });
      await refreshUser();
      router.push(`/profile/${user!.username}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible d’enregistrer les modifications');
      setSubmitting(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Modifier le profil</h5>
      </div>
      <div className="card-body">
        <form onSubmit={onSubmit}>
          <label className="form-label">Photo de couverture</label>
          <div
            className="h-150px rounded mb-3 position-relative"
            style={{
              backgroundImage: `url(${coverPreview ?? user.coverUrl ?? ''})`,
              backgroundColor: 'var(--bs-tertiary-bg)',
              backgroundPosition: 'center',
              backgroundSize: 'cover',
            }}
          >
            <button type="button" className="btn btn-light btn-sm position-absolute bottom-0 end-0 m-2" onClick={() => coverInputRef.current?.click()}>
              <i className="bi bi-camera-fill me-1" /> Changer
            </button>
            <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickCover} />
          </div>

          <label className="form-label">Photo de profil</label>
          <div className="d-flex align-items-center gap-3 mb-4">
            <div className="avatar avatar-xl">
              {avatarPreview || user.avatarUrl ? (
                <img className="avatar-img rounded-circle border" src={avatarPreview ?? user.avatarUrl ?? ''} alt="" />
              ) : (
                <span className="avatar-img rounded-circle border bg-primary d-flex align-items-center justify-content-center text-white fw-bold fs-4">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <button type="button" className="btn btn-light btn-sm" onClick={() => avatarInputRef.current?.click()}>
              <i className="bi bi-camera-fill me-1" /> Changer
            </button>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pickAvatar} />
          </div>

          <div className="mb-3">
            <label className="form-label">Nom affiché</label>
            <input className="form-control" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} maxLength={80} />
          </div>
          <div className="mb-3">
            <label className="form-label">Bio</label>
            <textarea className="form-control" rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="Parle un peu de toi…" />
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={submitting || !displayName.trim()}>
            {submitting ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </form>
      </div>
    </div>
  );
}
