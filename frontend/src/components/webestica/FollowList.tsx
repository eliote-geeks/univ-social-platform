'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import type { Paginated, UserSummary } from '@/lib/types';

// Grille de personnes (abonnés/abonnements) — reprend le patron "Friends" du thème (cartes en
// grille avec avatar + nom), sans les actions "Retirer"/"Envoyer un message" en survol qui
// n'ont pas d'équivalent réel ici (pas de notion d'ami, seulement suivi).
export function FollowList({ endpoint, emptyMessage }: { endpoint: string; emptyMessage: string }) {
  const [items, setItems] = useState<UserSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Paginated<UserSummary>>(endpoint).then((page) => {
      if (cancelled) return;
      setItems(page.items);
      setCursor(page.nextCursor);
    });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const page = await apiFetch<Paginated<UserSummary>>(`${endpoint}${sep}cursor=${encodeURIComponent(cursor)}`);
      setItems((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  if (items === null) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="card card-body text-center py-5">
        <p className="mb-0">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="row g-3">
        {items.map((person) => (
          <div className="col-6 col-md-4 col-xl-3" key={person.username}>
            <div className="card shadow-none text-center h-100">
              <div className="card-body p-3">
                <div className="avatar avatar-xl">
                  {person.avatarUrl ? (
                    <img className="avatar-img rounded-circle" src={person.avatarUrl} alt={person.displayName} />
                  ) : (
                    <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold fs-4">
                      {person.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <h6 className="card-title mb-0 mt-3">
                  <Link href={`/profile/${person.username}`}>{person.displayName}</Link>
                </h6>
                <p className="mb-0 small text-body-secondary">@{person.username}</p>
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
