'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { apiFetch, ApiError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { relativeTime } from '@/lib/format';
import { getSocket } from '@/lib/socket';
import type { Conversation, Message, Paginated } from '@/lib/types';

function conversationTitle(c: Conversation, myUsername: string | undefined): string {
  if (c.isGroup) return c.title ?? 'Groupe';
  const other = c.participants.find((p) => p.username !== myUsername) ?? c.participants[0];
  return other?.displayName ?? 'Conversation';
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [showManage, setShowManage] = useState(false);
  const [newMemberUsername, setNewMemberUsername] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [wsError, setWsError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Chargement initial : métadonnées + historique.
  useEffect(() => {
    let cancelled = false;
    apiFetch<Conversation>(`/messaging/conversations/${id}`)
      .then((c) => {
        if (cancelled) return;
        setConversation(c);
        setNewTitle(c.title ?? '');
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError && err.status === 404) setNotFound(true);
      });
    apiFetch<Paginated<Message>>(`/messaging/conversations/${id}/messages`).then((page) => {
      if (cancelled) return;
      setMessages(page.items);
      setCursor(page.nextCursor);
      setTimeout(scrollToBottom, 100);
    });
    return () => {
      cancelled = true;
    };
  }, [id, scrollToBottom]);

  // Connexion WebSocket : rejoint la room, écoute les nouveaux messages et les événements de
  // gestion de groupe. Un seul effet pour toute la durée de vie de la page de conversation.
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    function onNewMessage(data: { conversationId: string; message: Message }) {
      if (data.conversationId !== id) return;
      setMessages((prev) => (prev ? [...prev, data.message] : prev));
      setTimeout(scrollToBottom, 50);
      if (data.message.senderId !== user?.id) socket!.emit('conversation:read', { conversationId: id });
    }
    function onMemberChange() {
      apiFetch<Conversation>(`/messaging/conversations/${id}`).then(setConversation).catch(() => {});
    }
    function onRemoved() {
      router.push('/messages');
    }
    function onError(data: { message: string }) {
      setWsError(data.message);
    }

    socket.emit('conversation:join', { conversationId: id });
    socket.emit('conversation:read', { conversationId: id });
    socket.on('message:new', onNewMessage);
    socket.on('member:added', onMemberChange);
    socket.on('member:removed', onMemberChange);
    socket.on('member:left', onMemberChange);
    socket.on('conversation:renamed', onMemberChange);
    socket.on('conversation:removed', onRemoved);
    socket.on('error', onError);

    return () => {
      socket.emit('conversation:leave', { conversationId: id });
      socket.off('message:new', onNewMessage);
      socket.off('member:added', onMemberChange);
      socket.off('member:removed', onMemberChange);
      socket.off('member:left', onMemberChange);
      socket.off('conversation:renamed', onMemberChange);
      socket.off('conversation:removed', onRemoved);
      socket.off('error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadOlder() {
    if (!cursor) return;
    const page = await apiFetch<Paginated<Message>>(`/messaging/conversations/${id}/messages?cursor=${encodeURIComponent(cursor)}`);
    setMessages((prev) => [...page.items, ...(prev ?? [])]);
    setCursor(page.nextCursor);
  }

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit('message:send', { conversationId: id, body: body.trim() });
    } else {
      // Repli REST si le WebSocket n'est pas disponible.
      apiFetch<Message>(`/messaging/conversations/${id}/messages`, { method: 'POST', body: { body: body.trim() } }).then((m) => {
        setMessages((prev) => (prev ? [...prev, m] : prev));
        setTimeout(scrollToBottom, 50);
      });
    }
    setBody('');
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberUsername.trim()) return;
    await apiFetch(`/messaging/conversations/${id}/members`, { method: 'POST', body: { username: newMemberUsername.trim() } });
    setNewMemberUsername('');
    const c = await apiFetch<Conversation>(`/messaging/conversations/${id}`);
    setConversation(c);
  }

  async function removeMember(username: string) {
    if (!confirm(`Retirer @${username} du groupe ?`)) return;
    await apiFetch(`/messaging/conversations/${id}/members/${username}`, { method: 'DELETE' });
    const c = await apiFetch<Conversation>(`/messaging/conversations/${id}`);
    setConversation(c);
  }

  async function rename(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await apiFetch(`/messaging/conversations/${id}`, { method: 'PATCH', body: { title: newTitle.trim() } });
    setConversation((prev) => prev && { ...prev, title: newTitle.trim() });
  }

  async function leaveGroup() {
    if (!confirm('Quitter ce groupe ?')) return;
    await apiFetch(`/messaging/conversations/${id}/leave`, { method: 'POST' });
    router.push('/messages');
  }

  if (notFound) {
    return (
      <div className="card card-body text-center py-5">
        <p className="mb-0">Cette conversation est introuvable.</p>
      </div>
    );
  }

  if (!conversation || !messages) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  const isOwner = conversation.myRole === 'OWNER';

  return (
    <div className="card" style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
      <div className="card-header d-flex justify-content-between align-items-center">
        <div>
          <Link href="/messages" className="me-2 text-reset"><i className="bi bi-arrow-left" /></Link>
          <strong>{conversationTitle(conversation, user?.username)}</strong>
          {conversation.isGroup && <small className="text-body-secondary ms-2">{conversation.participants.length + 1} membres</small>}
        </div>
        {conversation.isGroup && (
          <button type="button" className="btn btn-light btn-sm" onClick={() => setShowManage((v) => !v)}>
            <i className="bi bi-gear" />
          </button>
        )}
      </div>

      {showManage && conversation.isGroup && (
        <div className="card-body border-bottom" style={{ maxHeight: 260, overflowY: 'auto' }}>
          {isOwner && (
            <form className="d-flex mb-2" onSubmit={rename}>
              <input className="form-control form-control-sm me-2" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <button type="submit" className="btn btn-sm btn-light text-nowrap">Renommer</button>
            </form>
          )}
          {isOwner && (
            <form className="d-flex mb-2" onSubmit={addMember}>
              <input className="form-control form-control-sm me-2" placeholder="Ajouter (identifiant)" value={newMemberUsername} onChange={(e) => setNewMemberUsername(e.target.value)} />
              <button type="submit" className="btn btn-sm btn-primary text-nowrap">Ajouter</button>
            </form>
          )}
          <ul className="list-unstyled mb-2">
            {conversation.participants.map((p) => (
              <li key={p.username} className="d-flex justify-content-between align-items-center py-1">
                <span className="small">{p.displayName} (@{p.username})</span>
                {isOwner && (
                  <button type="button" className="btn btn-sm btn-link text-danger p-0" onClick={() => removeMember(p.username)}>
                    Retirer
                  </button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={leaveGroup}>
            Quitter le groupe
          </button>
        </div>
      )}

      <div className="card-body overflow-auto flex-grow-1">
        {cursor && (
          <div className="text-center mb-3">
            <button type="button" className="btn btn-sm btn-light" onClick={loadOlder}>
              Charger les messages précédents
            </button>
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`d-flex mb-2 ${mine ? 'justify-content-end' : ''}`}>
              <div className={`rounded p-2 px-3 ${mine ? 'bg-primary text-white' : 'bg-light'}`} style={{ maxWidth: '75%' }}>
                {conversation.isGroup && !mine && <div className="small fw-bold">{m.sender.displayName}</div>}
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
                <div className={`small text-end ${mine ? 'text-white-50' : 'text-body-secondary'}`}>{relativeTime(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {wsError && <div className="alert alert-danger m-2 py-1 small mb-0">{wsError}</div>}

      <div className="card-footer">
        <form className="d-flex" onSubmit={onSend}>
          <input className="form-control me-2" placeholder="Écrire un message…" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} />
          <button type="submit" className="btn btn-primary" disabled={!body.trim()}>
            <i className="bi bi-send" />
          </button>
        </form>
      </div>
    </div>
  );
}
