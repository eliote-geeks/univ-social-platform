'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { relativeTime } from '@/lib/format';
import { PostCard } from '@/components/webestica/PostCard';
import type { Comment, PostDetail } from '@/lib/types';

function CommentAvatar({ author }: { author: Comment['author'] }) {
  return author.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- domaine MinIO dynamique
    <img className="avatar-img rounded-circle" src={author.avatarUrl} alt={author.displayName} />
  ) : (
    <span className="avatar-img rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold small">
      {author.displayName.slice(0, 1).toUpperCase()}
    </span>
  );
}

function CommentRow({ comment }: { comment: Comment }) {
  return (
    <div className="d-flex mt-3">
      <div className="avatar avatar-sm me-2 flex-shrink-0">
        <CommentAvatar author={comment.author} />
      </div>
      <div className="bg-light rounded p-2 px-3 flex-grow-1">
        <Link href={`/profile/${comment.author.username}`} className="fw-bold small d-block">
          {comment.author.displayName}
        </Link>
        <p className="mb-0 small" style={{ whiteSpace: 'pre-wrap' }}>{comment.body}</p>
        <small className="text-body-secondary">{relativeTime(comment.createdAt)}</small>
      </div>
    </div>
  );
}

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<PostDetail>(`/posts/${id}`)
      .then((p) => {
        if (!cancelled) setPost(p);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 404) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !post) return;
    setSubmitting(true);
    try {
      const comment = await apiFetch<Comment>(`/posts/${id}/comments`, {
        method: 'POST',
        body: { body: body.trim(), parentId: replyTo ?? undefined },
      });
      setPost((prev) => {
        if (!prev) return prev;
        const comments = [...prev.comments];
        if (replyTo) {
          const parent = comments.find((c) => c.id === replyTo);
          if (parent) parent.replies = [...(parent.replies ?? []), comment];
        } else {
          comments.push(comment);
        }
        return { ...prev, comments, _count: { ...prev._count, comments: prev._count.comments + 1 } };
      });
      setBody('');
      setReplyTo(null);
    } finally {
      setSubmitting(false);
    }
  }

  if (notFound) {
    return (
      <div className="card card-body text-center py-5">
        <p className="mb-0">Cette publication est introuvable.</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  return (
    <div>
      <PostCard post={post} />

      <div className="card">
        <div className="card-header">
          <h6 className="mb-0">Commentaires</h6>
        </div>
        <div className="card-body">
          {user && (
            <form onSubmit={onSubmitComment} className="mb-3">
              {replyTo && (
                <div className="small text-body-secondary mb-1">
                  Réponse à un commentaire —{' '}
                  <button type="button" className="btn btn-link btn-sm p-0" onClick={() => setReplyTo(null)}>
                    annuler
                  </button>
                </div>
              )}
              <div className="d-flex">
                <input
                  className="form-control form-control-sm me-2"
                  placeholder="Écrire un commentaire…"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={2000}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting || !body.trim()}>
                  Envoyer
                </button>
              </div>
            </form>
          )}

          {post.comments.length === 0 && <p className="text-body-secondary small mb-0">Aucun commentaire pour l&apos;instant.</p>}

          {post.comments.map((comment) => (
            <div key={comment.id}>
              <CommentRow comment={comment} />
              {user && (
                <button type="button" className="btn btn-link btn-sm ms-5 p-0" onClick={() => setReplyTo(comment.id)}>
                  Répondre
                </button>
              )}
              {comment.replies?.map((reply) => (
                <div key={reply.id} className="ms-5">
                  <CommentRow comment={reply} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
