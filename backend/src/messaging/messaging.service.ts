import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  // Exposé au gateway WebSocket pour vérifier qu'un socket peut rejoindre la room d'une
  // conversation avant de le laisser écouter/émettre dessus. 404 (et non 403) pour ne pas
  // révéler l'existence d'une conversation à un utilisateur qui n'y participe pas.
  async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) throw new NotFoundException('Conversation introuvable');
    return participant;
  }

  async getOrCreateDirect(userId: string, targetUsername: string) {
    const target = await this.prisma.user.findUnique({ where: { username: targetUsername.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new NotFoundException('Profil introuvable');
    if (target.id === userId) throw new BadRequestException('Impossible de démarrer une conversation avec soi-même');

    const candidates = await this.prisma.conversation.findMany({
      where: {
        isGroup: false,
        participants: { some: { userId } },
        AND: { participants: { some: { userId: target.id } } },
      },
      include: { participants: true },
    });
    const existing = candidates.find((c) => c.participants.length === 2);
    const conversation =
      existing ??
      (await this.prisma.conversation.create({
        data: { isGroup: false, participants: { create: [{ userId }, { userId: target.id }] } },
      }));

    return this.shapeConversation(conversation.id, userId);
  }

  async listConversations(userId: string, cursor?: string) {
    const rows = await this.prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        participants: { include: { user: { select: USER_SUMMARY_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    const next = rows.length > 20 ? rows.pop() : undefined;

    const items = rows.map((conversation) => {
      const me = conversation.participants.find((p) => p.userId === userId);
      const others = conversation.participants.filter((p) => p.userId !== userId).map((p) => p.user);
      const lastMessage = conversation.messages[0] ?? null;
      const unread = !!lastMessage && lastMessage.senderId !== userId && (!me?.lastReadAt || lastMessage.createdAt > me.lastReadAt);
      return {
        id: conversation.id,
        isGroup: conversation.isGroup,
        title: conversation.title,
        participants: others,
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unread,
      };
    });
    return { items, nextCursor: next?.id ?? null };
  }

  async listMessages(conversationId: string, userId: string, cursor?: string) {
    await this.assertParticipant(conversationId, userId);

    // Tri desc (le plus récent d'abord) pour une pagination "charger les messages plus anciens"
    // cohérente avec le reste de l'API (posts/notifications) ; on inverse ensuite la page pour
    // un affichage chronologique naturel côté client.
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { sender: { select: USER_SUMMARY_SELECT } },
    });
    const next = rows.length > 20 ? rows.pop() : undefined;
    rows.reverse();
    return { items: rows, nextCursor: next?.id ?? null };
  }

  async sendMessage(conversationId: string, userId: string, body: string) {
    await this.assertParticipant(conversationId, userId);
    const trimmed = body.trim();
    if (!trimmed) throw new BadRequestException('Le message ne peut pas être vide');

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: userId, body: trimmed },
        include: { sender: { select: USER_SUMMARY_SELECT } },
      }),
      this.prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: new Date() },
      }),
    ]);
    return message;
  }

  async markRead(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    const readAt = new Date();
    await this.prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: readAt },
    });
    return { conversationId, readAt };
  }

  private async shapeConversation(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: { participants: { include: { user: { select: USER_SUMMARY_SELECT } } } },
    });
    const others = conversation.participants.filter((p) => p.userId !== userId).map((p) => p.user);
    return { id: conversation.id, isGroup: conversation.isGroup, title: conversation.title, participants: others, lastMessageAt: conversation.lastMessageAt };
  }
}
