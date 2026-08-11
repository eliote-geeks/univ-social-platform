'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError, useAuth } from '@/lib/auth-context';

export default function SignInPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible, réessaie');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card card-body text-center p-4 p-sm-5">
      <h1 className="mb-2">Connexion</h1>
      <p className="mb-0">
        Pas encore de compte ?<Link href="/sign-up"> Crée-en un</Link>
      </p>
      <form className="mt-sm-4" onSubmit={onSubmit}>
        <div className="mb-3 input-group-lg">
          <input
            type="email"
            className="form-control"
            placeholder="Adresse e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>
        <div className="mb-3 position-relative">
          <div className="input-group input-group-lg">
            <input
              className="form-control"
              type={showPassword ? 'text' : 'password'}
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <span className="input-group-text p-0 cursor-pointer" onClick={() => setShowPassword((v) => !v)}>
              <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'} p-2 w-40px`} />
            </span>
          </div>
        </div>

        {error && <div className="alert alert-danger py-2">{error}</div>}

        <div className="d-grid">
          <button type="submit" className="btn btn-lg btn-primary" disabled={submitting}>
            {submitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>
        <p className="mb-0 mt-3">Réseau social universitaire</p>
      </form>
    </div>
  );
}
