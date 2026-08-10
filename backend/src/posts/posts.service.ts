import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto, CreatePostDto } from './posts.dto';

const POST_INCLUDE = {
  author: { select: { username: true, displayName: true, avatarUrl: true } },
  media: { orderBy: { sortOrder: 'asc' as const } },
  _count: { select: { reactions: true, comments: true } },
};

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async create(userId: string, dto: CreatePostDto) {
    const body = dto.body?.trim();
    if (!body && !dto.media?.length) throw new BadRequestException('Une publication doit contenir un texte ou un média');
    return this.prisma.post.create({
      data: {
        authorId: userId,
        body: body || null,
        visibility: dto.visibility ?? 'PUBLIC',
        media: dto.media?.length ? { create: dto.media.map((media, sortOrder) => ({ ...media, sortOrder })) } : undefined,
      },
      include: POST_INCLUDE,
    });
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
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw new NotFoundException('Publication introuvable');
    if (dto.parentId) {
      const parent = await this.prisma.comment.findFirst({ where: { id: dto.parentId, postId }, select: { id: true } });
      if (!parent) throw new BadRequestException('Commentaire parent invalide');
    }
    return this.prisma.comment.create({
      data: { postId, authorId: userId, parentId: dto.parentId, body: dto.body.trim() },
      include: { author: { select: { username: true, displayName: true, avatarUrl: true } } },
    });
  }

  async react(postId: string, userId: string, type: ReactionType) {
    const exists = await this.prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Publication introuvable');
    return this.prisma.reaction.upsert({ where: { postId_userId: { postId, userId } }, create: { postId, userId, type }, update: { type } });
  }

  async removeReaction(postId: string, userId: string) {
    await this.prisma.reaction.deleteMany({ where: { postId, userId } });
  }
}
