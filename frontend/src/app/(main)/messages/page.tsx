'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { relativeTime } from '@/lib/format';
import type { Conversation, Paginated } from '@/lib/types';

function conversationTitle(c: Conversation, myUsername: string | undefined): string {
  if (c.isGroup) return c.title ?? 'Groupe';
  const other = c.participants.find((p) => p.username !== myUsername) ?? c.participants[0];
  return other?.displayName ?? 'Conversation';
}

export default function MessagesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [username, setUsername] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupUsernames, setGroupUsernames] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<Paginated<Conversation>>('/messaging/conversations').then((page) => {
      setConversations(page.items);
      setCursor(page.nextCursor);
    });
  }

  useEffect(() => {
    load();
  }, []);

  async function loadMore() {
    if (!cursor) return;
    const page = await apiFetch<Paginated<Conversation>>(`/messaging/conversations?cursor=${encodeURIComponent(cursor)}`);
    setConversations((prev) => [...(prev ?? []), ...page.items]);
    setCursor(page.nextCursor);
  }

  async function startDirect(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const conv = await apiFetch<Conversation>('/messaging/conversations', { method: 'POST', body: { username: username.trim() } });
      router.push(`/messages/${conv.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de démarrer la conversation');
    } finally {
      setSubmitting(false);
    }
  }

  async function startGroup(e: FormEvent) {
    e.preventDefault();
    const usernames = groupUsernames.split(',').map((u) => u.trim()).filter(Boolean);
    if (!groupTitle.trim() || usernames.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const conv = await apiFetch<Conversation>('/messaging/conversations/group', { method: 'POST', body: { title: groupTitle.trim(), usernames } });
      router.push(`/messages/${conv.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Impossible de créer le groupe');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2">
        <h5 className="mb-0">Messages</h5>
        <div className="d-flex gap-2">
          <button type="button" className="btn btn-light btn-sm" onClick={() => { setShowNewDirect((v) => !v); setShowNewGroup(false); }}>
            <i className="bi bi-person-plus me-1" /> Nouveau message
          </button>
          <button type="button" className="btn btn-light btn-sm" onClick={() => { setShowNewGroup((v) => !v); setShowNewDirect(false); }}>
            <i className="bi bi-people me-1" /> Nouveau groupe
          </button>
        </div>
      </div>

      {showNewDirect && (
        <form className="card card-body mb-3" onSubmit={startDirect}>
          <label className="form-label small">Identifiant de la personne</label>
          <div className="d-flex gap-2">
            <input className="form-control form-control-sm" placeholder="ex: awa_ndiaye" value={username} onChange={(e) => setUsername(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm text-nowrap" disabled={submitting}>
              Démarrer
            </button>
          </div>
        </form>
      )}

      {showNewGroup && (
        <form className="card card-body mb-3" onSubmit={startGroup}>
          <label className="form-label small">Nom du groupe</label>
          <input className="form-control form-control-sm mb-2" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} />
          <label className="form-label small">Identifiants des membres (séparés par des virgules)</label>
          <div className="d-flex gap-2">
            <input className="form-control form-control-sm" placeholder="awa_ndiaye, moussa_kamara" value={groupUsernames} onChange={(e) => setGroupUsernames(e.target.value)} />
            <button type="submit" className="btn btn-primary btn-sm text-nowrap" disabled={submitting}>
              Créer
            </button>
          </div>
        </form>
      )}

      {error && <div className="alert alert-danger py-2">{error}</div>}

      {conversations === null && (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" />
        </div>
      )}

      {conversations?.length === 0 && (
        <div className="card card-body text-center py-5">
          <p className="mb-0">Aucune conversation pour l&apos;instant.</p>
        </div>
      )}

      <div className="list-group">
        {conversations?.map((c) => (
          <Link key={c.id} href={`/messages/${c.id}`} className="list-group-item list-group-item-action d-flex align-items-center py-3">
            <div className="avatar me-3">
              {c.isGroup ? (
                <span className="avatar-img rounded-circle bg-secondary d-flex align-items-center justify-content-center text-white">
                  <i className="bi bi-people-fill" />
                </span>
              ) : c.participants[0]?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- domaine MinIO dynamique
                <img className="avatar-img rounded-circle" src={c.participants[0].avatarUrl} alt="" />
              ) : (
                <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold">
                  {conversationTitle(c, user?.username).slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-grow-1 min-w-0">
              <div className="d-flex justify-content-between">
                <span className={c.unread ? 'fw-bold' : ''}>{conversationTitle(c, user?.username)}</span>
                <small className="text-body-secondary text-nowrap ms-2">{relativeTime(c.lastMessageAt)}</small>
              </div>
              {c.lastMessage && (
                <p className={`mb-0 small text-truncate ${c.unread ? 'fw-bold' : 'text-body-secondary'}`}>{c.lastMessage.body}</p>
              )}
            </div>
            {c.unread && <span className="badge bg-primary rounded-circle ms-2" style={{ width: 10, height: 10 }} />}
          </Link>
        ))}
      </div>

      {cursor && (
        <div className="text-center mt-4">
          <button type="button" className="btn btn-light" onClick={loadMore}>
            Voir plus
          </button>
        </div>
      )}
    </div>
  );
}
