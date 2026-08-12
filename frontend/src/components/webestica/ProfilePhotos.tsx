'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useLightbox } from '@/lib/use-lightbox';
import type { Paginated, Post } from '@/lib/types';

// Widget de la colonne latérale du profil : reprend les images des dernières publications de la
// personne (pas d'entité "album" séparée dans le modèle de données — voir project_univsocial).
// data-glightbox ouvre la visionneuse plein écran portée depuis le thème (useLightbox).
export function ProfilePhotos({ username }: { username: string }) {
  const [photos, setPhotos] = useState<{ id: string; url: string; alt: string }[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Paginated<Post>>(`/users/${username}/posts`).then((page) => {
      if (cancelled) return;
      const found = page.items
        .flatMap((post) => post.media.filter((m) => m.type === 'IMAGE').map((m) => ({ id: m.id, url: m.url, alt: m.altText ?? '' })))
        .slice(0, 6);
      setPhotos(found);
    });
    return () => {
      cancelled = true;
    };
  }, [username]);

  useLightbox('.profile-photo-link', [photos]);

  if (photos !== null && photos.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header border-0">
        <h5 className="card-title">Photos</h5>
      </div>
      <div className="card-body position-relative pt-0">
        {photos === null ? (
          <div className="text-center py-3">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
          </div>
        ) : (
          <div className="row g-2">
            {photos.map((photo) => (
              <div className="col-4" key={photo.id}>
                <a className="profile-photo-link" href={photo.url} data-glightbox="" data-gallery="profile-photos">
                  {/* eslint-disable-next-line @next/next/no-img-element -- domaine MinIO dynamique */}
                  <img className="rounded w-100" src={photo.url} alt={photo.alt} style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
