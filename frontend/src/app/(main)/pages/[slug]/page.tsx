'use client';

import { use, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { PostFeed } from '@/components/webestica/PostFeed';
import type { CommunityPage } from '@/lib/types';

export default function PageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const [page, setPage] = useState<CommunityPage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<CommunityPage>(`/pages/${slug}`)
      .then(setPage)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function toggleFollow() {
    if (!page || busy) return;
    setBusy(true);
    const next = !page.isFollowing;
    setPage({ ...page, isFollowing: next, _count: { followers: page._count.followers + (next ? 1 : -1) } });
    try {
      await apiFetch(`/pages/${slug}/follow`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      load();
    } finally {
      setBusy(false);
    }
  }

  if (notFound) {
    return (
      <div className="card card-body text-center py-5">
        <p className="mb-0">Cette page est introuvable.</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  const isOwner = user?.username === page.owner.username;

  return (
    <div>
      <div className="card mb-4">
        <div className="h-100px bg-primary bg-opacity-10" />
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h4 className="mb-0">{page.name}</h4>
              {page.category && <small className="text-body-secondary d-block">{page.category}</small>}
              <small className="text-body-secondary">
                {page._count.followers} abonné{page._count.followers > 1 ? 's' : ''} · gérée par {page.owner.displayName}
              </small>
            </div>
            {user && !isOwner && (
              <button type="button" className={`btn btn-sm ${page.isFollowing ? 'btn-light' : 'btn-primary'}`} onClick={toggleFollow} disabled={busy}>
                {page.isFollowing ? 'Abonné·e' : 'Suivre'}
              </button>
            )}
            {isOwner && <span className="badge bg-light text-dark align-self-start">Vous gérez cette page</span>}
          </div>
          {page.description && <p className="mt-3 mb-0">{page.description}</p>}
        </div>
      </div>

      <PostFeed
        feedEndpoint={`/pages/${slug}/posts`}
        composerEndpoint={`/pages/${slug}/posts`}
        canPost={isOwner}
        emptyMessage="Aucune publication sur cette page pour l'instant."
      />
    </div>
  );
}
