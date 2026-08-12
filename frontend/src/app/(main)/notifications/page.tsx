'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { relativeTime } from '@/lib/format';
import type { AppNotification, Paginated } from '@/lib/types';

const LABELS: Record<AppNotification['type'], (n: AppNotification) => string> = {
  REACTION: () => 'a réagi à votre publication',
  COMMENT: () => 'a commenté votre publication',
  FOLLOW: () => 'a commencé à vous suivre',
  MENTION: () => "vous a mentionné·e",
};

function targetHref(n: AppNotification): string | null {
  if (n.postId) return `/posts/${n.postId}`;
  return null;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<Paginated<AppNotification>>('/notifications').then((page) => {
      if (cancelled) return;
      setItems(page.items);
      setCursor(page.nextCursor);
    });
    // Vues à l'instant où la page est consultée : on marque tout comme lu côté serveur pour que
    // le badge de la navbar redescende à zéro, sans attendre un clic par notification.
    apiFetch('/notifications/read-all', { method: 'PATCH' }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<Paginated<AppNotification>>(`/notifications?cursor=${encodeURIComponent(cursor)}`);
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
        <p className="mb-0">Aucune notification pour l&apos;instant.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Notifications</h5>
      </div>
      <ul className="list-group list-group-flush">
        {items.map((n) => {
          const href = targetHref(n);
          const content = (
            <div className="d-flex align-items-center">
              <div className="avatar me-3 flex-shrink-0">
                {n.actor.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- domaine MinIO dynamique
                  <img className="avatar-img rounded-circle" src={n.actor.avatarUrl} alt={n.actor.displayName} />
                ) : (
                  <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold">
                    {n.actor.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-grow-1">
                <p className="mb-0">
                  <strong>{n.actor.displayName}</strong> {LABELS[n.type](n)}
                </p>
                <small className="text-body-secondary">{relativeTime(n.createdAt)}</small>
              </div>
              {!n.readAt && <span className="badge bg-primary rounded-circle p-1 ms-2" style={{ width: 10, height: 10 }} />}
            </div>
          );
          return (
            <li key={n.id} className="list-group-item">
              {href ? (
                <Link href={href} className="text-reset text-decoration-none">
                  {content}
                </Link>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
      {cursor && (
        <div className="card-footer text-center">
          <button type="button" className="btn btn-light btn-sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Chargement…' : 'Voir plus'}
          </button>
        </div>
      )}
    </div>
  );
}
