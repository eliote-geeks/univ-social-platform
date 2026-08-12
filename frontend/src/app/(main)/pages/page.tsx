'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { CommunityPage, Paginated } from '@/lib/types';

export default function PagesListPage() {
  const { user } = useAuth();
  const [pages, setPages] = useState<CommunityPage[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  function load(query?: string) {
    setPages(null);
    const qs = query ? `?q=${encodeURIComponent(query)}` : '';
    apiFetch<Paginated<CommunityPage>>(`/pages${qs}`).then((page) => {
      setPages(page.items);
      setCursor(page.nextCursor);
    });
  }

  useEffect(() => {
    // Patron standard "fetch au montage" — voir le commentaire équivalent dans lib/auth-context.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    load(q.trim() || undefined);
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const qs = q.trim() ? `q=${encodeURIComponent(q.trim())}&` : '';
      const page = await apiFetch<Paginated<CommunityPage>>(`/pages?${qs}cursor=${encodeURIComponent(cursor)}`);
      setPages((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <form className="d-flex flex-grow-1 me-3" onSubmit={onSearch}>
          <input className="form-control" placeholder="Rechercher une page…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {user && (
          <Link href="/pages/new" className="btn btn-primary text-nowrap">
            <i className="bi bi-plus-lg me-1" /> Créer une page
          </Link>
        )}
      </div>

      {pages === null && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {pages?.length === 0 && (
        <div className="card card-body text-center py-5">
          <p className="mb-0">Aucune page pour l&apos;instant.</p>
        </div>
      )}

      <div className="row g-3">
        {pages?.map((p) => (
          <div className="col-md-6" key={p.id}>
            <div className="card h-100">
              <div className="card-body">
                <Link href={`/pages/${p.slug}`} className="h6 mb-0 d-block">
                  {p.name}
                </Link>
                {p.category && <small className="text-body-secondary">{p.category}</small>}
                <p className="small mt-2 mb-1">{p._count.followers} abonné{p._count.followers > 1 ? 's' : ''}</p>
                {p.description && <p className="small mb-0">{p.description}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {cursor && (
        <div className="text-center mt-4">
          <button type="button" className="btn btn-light" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Chargement…' : 'Voir plus'}
          </button>
        </div>
      )}
    </div>
  );
}
