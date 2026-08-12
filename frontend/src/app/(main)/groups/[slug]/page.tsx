'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { monthYear } from '@/lib/format';
import { ImageFieldUploader } from '@/components/webestica/ImageFieldUploader';
import { PostFeed } from '@/components/webestica/PostFeed';
import type { Group, GroupMemberEntry, Paginated } from '@/lib/types';

type Tab = 'feed' | 'members' | 'about';

export default function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('feed');
  const [members, setMembers] = useState<GroupMemberEntry[] | null>(null);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadGroup() {
    apiFetch<Group>(`/groups/${slug}`)
      .then(setGroup)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
      });
  }

  useEffect(() => {
    loadGroup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  function loadMembers() {
    apiFetch<Paginated<GroupMemberEntry>>(`/groups/${slug}/members`).then((page) => setMembers(page.items));
  }

  useEffect(() => {
    if (tab === 'members' && !members) loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const isManager = group?.myRole === 'OWNER' || group?.myRole === 'ADMIN';

  async function join() {
    setBusy(true);
    try {
      await apiFetch(`/groups/${slug}/join`, { method: 'POST' });
      loadGroup();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!confirm('Quitter ce groupe ?')) return;
    setBusy(true);
    try {
      const result = await apiFetch<{ deleted: boolean }>(`/groups/${slug}/leave`, { method: 'POST' });
      if (result.deleted) {
        router.push('/groups');
      } else {
        loadGroup();
      }
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action impossible');
    } finally {
      setBusy(false);
    }
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberUsername.trim()) return;
    setActionError(null);
    try {
      await apiFetch(`/groups/${slug}/members`, { method: 'POST', body: { username: newMemberUsername.trim() } });
      setNewMemberUsername('');
      loadMembers();
      loadGroup();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Impossible d'ajouter ce membre");
    }
  }

  async function removeMember(username: string) {
    if (!confirm(`Retirer @${username} du groupe ?`)) return;
    try {
      await apiFetch(`/groups/${slug}/members/${username}`, { method: 'DELETE' });
      loadMembers();
      loadGroup();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action impossible');
    }
  }

  async function setRole(username: string, role: 'ADMIN' | 'MEMBER') {
    try {
      await apiFetch(`/groups/${slug}/members/${username}/role`, { method: 'PATCH', body: { role } });
      loadMembers();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Action impossible');
    }
  }

  if (notFound) {
    return (
      <div className="card card-body text-center py-5">
        <p className="mb-0">Ce groupe est introuvable.</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'feed', label: 'Publications' },
    { id: 'members', label: 'Membres', badge: group._count.members },
    { id: 'about', label: 'À propos' },
  ];

  return (
    <div>
      <div className="card mb-4">
        <div
          className="h-200px rounded-top position-relative"
          style={{
            backgroundImage: group.coverUrl ? `url(${group.coverUrl})` : 'linear-gradient(135deg, var(--bs-primary), var(--bs-purple))',
            backgroundPosition: 'center',
            backgroundSize: 'cover',
          }}
        >
          {isManager && (
            <ImageFieldUploader
              endpoint={`/groups/${slug}`}
              field="coverKey"
              onUpdated={(coverUrl) => setGroup((g) => g && { ...g, coverUrl })}
              className="btn btn-light btn-sm position-absolute bottom-0 end-0 m-2"
            >
              <i className="bi bi-camera-fill me-1" /> Changer la couverture
            </ImageFieldUploader>
          )}
        </div>
        <div className="card-body py-0">
          <div className="d-sm-flex align-items-start text-center text-sm-start">
            <div>
              <div className="avatar avatar-xxl mt-n5 mb-3">
                <span className="avatar-img rounded-circle border border-white border-3 bg-primary d-flex align-items-center justify-content-center text-white fw-bold fs-1">
                  {group.name.slice(0, 1).toUpperCase()}
                </span>
              </div>
            </div>
            <div className="ms-sm-4 mt-sm-3">
              <h1 className="mb-0 h5">
                {group.name} {group.visibility === 'PRIVATE' && <i className="bi bi-lock-fill small text-body-secondary" title="Groupe privé" />}
              </h1>
              <p className="mb-0 text-body-secondary">
                {group.visibility === 'PRIVATE' ? 'Groupe privé' : 'Groupe public'} · {group._count.members} membre{group._count.members > 1 ? 's' : ''}
              </p>
            </div>

            <div className="d-flex gap-2 mt-3 justify-content-center ms-sm-auto">
              {user && group.myRole === null && group.visibility === 'PUBLIC' && (
                <button type="button" className="btn btn-primary" onClick={join} disabled={busy}>
                  Rejoindre
                </button>
              )}
              {user && group.myRole !== null && (
                <button type="button" className="btn btn-outline-danger" onClick={leave} disabled={busy}>
                  Quitter
                </button>
              )}
            </div>
          </div>

          {group.description && <p className="mt-3 mb-0 pb-3">{group.description}</p>}
        </div>

        <div className="card-footer mt-1 pt-2 pb-0">
          <ul className="nav nav-bottom-line align-items-center justify-content-center justify-content-md-start mb-0 border-0">
            {tabs.map((t) => (
              <li className="nav-item" key={t.id}>
                <button type="button" className={`nav-link ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                  {t.label}
                  {t.badge !== undefined && <span className="badge bg-secondary bg-opacity-10 text-secondary small ms-1">{t.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {actionError && <div className="alert alert-danger">{actionError}</div>}

      {tab === 'feed' && (
        <PostFeed
          feedEndpoint={`/groups/${slug}/posts`}
          composerEndpoint={`/groups/${slug}/posts`}
          canPost={!!user && group.myRole !== null}
          emptyMessage="Aucune publication dans ce groupe pour l'instant."
        />
      )}

      {tab === 'about' && (
        <div className="card">
          <div className="card-header border-0">
            <h5 className="card-title">À propos</h5>
          </div>
          <div className="card-body pt-0">
            {group.description ? <p>{group.description}</p> : <p className="text-body-secondary mb-0">Aucune description.</p>}
            <ul className="list-unstyled mt-3 mb-0">
              <li className="mb-2">
                <i className="bi bi-shield fa-fw pe-1" /> Visibilité : <strong>{group.visibility === 'PRIVATE' ? 'Privé' : 'Public'}</strong>
              </li>
              <li className="mb-2">
                <i className="bi bi-person fa-fw pe-1" /> Créé par : <strong>{group.createdBy.displayName}</strong>
              </li>
              <li>
                <i className="bi bi-calendar2-plus fa-fw pe-1" /> Créé en <strong>{monthYear(group.createdAt)}</strong>
              </li>
            </ul>
          </div>
        </div>
      )}

      {tab === 'members' && (
        <div className="card">
          <div className="card-header border-0">
            <h5 className="card-title">Membres</h5>
          </div>
          <div className="card-body pt-0">
            {isManager && (
              <form className="d-flex mb-3" onSubmit={addMember}>
                <input
                  className="form-control form-control-sm me-2"
                  placeholder="Identifiant à ajouter (ex: awa_ndiaye)"
                  value={newMemberUsername}
                  onChange={(e) => setNewMemberUsername(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm text-nowrap">
                  Ajouter
                </button>
              </form>
            )}

            {!members && (
              <div className="text-center py-3">
                <div className="spinner-border spinner-border-sm text-primary" role="status" />
              </div>
            )}

            <ul className="list-group list-group-flush">
              {members?.map((m) => (
                <li key={m.username} className="list-group-item d-flex justify-content-between align-items-center px-0">
                  <div className="d-flex align-items-center">
                    <div className="avatar avatar-sm me-2">
                      {m.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- domaine MinIO dynamique
                        <img className="avatar-img rounded-circle" src={m.avatarUrl} alt={m.displayName} />
                      ) : (
                        <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold small">
                          {m.displayName.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="small fw-bold">{m.displayName}</div>
                      <span className={`badge ${m.role === 'OWNER' ? 'bg-primary' : m.role === 'ADMIN' ? 'bg-info text-dark' : 'bg-light text-dark'}`}>{m.role}</span>
                    </div>
                  </div>
                  {isManager && m.role !== 'OWNER' && (
                    <div className="d-flex gap-1">
                      {group.myRole === 'OWNER' && (
                        <button type="button" className="btn btn-sm btn-light" onClick={() => setRole(m.username, m.role === 'ADMIN' ? 'MEMBER' : 'ADMIN')}>
                          {m.role === 'ADMIN' ? 'Rétrograder' : 'Promouvoir admin'}
                        </button>
                      )}
                      {(group.myRole === 'OWNER' || m.role === 'MEMBER') && (
                        <button type="button" className="btn btn-sm btn-danger-soft" onClick={() => removeMember(m.username)}>
                          Retirer
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
