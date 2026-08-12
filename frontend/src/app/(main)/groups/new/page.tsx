'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { Group, GroupVisibility } from '@/lib/types';

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<GroupVisibility>('PUBLIC');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const group = await apiFetch<Group>('/groups', { method: 'POST', body: { name: name.trim(), description: description.trim() || undefined, visibility } });
      router.push(`/groups/${group.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer le groupe');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Créer un groupe</h5>
      </div>
      <div className="card-body">
        <form onSubmit={onSubmit}>
          <div className="mb-3">
            <label className="form-label">Nom du groupe</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          </div>
          <div className="mb-3">
            <label className="form-label d-block">Visibilité</label>
            <div className="form-check form-check-inline">
              <input className="form-check-input" type="radio" id="vis-public" checked={visibility === 'PUBLIC'} onChange={() => setVisibility('PUBLIC')} />
              <label className="form-check-label" htmlFor="vis-public">Public — tout le monde peut voir et rejoindre</label>
            </div>
            <div className="form-check form-check-inline">
              <input className="form-check-input" type="radio" id="vis-private" checked={visibility === 'PRIVATE'} onChange={() => setVisibility('PRIVATE')} />
              <label className="form-check-label" htmlFor="vis-private">Privé — sur invitation uniquement</label>
            </div>
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
            {submitting ? 'Création…' : 'Créer le groupe'}
          </button>
        </form>
      </div>
    </div>
  );
}
