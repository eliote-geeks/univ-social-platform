import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { uniqueSlug } from '../common/slugify';
import { MediaService } from '../media/media.service';
import { CreatePostDto } from '../posts/posts.dto';
import { PostsService } from '../posts/posts.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_SUMMARY_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;
const PAGE_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  category: true,
  avatarUrl: true,
  coverUrl: true,
  createdAt: true,
  owner: { select: USER_SUMMARY_SELECT },
  _count: { select: { followers: true } },
} as const;

// L'ownerId ne change jamais (pas de transfert de propriété sur une Page, contrairement à
// l'OWNER d'un groupe) : owner.id dans PAGE_SELECT suffit pour dériver l'admin côté client.
// isFollowing reste nécessaire en revanche : même patron que myReactionInclude côté posts.
function pageSelectFor(viewerId?: string) {
  return { ...PAGE_SELECT, ...(viewerId ? { followers: { where: { userId: viewerId }, select: { userId: true } } } : {}) };
}
function withIsFollowing<T extends { followers?: unknown[] }>(page: T) {
  const { followers, ...rest } = page;
  return { ...rest, isFollowing: !!followers?.length };
}

@Injectable()
export class PagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly media: MediaService,
  ) {}

  async create(userId: string, name: string, description: string | undefined, category: string | undefined) {
    const slug = await uniqueSlug(name, async (candidate) => !!(await this.prisma.page.findUnique({ where: { slug: candidate }, select: { id: true } })));
    return this.prisma.page.create({
      data: { slug, name: name.trim(), description: description?.trim(), category: category?.trim(), ownerId: userId },
      select: PAGE_SELECT,
    });
  }

  async list(q: string | undefined, cursor?: string, viewerId?: string) {
    const rows = await this.prisma.page.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' as const } } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: pageSelectFor(viewerId),
    });
    const next = rows.length > 20 ? rows.pop() : undefined;
    return { items: rows.map(withIsFollowing), nextCursor: next?.id ?? null };
  }

  async getBySlug(slug: string, viewerId?: string) {
    const page = await this.prisma.page.findUnique({ where: { slug }, select: pageSelectFor(viewerId) });
    if (!page) throw new NotFoundException('Page introuvable');
    return withIsFollowing(page);
  }

  private async resolvePage(slug: string) {
    const page = await this.prisma.page.findUnique({ where: { slug } });
    if (!page) throw new NotFoundException('Page introuvable');
    return page;
  }

  private requireOwner(page: { ownerId: string }, requesterId: string) {
    if (page.ownerId !== requesterId) throw new ForbiddenException('Action réservée au gestionnaire de la page');
  }

  async update(slug: string, requesterId: string, dto: { name?: string; description?: string; category?: string; avatarKey?: string; coverKey?: string }) {
    const page = await this.resolvePage(slug);
    this.requireOwner(page, requesterId);
    const avatarUrl = dto.avatarKey !== undefined ? await this.media.assertUploadedObject(requesterId, dto.avatarKey, 'IMAGE', 'avatar') : undefined;
    const coverUrl = dto.coverKey !== undefined ? await this.media.assertUploadedObject(requesterId, dto.coverKey, 'IMAGE', 'cover') : undefined;
    return this.prisma.page.update({
      where: { id: page.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(coverUrl !== undefined ? { coverUrl } : {}),
      },
      select: PAGE_SELECT,
    });
  }

  async remove(slug: string, requesterId: string) {
    const page = await this.resolvePage(slug);
    this.requireOwner(page, requesterId);
    await this.prisma.page.delete({ where: { id: page.id } });
  }

  async follow(slug: string, userId: string) {
    const page = await this.resolvePage(slug);
    await this.prisma.pageFollower.upsert({
      where: { pageId_userId: { pageId: page.id, userId } },
      create: { pageId: page.id, userId },
      update: {},
    });
    return { pageId: page.id, following: true };
  }

  async unfollow(slug: string, userId: string) {
    const page = await this.resolvePage(slug);
    await this.prisma.pageFollower.deleteMany({ where: { pageId: page.id, userId } });
    return { pageId: page.id, following: false };
  }

  async listFollowers(slug: string, cursor?: string) {
    const page = await this.resolvePage(slug);
    const rows = await this.prisma.pageFollower.findMany({
      where: { pageId: page.id },
      orderBy: [{ followedAt: 'desc' }, { userId: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { pageId_userId: { pageId: page.id, userId: cursor } }, skip: 1 } : {}),
      include: { user: { select: USER_SUMMARY_SELECT } },
    });
    const next = rows.length > 20 ? rows.pop() : undefined;
    return { items: rows.map((r) => r.user), nextCursor: next?.userId ?? null };
  }

  async feed(slug: string, cursor?: string) {
    const page = await this.resolvePage(slug);
    return this.posts.feedForPage(page.id, cursor);
  }

  async createPost(slug: string, requesterId: string, dto: CreatePostDto) {
    const page = await this.resolvePage(slug);
    this.requireOwner(page, requesterId);
    return this.posts.create(requesterId, dto, { pageId: page.id });
  }
}
