'use client';

import { use, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import type { PublicProfile } from '@/lib/types';

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = use(params);
  const { user: viewer } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  useEffect(() => {
    // Pas de reset synchrone (setProfile(null) direct) en tête d'effet : on laisse l'ancien
    // profil affiché jusqu'à ce que le nouveau arrive plutôt que de faire un setState synchrone
    // dans le corps de l'effet (react-hooks/set-state-in-effect). Le flag `cancelled` évite
    // d'appliquer une réponse tardive si `username` change de nouveau entre-temps.
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

  return (
    <div className="card">
      <div className="h-100px bg-primary bg-opacity-10" />
      <div className="card-body pt-0">
        <div className="d-sm-flex align-items-end mt-n5">
          <div className="avatar avatar-xl">
            {profile.avatarUrl ? (
              <img className="avatar-img rounded-circle border border-white border-3" src={profile.avatarUrl} alt={profile.displayName} />
            ) : (
              <span className="avatar-img rounded-circle border border-white border-3 bg-primary d-flex align-items-center justify-content-center text-white fw-bold fs-1">
                {profile.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
          <div className="ms-sm-3 mt-3 mt-sm-0 flex-grow-1">
            <h4 className="mb-0">{profile.displayName}</h4>
            <p className="mb-0 text-body-secondary">@{profile.username}</p>
          </div>
          {viewer && !profile.isSelf && (
            <button type="button" className={`btn ${profile.isFollowing ? 'btn-light' : 'btn-primary'} mt-3 mt-sm-0`} onClick={toggleFollow} disabled={followPending}>
              {profile.isFollowing ? 'Abonné·e' : 'Suivre'}
            </button>
          )}
        </div>

        {profile.bio && <p className="mt-3">{profile.bio}</p>}

        <div className="hstack gap-3 gap-xl-4 mt-3">
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
    </div>
  );
}
