'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { Event } from '@/lib/types';

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const event = await apiFetch<Event>('/events', {
        method: 'POST',
        body: {
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          onlineUrl: onlineUrl.trim() || undefined,
          startAt: new Date(startAt).toISOString(),
          endAt: endAt ? new Date(endAt).toISOString() : undefined,
        },
      });
      router.push(`/events/${event.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de créer l'événement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Créer un événement</h5>
      </div>
      <div className="card-body">
        <form onSubmit={onSubmit}>
          <div className="mb-3">
            <label className="form-label">Titre</label>
            <input className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={150} />
          </div>
          <div className="row">
            <div className="col-sm-6 mb-3">
              <label className="form-label">Début</label>
              <input type="datetime-local" className="form-control" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </div>
            <div className="col-sm-6 mb-3">
              <label className="form-label">Fin (optionnel)</label>
              <input type="datetime-local" className="form-control" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
            </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Lieu</label>
            <input className="form-control" placeholder="Ex : Amphi A" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={250} />
          </div>
          <div className="mb-3">
            <label className="form-label">Lien en ligne (optionnel)</label>
            <input type="url" className="form-control" placeholder="https://…" value={onlineUrl} onChange={(e) => setOnlineUrl(e.target.value)} />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={3000} />
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={submitting || !title.trim() || !startAt}>
            {submitting ? 'Création…' : "Créer l'événement"}
          </button>
        </form>
      </div>
    </div>
  );
}
