'use client';

import { use, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { monthYear } from '@/lib/format';
import { ImageFieldUploader } from '@/components/webestica/ImageFieldUploader';
import { PostFeed } from '@/components/webestica/PostFeed';
import type { CommunityPage } from '@/lib/types';

type Tab = 'feed' | 'about';

export default function PageDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const [page, setPage] = useState<CommunityPage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('feed');
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
  const tabs: { id: Tab; label: string }[] = [
    { id: 'feed', label: 'Publications' },
    { id: 'about', label: 'À propos' },
  ];

  return (
    <div>
      <div className="card mb-4">
        <div
          className="h-200px rounded-top position-relative"
          style={{
            backgroundImage: page.coverUrl ? `url(${page.coverUrl})` : 'linear-gradient(135deg, var(--bs-primary), var(--bs-purple))',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          {isOwner && (
            <ImageFieldUploader
              endpoint={`/pages/${slug}`}
              field="coverKey"
              onUpdated={(coverUrl) => setPage((p) => p && { ...p, coverUrl })}
              className="btn btn-light btn-sm position-absolute bottom-0 end-0 m-2"
            >
              <i className="bi bi-camera-fill me-1" /> Changer la couverture
            </ImageFieldUploader>
          )}
        </div>
        <div className="card-body py-0">
          <div className="d-sm-flex align-items-start text-center text-sm-start">
            <div className="position-relative">
              <div className="avatar avatar-xxl mt-n5 mb-3">
                {page.avatarUrl ? (
                  <img className="avatar-img rounded-circle border border-white border-3" src={page.avatarUrl} alt={page.name} />
                ) : (
                  <span className="avatar-img rounded-circle border border-white border-3 bg-primary d-flex align-items-center justify-content-center text-white fw-bold fs-1">
                    {page.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              {isOwner && (
                <ImageFieldUploader
                  endpoint={`/pages/${slug}`}
                  field="avatarKey"
                  onUpdated={(avatarUrl) => setPage((p) => p && { ...p, avatarUrl })}
                  className="btn btn-light btn-sm rounded-circle icon-md p-0 position-absolute bottom-0 end-0"
                >
                  <i className="bi bi-camera-fill small" />
                </ImageFieldUploader>
              )}
            </div>
            <div className="ms-sm-4 mt-sm-3">
              <h1 className="mb-0 h5">{page.name}</h1>
              {page.category && <p className="mb-0 text-body-secondary">{page.category}</p>}
              <p className="small text-body-secondary mb-0 mt-1">
                {page._count.followers} abonné{page._count.followers > 1 ? 's' : ''} · gérée par {page.owner.displayName}
              </p>
            </div>

            <div className="d-flex gap-2 mt-3 justify-content-center ms-sm-auto">
              {user && !isOwner && (
                <button type="button" className={`btn ${page.isFollowing ? 'btn-light' : 'btn-primary'}`} onClick={toggleFollow} disabled={busy}>
                  {page.isFollowing ? 'Abonné·e' : 'Suivre'}
                </button>
              )}
              {isOwner && <span className="badge bg-light text-dark align-self-center">Tu gères cette page</span>}
            </div>
          </div>

          {page.description && <p className="mt-3 mb-0 pb-3">{page.description}</p>}
        </div>

        <div className="card-footer mt-1 pt-2 pb-0">
          <ul className="nav nav-bottom-line align-items-center justify-content-center justify-content-md-start mb-0 border-0">
            {tabs.map((t) => (
              <li className="nav-item" key={t.id}>
                <button type="button" className={`nav-link ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {tab === 'feed' && (
        <PostFeed
          feedEndpoint={`/pages/${slug}/posts`}
          composerEndpoint={`/pages/${slug}/posts`}
          canPost={isOwner}
          emptyMessage="Aucune publication sur cette page pour l'instant."
        />
      )}

      {tab === 'about' && (
        <div className="card">
          <div className="card-header border-0">
            <h5 className="card-title">À propos</h5>
          </div>
          <div className="card-body pt-0">
            {page.description ? <p>{page.description}</p> : <p className="text-body-secondary mb-0">Aucune description.</p>}
            <ul className="list-unstyled mt-3 mb-0">
              {page.category && (
                <li className="mb-2">
                  <i className="bi bi-tag fa-fw pe-1" /> Catégorie : <strong>{page.category}</strong>
                </li>
              )}
              <li className="mb-2">
                <i className="bi bi-person fa-fw pe-1" /> Gérée par : <strong>{page.owner.displayName}</strong>
              </li>
              <li>
                <i className="bi bi-calendar2-plus fa-fw pe-1" /> Créée en <strong>{monthYear(page.createdAt)}</strong>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
