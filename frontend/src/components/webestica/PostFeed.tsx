'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { PostCard } from './PostCard';
import { PostComposer } from './PostComposer';
import type { Paginated, Post } from '@/lib/types';

// Fil générique paramétré par l'endpoint : réutilisé pour le fil personnel (/feed), un groupe
// (/groups/:slug/posts) ou une page (/pages/:slug/posts) — même pagination par curseur partout.
export function PostFeed({ feedEndpoint, composerEndpoint, canPost, emptyMessage }: { feedEndpoint: string; composerEndpoint?: string; canPost: boolean; emptyMessage: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Pas de setPosts(null) synchrone ici (affiche l'ancien fil jusqu'à l'arrivée du nouveau au
    // lieu d'un flash de spinner) — voir le commentaire équivalent sur la page profil.
    let cancelled = false;
    apiFetch<Paginated<Post>>(feedEndpoint)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le fil pour le moment');
      });
    return () => {
      cancelled = true;
    };
  }, [feedEndpoint]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const sep = feedEndpoint.includes('?') ? '&' : '?';
      const page = await apiFetch<Paginated<Post>>(`${feedEndpoint}${sep}cursor=${encodeURIComponent(cursor)}`);
      setPosts((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      {canPost && <PostComposer endpoint={composerEndpoint} onCreated={(post) => setPosts((prev) => [post, ...(prev ?? [])])} />}

      {error && <div className="alert alert-danger">{error}</div>}

      {posts === null && !error && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {posts?.length === 0 && (
        <div className="card card-body text-center py-5">
          <p className="mb-0">{emptyMessage}</p>
        </div>
      )}

      {posts?.map((post) => (
        <PostCard key={post.id} post={post} onDeleted={(id) => setPosts((prev) => prev?.filter((p) => p.id !== id) ?? prev)} />
      ))}

      {cursor && (
        <div className="text-center mb-4">
          <button type="button" className="btn btn-light" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Chargement…' : 'Voir plus'}
          </button>
        </div>
      )}
    </div>
  );
}
