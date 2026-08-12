'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { mediaTypeForFile, uploadMedia } from '@/lib/media-upload';
import type { Post } from '@/lib/types';

// endpoint : /posts par défaut (fil personnel), ou /groups/:slug/posts /pages/:slug/posts pour
// publier dans le contexte d'un groupe/d'une page (même DTO, seule la route change).
export function PostComposer({ onCreated, endpoint = '/posts', placeholder }: { onCreated: (post: Post) => void; endpoint?: string; placeholder?: string }) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

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
    if (videoInputRef.current) videoInputRef.current.value = '';
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
      const post = await apiFetch<Post>(endpoint, { method: 'POST', body: { body: body.trim() || undefined, media: media.length ? media : undefined } });
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
              placeholder={placeholder ?? 'Quoi de neuf sur le campus ?'}
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
            <ul className="nav nav-pills nav-stack small fw-normal mb-0">
              <li className="nav-item">
                <label className="nav-link bg-light py-1 px-2 mb-0 cursor-pointer">
                  <i className="bi bi-image-fill text-success pe-2" />
                  Photo
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPickFile} />
                </label>
              </li>
              <li className="nav-item">
                <label className="nav-link bg-light py-1 px-2 mb-0 cursor-pointer">
                  <i className="bi bi-camera-reels-fill text-info pe-2" />
                  Vidéo
                  <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" hidden onChange={onPickFile} />
                </label>
              </li>
              <li className="nav-item">
                <Link className="nav-link bg-light py-1 px-2 mb-0" href="/events/new">
                  <i className="bi bi-calendar2-event-fill text-danger pe-2" />
                  Événement
                </Link>
              </li>
            </ul>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || (!body.trim() && !file)}>
              {submitting ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
