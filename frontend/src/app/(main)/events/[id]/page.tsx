'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { Event, EventRsvpStatus } from '@/lib/types';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const RSVP_LABELS: Record<EventRsvpStatus, string> = { GOING: 'Je participe', INTERESTED: 'Intéressé·e', NOT_GOING: "Je n'y vais pas" };

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  function load() {
    apiFetch<Event>(`/events/${id}`)
      .then(setEvent)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function rsvp(status: EventRsvpStatus) {
    setBusy(true);
    try {
      await apiFetch(`/events/${id}/rsvp`, { method: 'POST', body: { status } });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function cancelRsvp() {
    setBusy(true);
    try {
      await apiFetch(`/events/${id}/rsvp`, { method: 'DELETE' });
      load();
    } finally {
      setBusy(false);
    }
  }

  async function removeEvent() {
    if (!confirm("Supprimer cet événement ?")) return;
    await apiFetch(`/events/${id}`, { method: 'DELETE' });
    router.push('/events');
  }

  if (notFound) {
    return (
      <div className="card card-body text-center py-5">
        <p className="mb-0">Cet événement est introuvable.</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  const isOrganizer = user?.username === event.createdBy.username;

  return (
    <div className="card">
      <div className="h-100px bg-primary bg-opacity-10" />
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div>
            <h4 className="mb-1">{event.title}</h4>
            <p className="mb-0"><i className="bi bi-calendar-event me-2" />{formatDate(event.startAt)}</p>
            {event.location && <p className="mb-0"><i className="bi bi-geo-alt me-2" />{event.location}</p>}
            {event.onlineUrl && (
              <p className="mb-0">
                <i className="bi bi-link-45deg me-2" />
                <a href={event.onlineUrl} target="_blank" rel="noreferrer">{event.onlineUrl}</a>
              </p>
            )}
            {(event.group || event.page) && (
              <p className="mb-0 small text-body-secondary">
                Organisé par{' '}
                {event.group ? <Link href={`/groups/${event.group.slug}`}>{event.group.name}</Link> : <Link href={`/pages/${event.page!.slug}`}>{event.page!.name}</Link>}
              </p>
            )}
            <small className="text-body-secondary">Créé par {event.createdBy.displayName} · {event._count.attendees} participant{event._count.attendees > 1 ? 's' : ''}</small>
          </div>
          {isOrganizer && (
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={removeEvent}>
              Supprimer
            </button>
          )}
        </div>

        {event.description && <p className="mt-3">{event.description}</p>}

        {user && (
          <div className="d-flex gap-2 mt-3 pt-3 border-top flex-wrap">
            {(['GOING', 'INTERESTED', 'NOT_GOING'] as EventRsvpStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                className={`btn btn-sm ${event.myStatus === status ? 'btn-primary' : 'btn-light'}`}
                onClick={() => rsvp(status)}
                disabled={busy}
              >
                {RSVP_LABELS[status]}
              </button>
            ))}
            {event.myStatus && (
              <button type="button" className="btn btn-sm btn-link text-danger" onClick={cancelRsvp} disabled={busy}>
                Retirer ma réponse
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
