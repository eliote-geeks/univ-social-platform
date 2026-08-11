import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTOR_SELECT = { username: true, displayName: true, avatarUrl: true };

const NOTIFICATION_INCLUDE = {
  actor: { select: ACTOR_SELECT },
  post: { select: { id: true, body: true } },
  comment: { select: { id: true, body: true, postId: true } },
};

// Doit rester cohérent avec le pattern de username imposé à l'inscription (auth.dto.ts).
const MENTION_PATTERN = /@([a-z0-9_]{3,30})/g;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ne notifie jamais l'auteur de sa propre action. */
  private async create(
    recipientId: string,
    actorId: string,
    type: NotificationType,
    opts: { postId?: string; commentId?: string } = {},
  ) {
    if (recipientId === actorId) return;
    await this.prisma.notification.create({
      data: { recipientId, actorId, type, postId: opts.postId, commentId: opts.commentId },
    });
  }

  async notifyReaction(recipientId: string, actorId: string, postId: string) {
    await this.create(recipientId, actorId, 'REACTION', { postId });
  }

  async notifyComment(recipientId: string, actorId: string, postId: string, commentId: string) {
    await this.create(recipientId, actorId, 'COMMENT', { postId, commentId });
  }

  async notifyFollow(recipientId: string, actorId: string) {
    await this.create(recipientId, actorId, 'FOLLOW');
  }

  /** Extrait les @mentions d'un texte, résout les usernames existants, et notifie chacun. */
  async notifyMentions(actorId: string, text: string, opts: { postId?: string; commentId?: string }) {
    const usernames = [...new Set([...text.matchAll(MENTION_PATTERN)].map((m) => m[1]))];
    if (!usernames.length) return;

    const mentioned = await this.prisma.user.findMany({
      where: { username: { in: usernames } },
      select: { id: true },
    });
    await Promise.all(mentioned.map((u) => this.create(u.id, actorId, 'MENTION', opts)));
  }

  async list(userId: string, cursor?: string) {
    const items = await this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: NOTIFICATION_INCLUDE,
    });
    const next = items.length > 20 ? items.pop() : undefined;
    return { items, nextCursor: next?.id ?? null };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { recipientId: userId, readAt: null } });
    return { count };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notification) throw new NotFoundException('Notification introuvable');
    if (notification.recipientId !== userId) throw new ForbiddenException();
    if (notification.readAt) return notification;
    return this.prisma.notification.update({ where: { id: notificationId }, data: { readAt: new Date() } });
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
