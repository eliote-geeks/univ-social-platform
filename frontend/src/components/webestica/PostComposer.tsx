'use client';

import { useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { mediaTypeForFile, uploadMedia } from '@/lib/media-upload';
import type { Post } from '@/lib/types';

export function PostComposer({ onCreated }: { onCreated: (post: Post) => void }) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  function onPickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    setError(null);
    if (picked && !mediaTypeForFile(picked)) {
      setError('Format non pris en charge (images JPEG/PNG/WebP ou vidéos MP4/WebM uniquement)');
      return;
    }
    setFile(picked);
    setPreview(picked ? URL.createObjectURL(picked) : null);
  }

  function clearFile() {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() && !file) return;
    setError(null);
    setSubmitting(true);
    try {
      const media: { type: 'IMAGE' | 'VIDEO'; key: string }[] = [];
      if (file) {
        const type = mediaTypeForFile(file)!;
        const key = await uploadMedia(file, type);
        media.push({ type, key });
      }
      const post = await apiFetch<Post>('/posts', { method: 'POST', body: { body: body.trim() || undefined, media: media.length ? media : undefined } });
      onCreated(post);
      setBody('');
      clearFile();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de publier, réessaie");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card mb-4">
      <div className="card-body">
        <form onSubmit={onSubmit}>
          <div className="d-flex">
            <div className="avatar avatar-sm me-3 flex-shrink-0">
              {user.avatarUrl ? (
                <img className="avatar-img rounded-circle" src={user.avatarUrl} alt={user.displayName} />
              ) : (
                <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <textarea
              className="form-control border-0 bg-light"
              rows={2}
              placeholder="Quoi de neuf sur le campus ?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={5000}
            />
          </div>

          {preview && (
            <div className="mt-3 position-relative d-inline-block">
              {file?.type.startsWith('video') ? (
                <video className="rounded" style={{ maxHeight: 220 }} src={preview} controls />
              ) : (
                <img className="rounded" style={{ maxHeight: 220 }} src={preview} alt="Aperçu" />
              )}
              <button type="button" className="btn btn-sm btn-danger-soft position-absolute top-0 end-0 m-1" onClick={clearFile}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
          )}

          {error && <div className="alert alert-danger py-2 mt-3 mb-0">{error}</div>}

          <div className="d-flex justify-content-between align-items-center mt-3">
            <label className="btn btn-light btn-sm mb-0">
              <i className="bi bi-image me-1" /> Photo/Vidéo
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" hidden onChange={onPickFile} />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || (!body.trim() && !file)}>
              {submitting ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
