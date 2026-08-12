'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { UserSummary } from '@/lib/types';

// Widget "Qui suivre" de la colonne latérale du fil — GET /users/suggestions renvoie quelques
// comptes actifs pas encore suivis (tri par inscription récente côté serveur, voir UsersService).
export function WhoToFollow() {
  const { user } = useAuth();
  const [items, setItems] = useState<UserSummary[] | null>(null);
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch<UserSummary[]>('/users/suggestions').then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function follow(username: string) {
    setFollowed((prev) => new Set(prev).add(username));
    try {
      await apiFetch(`/users/${username}/follow`, { method: 'POST' });
    } catch {
      setFollowed((prev) => {
        const next = new Set(prev);
        next.delete(username);
        return next;
      });
    }
  }

  if (!user || !items) return null;
  const visible = items.filter((p) => !followed.has(p.username));
  if (visible.length === 0) return null;

  return (
    <div className="card">
      <div className="card-header pb-0 border-0">
        <h5 className="card-title mb-0">Qui suivre</h5>
      </div>
      <div className="card-body">
        {visible.map((person) => (
          <div className="hstack gap-2 mb-3" key={person.username}>
            <div className="avatar">
              <Link href={`/profile/${person.username}`}>
                {person.avatarUrl ? (
                  <img className="avatar-img rounded-circle" src={person.avatarUrl} alt={person.displayName} />
                ) : (
                  <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold">
                    {person.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </Link>
            </div>
            <div className="overflow-hidden">
              <Link className="h6 mb-0 d-block text-truncate" href={`/profile/${person.username}`}>
                {person.displayName}
              </Link>
              <p className="mb-0 small text-truncate text-body-secondary">@{person.username}</p>
            </div>
            <button type="button" className="btn btn-primary-soft rounded-circle icon-md ms-auto flex-shrink-0" title="Suivre" onClick={() => follow(person.username)}>
              <i className="fa-solid fa-plus" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
