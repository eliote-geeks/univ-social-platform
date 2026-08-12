'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { use, useEffect, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { monthYear } from '@/lib/format';
import type { PublicProfile } from '@/lib/types';
import { ProfileContext } from './profile-context';

// En-tête + onglets communs à tous les sous-écrans du profil (Publications/À propos/Abonnés/
// Abonnements) : ce layout persiste entre leurs navigations, donc le profil n'est chargé qu'une
// fois par visite plutôt qu'à chaque changement d'onglet.
export default function ProfileLayout({ children, params }: { children: ReactNode; params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const pathname = usePathname();
  const router = useRouter();
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Pas de reset synchrone (setProfile(null) direct) en tête d'effet — voir le commentaire
    // équivalent dans PostFeed.tsx. Le flag `cancelled` évite d'appliquer une réponse tardive si
    // `username` change de nouveau entre-temps (navigation vers un autre profil).
    let cancelled = false;
    apiFetch<PublicProfile>(`/users/${username}`)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setNotFound(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [username]);

  async function toggleFollow() {
    if (!profile || followPending) return;
    setFollowPending(true);
    const next = !profile.isFollowing;
    setProfile({ ...profile, isFollowing: next, _count: { ...profile._count, followers: profile._count.followers + (next ? 1 : -1) } });
    try {
      if (next) {
        await apiFetch(`/users/${username}/follow`, { method: 'POST' });
      } else {
        await apiFetch(`/users/${username}/follow`, { method: 'DELETE' });
      }
    } catch {
      setProfile((prev) => prev && { ...prev, isFollowing: !next, _count: { ...prev._count, followers: prev._count.followers + (next ? -1 : 1) } });
    } finally {
      setFollowPending(false);
    }
  }

  async function startConversation() {
    try {
      const conv = await apiFetch<{ id: string }>('/messaging/conversations', { method: 'POST', body: { username } });
      router.push(`/messages/${conv.id}`);
    } catch {
      // silencieux : le bouton reste disponible pour réessayer.
    }
  }

  function copyProfileLink() {
    navigator.clipboard?.writeText(window.location.origin + `/profile/${username}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (notFound) {
    return (
      <div className="card card-body text-center py-5">
        <p className="mb-0">Ce profil est introuvable.</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  const base = `/profile/${username}`;
  const tabs = [
    { href: base, label: 'Publications', exact: true },
    { href: `${base}/about`, label: 'À propos', exact: true },
    { href: `${base}/followers`, label: 'Abonnés', badge: profile._count.followers, exact: true },
    { href: `${base}/following`, label: 'Abonnements', badge: profile._count.following, exact: true },
  ];

  return (
    <div>
      <div className="card mb-4">
        <div
          className="h-200px rounded-top"
          style={{
            backgroundImage: profile.coverUrl ? `url(${profile.coverUrl})` : 'linear-gradient(135deg, var(--bs-primary), var(--bs-purple))',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        />
        <div className="card-body py-0">
          <div className="d-sm-flex align-items-start text-center text-sm-start">
            <div>
              <div className="avatar avatar-xxl mt-n5 mb-3">
                {profile.avatarUrl ? (
                  <img className="avatar-img rounded-circle border border-white border-3" src={profile.avatarUrl} alt={profile.displayName} />
                ) : (
                  <span className="avatar-img rounded-circle border border-white border-3 bg-primary d-flex align-items-center justify-content-center text-white fw-bold fs-1">
                    {profile.displayName.slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="ms-sm-4 mt-sm-3">
              <h1 className="mb-0 h5">
                {profile.displayName}
                {profile.role !== 'USER' && (
                  <span className="badge bg-primary bg-opacity-10 text-primary small ms-2">{profile.role === 'ADMIN' ? 'Admin' : 'Modérateur'}</span>
                )}
              </h1>
              <p className="mb-0 text-body-secondary">@{profile.username}</p>
              <p className="small text-body-secondary mb-0 mt-1">
                <i className="bi bi-calendar2-plus me-1" /> Membre depuis {monthYear(profile.createdAt)}
              </p>
            </div>

            <div className="d-flex gap-2 mt-3 justify-content-center ms-sm-auto">
              {profile.isSelf ? (
                <Link className="btn btn-primary-soft" href="/settings/profile">
                  <i className="bi bi-pencil-fill pe-1" /> Modifier le profil
                </Link>
              ) : (
                viewer && (
                  <>
                    <button type="button" className={`btn ${profile.isFollowing ? 'btn-light' : 'btn-primary'}`} onClick={toggleFollow} disabled={followPending}>
                      {profile.isFollowing ? 'Abonné·e' : 'Suivre'}
                    </button>
                    <button type="button" className="btn btn-light" onClick={startConversation} title="Envoyer un message">
                      <i className="bi bi-chat-left-text" />
                    </button>
                  </>
                )
              )}
              <div className="dropdown">
                <button className="icon-md btn btn-light" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                  <i className="bi bi-three-dots" />
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <button className="dropdown-item" type="button" onClick={copyProfileLink}>
                      <i className="bi bi-link fa-fw pe-2" />
                      {copied ? 'Lien copié !' : 'Copier le lien du profil'}
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {profile.bio && <p className="mt-3 mb-0">{profile.bio}</p>}

          <div className="hstack gap-3 gap-xl-4 mt-3 pb-3">
            <div>
              <h6 className="mb-0">{profile._count.posts}</h6>
              <small>Publications</small>
            </div>
            <div className="vr" />
            <div>
              <h6 className="mb-0">{profile._count.followers}</h6>
              <small>Abonnés</small>
            </div>
            <div className="vr" />
            <div>
              <h6 className="mb-0">{profile._count.following}</h6>
              <small>Abonnements</small>
            </div>
          </div>
        </div>

        <div className="card-footer mt-1 pt-2 pb-0">
          <ul className="nav nav-bottom-line align-items-center justify-content-center justify-content-md-start mb-0 border-0">
            {tabs.map((tab) => (
              <li className="nav-item" key={tab.href}>
                <Link className={`nav-link ${pathname === tab.href ? 'active' : ''}`} href={tab.href}>
                  {tab.label}
                  {tab.badge !== undefined && <span className="badge bg-secondary bg-opacity-10 text-secondary small ms-1">{tab.badge}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ProfileContext.Provider value={{ profile, username }}>{children}</ProfileContext.Provider>
    </div>
  );
}
