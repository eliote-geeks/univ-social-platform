'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { CommunityPage } from '@/lib/types';

export default function NewCommunityPagePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const page = await apiFetch<CommunityPage>('/pages', {
        method: 'POST',
        body: { name: name.trim(), category: category.trim() || undefined, description: description.trim() || undefined },
      });
      router.push(`/pages/${page.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer la page');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="mb-0">Créer une page</h5>
      </div>
      <div className="card-body">
        <form onSubmit={onSubmit}>
          <div className="mb-3">
            <label className="form-label">Nom de la page</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} />
          </div>
          <div className="mb-3">
            <label className="form-label">Catégorie</label>
            <input className="form-control" placeholder="Ex : Association étudiante" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} />
          </div>

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={submitting || !name.trim()}>
            {submitting ? 'Création…' : 'Créer la page'}
          </button>
        </form>
      </div>
    </div>
  );
}
