'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Group, Paginated } from '@/lib/types';

export default function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);

  function load(query?: string) {
    setGroups(null);
    const qs = query ? `?q=${encodeURIComponent(query)}` : '';
    apiFetch<Paginated<Group>>(`/groups${qs}`).then((page) => {
      setGroups(page.items);
      setCursor(page.nextCursor);
    });
  }

  useEffect(() => {
    // Patron standard "fetch au montage" — voir le commentaire équivalent dans lib/auth-context.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
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
      const page = await apiFetch<Paginated<Group>>(`/groups?${qs}cursor=${encodeURIComponent(cursor)}`);
      setGroups((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function joinGroup(slug: string) {
    await apiFetch(`/groups/${slug}/join`, { method: 'POST' });
    load(q.trim() || undefined);
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <form className="d-flex flex-grow-1 me-3" onSubmit={onSearch}>
          <input className="form-control" placeholder="Rechercher un groupe…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        {user && (
          <Link href="/groups/new" className="btn btn-primary text-nowrap">
            <i className="bi bi-plus-lg me-1" /> Créer un groupe
          </Link>
        )}
      </div>

      {groups === null && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {groups?.length === 0 && (
        <div className="card card-body text-center py-5">
          <p className="mb-0">Aucun groupe pour l&apos;instant.</p>
        </div>
      )}

      <div className="row g-3">
        {groups?.map((g) => (
          <div className="col-md-6" key={g.id}>
            <div className="card h-100">
              <div className="h-50px bg-primary bg-opacity-10" />
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <Link href={`/groups/${g.slug}`} className="h6 mb-0 d-block">
                      {g.name} {g.visibility === 'PRIVATE' && <i className="bi bi-lock-fill small text-body-secondary" />}
                    </Link>
                    <small className="text-body-secondary">{g._count.members} membre{g._count.members > 1 ? 's' : ''}</small>
                  </div>
                  {user && g.myRole === null && g.visibility === 'PUBLIC' && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => joinGroup(g.slug)}>
                      Rejoindre
                    </button>
                  )}
                  {g.myRole !== null && <span className="badge bg-light text-dark">Membre</span>}
                </div>
                {g.description && <p className="small mt-2 mb-0">{g.description}</p>}
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
