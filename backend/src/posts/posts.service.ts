import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, CreatePostDto } from './posts.dto';

const POST_INCLUDE = {
  author: { select: { username: true, displayName: true, avatarUrl: true } },
  group: { select: { slug: true, name: true } },
  page: { select: { slug: true, name: true } },
  media: { orderBy: { sortOrder: 'asc' as const } },
  _count: { select: { reactions: true, comments: true } },
};

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly notifications: NotificationsService,
  ) {}

  async feed(cursor?: string) {
    const items = await this.prisma.post.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: POST_INCLUDE,
    });
    const next = items.length > 20 ? items.pop() : undefined;
    return { items, nextCursor: next?.id ?? null };
  }

  async feedFollowing(userId: string, cursor?: string) {
    const items = await this.prisma.post.findMany({
      where: {
        visibility: { in: ['PUBLIC', 'FOLLOWERS'] },
        author: { followers: { some: { followerId: userId } } },
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: POST_INCLUDE,
    });
    const next = items.length > 20 ? items.pop() : undefined;
    return { items, nextCursor: next?.id ?? null };
  }

  // context n'est jamais renseigné depuis le DTO public POST /posts (qui n'expose pas ces
  // champs) : uniquement passé par GroupsService/PagesService après avoir vérifié
  // l'appartenance au groupe ou la propriété de la page.
  async create(userId: string, dto: CreatePostDto, context?: { groupId?: string; pageId?: string }) {
    const body = dto.body?.trim();
    if (!body && !dto.media?.length) throw new BadRequestException('Une publication doit contenir un texte ou un média');

    // Chaque média référencé doit correspondre à un objet réellement uploadé par cet utilisateur ;
    // assertUploadedObject revérifie type/taille côté serveur et renvoie l'URL publique définitive.
    const media = dto.media?.length
      ? await Promise.all(
          dto.media.map(async ({ key, type, altText }, sortOrder) => ({
            type,
            altText,
            sortOrder,
            url: await this.media.assertUploadedObject(userId, key, type),
          })),
        )
      : undefined;

    // Un post de groupe/page est visible à qui peut voir le groupe/la page (contrôlé par
    // GroupsService/PagesService), pas par le champ visibility — celui-ci ne s'applique qu'au
    // fil personnel. On l'ignore donc silencieusement dès qu'un contexte groupe/page est fourni,
    // plutôt que de laisser un ONLY_ME fantôme réapparaître dans le fil du groupe.
    const isScoped = !!(context?.groupId || context?.pageId);

    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        body: body || null,
        visibility: isScoped ? 'PUBLIC' : (dto.visibility ?? 'PUBLIC'),
        groupId: context?.groupId,
        pageId: context?.pageId,
        media: media ? { create: media } : undefined,
      },
      include: POST_INCLUDE,
    });

    if (body) await this.notifications.notifyMentions(userId, body, { postId: post.id });
    return post;
  }

  async feedForGroup(groupId: string, cursor?: string) {
    const items = await this.prisma.post.findMany({
      where: { groupId },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: POST_INCLUDE,
    });
    const next = items.length > 20 ? items.pop() : undefined;
    return { items, nextCursor: next?.id ?? null };
  }

  async feedForPage(pageId: string, cursor?: string) {
    const items = await this.prisma.post.findMany({
      where: { pageId },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: POST_INCLUDE,
    });
    const next = items.length > 20 ? items.pop() : undefined;
    return { items, nextCursor: next?.id ?? null };
  }

  async findOne(id: string) {
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: { ...POST_INCLUDE, comments: { where: { parentId: null }, orderBy: { createdAt: 'asc' }, include: { author: { select: { username: true, displayName: true, avatarUrl: true } }, replies: { include: { author: { select: { username: true, displayName: true, avatarUrl: true } } } } } } },
    });
    if (!post || post.visibility === 'ONLY_ME') throw new NotFoundException('Publication introuvable');
    return post;
  }

  async comment(postId: string, userId: string, dto: CreateCommentDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post) throw new NotFoundException('Publication introuvable');
    let parent: { id: string; authorId: string } | null = null;
    if (dto.parentId) {
      parent = await this.prisma.comment.findFirst({ where: { id: dto.parentId, postId }, select: { id: true, authorId: true } });
      if (!parent) throw new BadRequestException('Commentaire parent invalide');
    }

    const body = dto.body.trim();
    const comment = await this.prisma.comment.create({
      data: { postId, authorId: userId, parentId: dto.parentId, body },
      include: { author: { select: { username: true, displayName: true, avatarUrl: true } } },
    });

    // Réponse -> on notifie l'auteur du commentaire parent ; commentaire de premier niveau ->
    // l'auteur de la publication. notifyComment ignore déjà l'auto-notification.
    const recipientId = parent ? parent.authorId : post.authorId;
    await this.notifications.notifyComment(recipientId, userId, postId, comment.id);
    await this.notifications.notifyMentions(userId, body, { postId, commentId: comment.id });

    return comment;
  }

  async react(postId: string, userId: string, type: ReactionType) {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true } });
    if (!post) throw new NotFoundException('Publication introuvable');
    const existing = await this.prisma.reaction.findUnique({ where: { postId_userId: { postId, userId } } });
    const reaction = await this.prisma.reaction.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId, type },
      update: { type },
    });
    if (!existing) await this.notifications.notifyReaction(post.authorId, userId, postId);
    return reaction;
  }

  async removeReaction(postId: string, userId: string) {
    await this.prisma.reaction.deleteMany({ where: { postId, userId } });
  }
}
