'use client';

import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { relativeTime } from '@/lib/format';
import type { Post } from '@/lib/types';

export function PostCard({ post }: { post: Post }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(post.myReaction === 'LIKE');
  const [count, setCount] = useState(post._count.reactions);
  const [pending, setPending] = useState(false);

  async function toggleLike() {
    if (!user || pending) return;
    setPending(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      if (next) {
        await apiFetch(`/posts/${post.id}/reaction`, { method: 'POST', body: { type: 'LIKE' } });
      } else {
        await apiFetch(`/posts/${post.id}/reaction`, { method: 'DELETE' });
      }
    } catch {
      // Rollback optimiste en cas d'échec réseau/serveur.
      setLiked(!next);
      setCount((c) => c - (next ? 1 : -1));
    } finally {
      setPending(false);
    }
  }

  const context = post.group ? { href: `/groups/${post.group.slug}`, label: post.group.name } : post.page ? { href: `/pages/${post.page.slug}`, label: post.page.name } : null;

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
          <button type="button" className={`btn btn-sm ${liked ? 'btn-primary' : 'btn-light'}`} onClick={toggleLike} disabled={!user}>
            <i className={`bi ${liked ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-up'} me-1`} />
            {count > 0 ? count : "J'aime"}
          </button>
          <Link href={`/posts/${post.id}`} className="small text-body-secondary text-decoration-none">
            <i className="bi bi-chat me-1" />
            {post._count.comments} commentaire{post._count.comments > 1 ? 's' : ''}
          </Link>
        </div>
      </div>
    </div>
  );
}
