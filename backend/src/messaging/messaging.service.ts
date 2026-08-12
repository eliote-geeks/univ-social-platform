import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

// Créateur inclus : une conversation de groupe compte donc jusqu'à 50 participants.
const MAX_GROUP_MEMBERS = 50;

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

  private async requireOwner(conversationId: string, userId: string) {
    const participant = await this.assertParticipant(conversationId, userId);
    if (participant.role !== 'OWNER') throw new ForbiddenException('Seul le créateur du groupe peut effectuer cette action');
    return participant;
  }

  async createGroup(userId: string, title: string, usernames: string[]) {
    const normalized = [...new Set(usernames.map((u) => u.trim().toLowerCase()))];
    const members = await this.prisma.user.findMany({ where: { username: { in: normalized } }, select: { id: true, username: true } });
    if (members.length !== normalized.length) throw new NotFoundException('Un ou plusieurs profils sont introuvables');

    const memberIds = members.map((m) => m.id).filter((id) => id !== userId);
    if (memberIds.length + 1 > MAX_GROUP_MEMBERS) throw new BadRequestException(`Un groupe est limité à ${MAX_GROUP_MEMBERS} membres`);

    const conversation = await this.prisma.conversation.create({
      data: {
        isGroup: true,
        title: title.trim(),
        participants: {
          create: [{ userId, role: 'OWNER' }, ...memberIds.map((id) => ({ userId: id, role: 'MEMBER' as const }))],
        },
      },
    });
    return this.shapeConversation(conversation.id, userId);
  }

  async addMember(conversationId: string, requesterId: string, username: string) {
    await this.requireGroup(conversationId);
    await this.requireOwner(conversationId, requesterId);

    const target = await this.prisma.user.findUnique({ where: { username: username.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new NotFoundException('Profil introuvable');

    const existing = await this.prisma.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId: target.id } } });
    if (existing) throw new BadRequestException('Cette personne fait déjà partie du groupe');

    const count = await this.prisma.conversationParticipant.count({ where: { conversationId } });
    if (count >= MAX_GROUP_MEMBERS) throw new BadRequestException(`Un groupe est limité à ${MAX_GROUP_MEMBERS} membres`);

    await this.prisma.conversationParticipant.create({ data: { conversationId, userId: target.id, role: 'MEMBER' } });
    return this.shapeConversation(conversationId, requesterId);
  }

  async removeMember(conversationId: string, requesterId: string, targetUsername: string) {
    await this.requireGroup(conversationId);
    await this.requireOwner(conversationId, requesterId);

    const target = await this.prisma.user.findUnique({ where: { username: targetUsername.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new NotFoundException('Profil introuvable');
    if (target.id === requesterId) throw new BadRequestException('Utilisez "quitter le groupe" pour vous retirer vous-même');

    const { count } = await this.prisma.conversationParticipant.deleteMany({ where: { conversationId, userId: target.id } });
    if (count === 0) throw new NotFoundException("Cette personne ne fait pas partie du groupe");
    return { conversationId, removedUserId: target.id };
  }

  async renameGroup(conversationId: string, requesterId: string, title: string) {
    await this.requireGroup(conversationId);
    await this.requireOwner(conversationId, requesterId);
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { title: title.trim() } });
    return this.shapeConversation(conversationId, requesterId);
  }

  async leaveConversation(conversationId: string, userId: string) {
    await this.requireGroup(conversationId);
    const me = await this.assertParticipant(conversationId, userId);

    await this.prisma.conversationParticipant.delete({ where: { conversationId_userId: { conversationId, userId } } });

    const remaining = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      orderBy: { joinedAt: 'asc' },
    });

    if (remaining.length === 0) {
      // Groupe vidé de tous ses membres : on nettoie pour ne pas laisser une conversation
      // fantôme (les messages partent en cascade avec elle).
      await this.prisma.conversation.delete({ where: { id: conversationId } });
      return { conversationId, deleted: true, promotedUserId: null };
    }

    let promotedUserId: string | null = null;
    if (me.role === 'OWNER' && !remaining.some((p) => p.role === 'OWNER')) {
      const successor = remaining[0];
      await this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: successor.userId } },
        data: { role: 'OWNER' },
      });
      promotedUserId = successor.userId;
    }
    return { conversationId, deleted: false, promotedUserId };
  }

  private async requireGroup(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({ where: { id: conversationId }, select: { id: true, isGroup: true } });
    if (!conversation) throw new NotFoundException('Conversation introuvable');
    if (!conversation.isGroup) throw new BadRequestException('Cette action est réservée aux conversations de groupe');
    return conversation;
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
        myRole: me?.role ?? 'MEMBER',
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unread,
      };
    });
    return { items, nextCursor: next?.id ?? null };
  }

  // Métadonnées d'une conversation (titre, participants, mon rôle) : nécessaire à l'en-tête de
  // la page de conversation, distinct de listMessages qui ne renvoie que les messages.
  async getConversation(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    return this.shapeConversation(conversationId, userId);
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
    const me = conversation.participants.find((p) => p.userId === userId);
    const others = conversation.participants.filter((p) => p.userId !== userId).map((p) => p.user);
    return {
      id: conversation.id,
      isGroup: conversation.isGroup,
      title: conversation.title,
      participants: others,
      myRole: me?.role ?? 'MEMBER',
      lastMessageAt: conversation.lastMessageAt,
    };
  }
}
