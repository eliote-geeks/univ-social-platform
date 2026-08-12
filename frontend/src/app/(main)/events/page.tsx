'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Event, Paginated } from '@/lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    apiFetch<Paginated<Event>>('/events').then((page) => {
      setEvents(page.items);
      setCursor(page.nextCursor);
    });
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<Paginated<Event>>(`/events?cursor=${encodeURIComponent(cursor)}`);
      setEvents((prev) => [...(prev ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="mb-0">Événements à venir</h5>
        {user && (
          <Link href="/events/new" className="btn btn-primary">
            <i className="bi bi-plus-lg me-1" /> Créer un événement
          </Link>
        )}
      </div>

      {events === null && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {events?.length === 0 && (
        <div className="card card-body text-center py-5">
          <p className="mb-0">Aucun événement prévu pour l&apos;instant.</p>
        </div>
      )}

      <div className="row g-3">
        {events?.map((ev) => (
          <div className="col-md-6" key={ev.id}>
            <Link href={`/events/${ev.id}`} className="text-reset text-decoration-none">
              <div className="card h-100">
                <div className="card-body">
                  <span className="badge bg-primary-soft text-primary mb-2">{formatDate(ev.startAt)}</span>
                  <h6 className="mb-1">{ev.title}</h6>
                  {ev.location && <small className="text-body-secondary d-block"><i className="bi bi-geo-alt me-1" />{ev.location}</small>}
                  {(ev.group || ev.page) && (
                    <small className="text-body-secondary d-block">{ev.group?.name ?? ev.page?.name}</small>
                  )}
                  <p className="small mt-2 mb-0">{ev._count.attendees} participant{ev._count.attendees > 1 ? 's' : ''}</p>
                </div>
              </div>
            </Link>
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
