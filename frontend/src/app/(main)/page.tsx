'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { PostComposer } from '@/components/webestica/PostComposer';
import { PostCard } from '@/components/webestica/PostCard';
import type { Paginated, Post } from '@/lib/types';

export default function FeedPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await apiFetch<Paginated<Post>>('/feed');
      setPosts(page.items);
      setCursor(page.nextCursor);
    } catch {
      setError('Impossible de charger le fil pour le moment');
    }
  }, []);

  useEffect(() => {
    // react-hooks/set-state-in-effect (règle expérimentale du React Compiler) signale tout appel
    // à une fonction qui finit par appeler setState, même après un await — ce qui interdit de
    // fait le patron standard "fetch au montage". next build n'applique pas cette règle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFirstPage();
  }, [loadFirstPage]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<Paginated<Post>>(`/feed?cursor=${encodeURIComponent(cursor)}`);
      setPosts((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      setError('Impossible de charger la suite du fil');
    } finally {
      setLoadingMore(false);
    }
  }

  function onCreated(post: Post) {
    setPosts((prev) => [post, ...(prev ?? [])]);
  }

  return (
    <div>
      {user && <PostComposer onCreated={onCreated} />}

      {error && <div className="alert alert-danger">{error}</div>}

      {posts === null && !error && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {posts?.length === 0 && (
        <div className="card card-body text-center py-5">
          <p className="mb-0">Aucune publication pour l&apos;instant. Sois le premier à publier !</p>
        </div>
      )}

      {posts?.map((post) => <PostCard key={post.id} post={post} />)}

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
