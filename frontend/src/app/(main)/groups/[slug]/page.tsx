'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { PostFeed } from '@/components/webestica/PostFeed';
import type { Group, GroupMemberEntry, Paginated } from '@/lib/types';

export default function GroupDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [members, setMembers] = useState<GroupMemberEntry[] | null>(null);
  const [showManage, setShowManage] = useState(false);
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
    if (showManage && !members) loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showManage]);

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

  return (
    <div>
      <div className="card mb-4">
        <div className="h-100px bg-primary bg-opacity-10" />
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h4 className="mb-0">
                {group.name} {group.visibility === 'PRIVATE' && <i className="bi bi-lock-fill small text-body-secondary" title="Groupe privé" />}
              </h4>
              <small className="text-body-secondary">
                {group._count.members} membre{group._count.members > 1 ? 's' : ''} · créé par {group.createdBy.displayName}
              </small>
            </div>
            <div className="d-flex gap-2">
              {isManager && (
                <button type="button" className="btn btn-light btn-sm" onClick={() => setShowManage((v) => !v)}>
                  <i className="bi bi-gear me-1" /> Gérer
                </button>
              )}
              {user && group.myRole === null && group.visibility === 'PUBLIC' && (
                <button type="button" className="btn btn-primary btn-sm" onClick={join} disabled={busy}>
                  Rejoindre
                </button>
              )}
              {user && group.myRole !== null && (
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={leave} disabled={busy}>
                  Quitter
                </button>
              )}
            </div>
          </div>
          {group.description && <p className="mt-3 mb-0">{group.description}</p>}
        </div>
      </div>

      {actionError && <div className="alert alert-danger">{actionError}</div>}

      {showManage && isManager && (
        <div className="card mb-4">
          <div className="card-header">
            <h6 className="mb-0">Membres</h6>
          </div>
          <div className="card-body">
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

            {!members && <div className="spinner-border spinner-border-sm text-primary" role="status" />}

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
                  {m.role !== 'OWNER' && (
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

      <PostFeed
        feedEndpoint={`/groups/${slug}/posts`}
        composerEndpoint={`/groups/${slug}/posts`}
        canPost={!!user && group.myRole !== null}
        emptyMessage="Aucune publication dans ce groupe pour l'instant."
      />
    </div>
  );
}
