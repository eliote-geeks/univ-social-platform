'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, useAuth } from '@/lib/auth-context';
import { USERNAME_PATTERN } from '@/lib/config';

export default function SignUpPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!USERNAME_PATTERN.test(username)) {
      setError("L'identifiant doit faire 3 à 30 caractères : lettres minuscules, chiffres, underscore uniquement");
      return;
    }
    if (password.length < 10) {
      setError('Le mot de passe doit faire au moins 10 caractères');
      return;
    }

    setSubmitting(true);
    try {
      await register({ email, username, password, displayName });
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Inscription impossible, réessaie');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card card-body text-center p-4 p-sm-5">
      <h1 className="mb-2">Créer un compte</h1>
      <p className="mb-0">
        Déjà inscrit·e ?<Link href="/sign-in"> Connecte-toi</Link>
      </p>
      <form className="mt-sm-4 text-start" onSubmit={onSubmit}>
        <div className="mb-3">
          <label className="form-label">Nom affiché</label>
          <input
            type="text"
            className="form-control form-control-lg"
            placeholder="Ex : Awa Ndiaye"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Identifiant</label>
          <input
            type="text"
            className="form-control form-control-lg"
            placeholder="ex : awa_ndiaye"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
            pattern="[a-z0-9_]{3,30}"
            title="3 à 30 caractères : lettres minuscules, chiffres, underscore"
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Adresse e-mail</label>
          <input
            type="email"
            className="form-control form-control-lg"
            placeholder="Entre ton e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Mot de passe</label>
          <input
            type="password"
            className="form-control form-control-lg"
            placeholder="Au moins 10 caractères"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="d-grid">
          <button type="submit" className="btn btn-lg btn-primary" disabled={submitting}>
            {submitting ? 'Création…' : 'Créer mon compte'}
          </button>
        </div>
      </form>
    </div>
  );
}
