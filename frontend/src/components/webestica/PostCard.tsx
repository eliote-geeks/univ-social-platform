'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { relativeTime } from '@/lib/format';
import type { Post, ReactionType } from '@/lib/types';

const REACTIONS: { type: ReactionType; icon: string; label: string; colorClass: string }[] = [
  { type: 'LIKE', icon: 'bi-hand-thumbs-up-fill', label: "J'aime", colorClass: 'text-primary' },
  { type: 'LOVE', icon: 'bi-heart-fill', label: 'Adore', colorClass: 'text-danger' },
  { type: 'HAHA', icon: 'bi-emoji-laughing-fill', label: 'Haha', colorClass: 'text-warning' },
  { type: 'WOW', icon: 'bi-emoji-surprise-fill', label: 'Wow', colorClass: 'text-warning' },
  { type: 'SAD', icon: 'bi-emoji-frown-fill', label: 'Triste', colorClass: 'text-warning' },
  { type: 'ANGRY', icon: 'bi-emoji-angry-fill', label: 'Grr', colorClass: 'text-danger' },
];
const REACTION_BY_TYPE = Object.fromEntries(REACTIONS.map((r) => [r.type, r])) as Record<ReactionType, (typeof REACTIONS)[number]>;

export function PostCard({ post, onDeleted }: { post: Post; onDeleted?: (postId: string) => void }) {
  const { user } = useAuth();
  const [reaction, setReaction] = useState<ReactionType | null>(post.myReaction ?? null);
  const [count, setCount] = useState(post._count.reactions);
  const [pending, setPending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);

  async function setPostReaction(next: ReactionType | null) {
    if (!user || pending) return;
    setPending(true);
    setPickerOpen(false);
    const previous = reaction;
    setReaction(next);
    setCount((c) => c + (next ? 1 : 0) - (previous ? 1 : 0));
    try {
      if (next) {
        await apiFetch(`/posts/${post.id}/reaction`, { method: 'POST', body: { type: next } });
      } else {
        await apiFetch(`/posts/${post.id}/reaction`, { method: 'DELETE' });
      }
    } catch {
      setReaction(previous);
      setCount((c) => c - (next ? 1 : 0) + (previous ? 1 : 0));
    } finally {
      setPending(false);
    }
  }

  async function deletePost() {
    if (!window.confirm('Supprimer définitivement cette publication ?')) return;
    try {
      await apiFetch(`/posts/${post.id}`, { method: 'DELETE' });
      setDeleted(true);
      onDeleted?.(post.id);
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Impossible de supprimer la publication');
    }
  }

  async function reportPost() {
    const reason = window.prompt('Décris brièvement le problème avec cette publication (5 caractères minimum) :');
    if (!reason) return;
    if (reason.trim().length < 5) {
      window.alert('La description doit faire au moins 5 caractères');
      return;
    }
    try {
      await apiFetch('/moderation/reports', { method: 'POST', body: { targetType: 'POST', targetId: post.id, reason: reason.trim() } });
      window.alert('Publication signalée, merci — un·e modérateur·rice va l’examiner.');
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : 'Impossible de signaler la publication');
    }
  }

  if (deleted) return null;

  const context = post.group ? { href: `/groups/${post.group.slug}`, label: post.group.name } : post.page ? { href: `/pages/${post.page.slug}`, label: post.page.name } : null;
  const isOwn = user?.username === post.author.username;
  const active = reaction ? REACTION_BY_TYPE[reaction] : null;

  return (
    <div className="card mb-4">
      <div className="card-body">
        <div className="d-flex justify-content-between">
          <div className="d-flex">
            <div className="avatar me-3">
              {post.author.avatarUrl ? (
                <img className="avatar-img rounded-circle" src={post.author.avatarUrl} alt={post.author.displayName} />
              ) : (
                <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold">
                  {post.author.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <Link className="h6 mb-0" href={`/profile/${post.author.username}`}>
                {post.author.displayName}
              </Link>
              <p className="mb-0 small text-body-secondary">
                {relativeTime(post.publishedAt)}
                {context && (
                  <>
                    {' · '}
                    <Link href={context.href}>{context.label}</Link>
                  </>
                )}
              </p>
            </div>
          </div>

          {user && (
            <div className="dropdown">
              <button className="btn btn-sm btn-secondary-soft-hover text-secondary py-1 px-2" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i className="bi bi-three-dots" />
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                {isOwn ? (
                  <li>
                    <button className="dropdown-item text-danger" type="button" onClick={deletePost}>
                      <i className="bi bi-trash fa-fw pe-2" />
                      Supprimer la publication
                    </button>
                  </li>
                ) : (
                  <li>
                    <button className="dropdown-item" type="button" onClick={reportPost}>
                      <i className="bi bi-flag fa-fw pe-2" />
                      Signaler
                    </button>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        {post.body && <p className="mt-3 mb-0" style={{ whiteSpace: 'pre-wrap' }}>{post.body}</p>}

        {post.media.length > 0 && (
          <div className="mt-3">
            {post.media.map((m) =>
              m.type === 'VIDEO' ? (
                <video key={m.id} className="rounded w-100" style={{ maxHeight: 480, objectFit: 'cover' }} src={m.url} controls />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- domaine MinIO dynamique (local/prod)
                <img key={m.id} className="rounded w-100" style={{ maxHeight: 480, objectFit: 'cover' }} src={m.url} alt={m.altText ?? ''} />
              ),
            )}
          </div>
        )}

        <div className="d-flex align-items-center justify-content-between mt-3 pt-3 border-top">
          <div className="position-relative" onMouseEnter={() => setPickerOpen(true)} onMouseLeave={() => setPickerOpen(false)}>
            {pickerOpen && user && (
              <div className="position-absolute bottom-100 start-0 mb-1 bg-body border rounded-pill shadow-sm d-flex gap-1 p-1" style={{ zIndex: 10 }}>
                {REACTIONS.map((r) => (
                  <button
                    key={r.type}
                    type="button"
                    className="btn btn-sm btn-light rounded-circle p-1 lh-1"
                    title={r.label}
                    onClick={() => setPostReaction(reaction === r.type ? null : r.type)}
                  >
                    <i className={`bi ${r.icon} ${r.colorClass}`} />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className={`btn btn-sm ${active ? 'btn-primary' : 'btn-light'}`}
              onClick={() => setPostReaction(reaction ? null : 'LIKE')}
              disabled={!user}
            >
              <i className={`bi ${active ? active.icon : 'bi-hand-thumbs-up'} me-1`} />
              {count > 0 ? count : (active?.label ?? "J'aime")}
            </button>
          </div>
          <Link href={`/posts/${post.id}`} className="small text-body-secondary text-decoration-none">
            <i className="bi bi-chat me-1" />
            {post._count.comments} commentaire{post._count.comments > 1 ? 's' : ''}
          </Link>
        </div>
      </div>
    </div>
  );
}
