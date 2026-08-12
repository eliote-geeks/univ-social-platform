import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from '../auth/auth.dto';
import { MediaService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

const PROFILE_SUMMARY_SELECT = {
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
  ) {}

  private async requireByUsername(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
    if (!user) throw new NotFoundException('Profil introuvable');
    return user;
  }

  // Widget "Qui suivre" du fil d'actu : quelques comptes actifs pas encore suivis par le
  // visiteur, hors lui-même. Tri par inscription récente, faute d'un vrai signal de pertinence
  // (centres d'intérêt communs, etc.) pour l'instant.
  async suggestions(viewerId: string, limit = 5) {
    return this.prisma.user.findMany({
      where: { id: { not: viewerId }, status: 'ACTIVE', followers: { none: { followerId: viewerId } } },
      select: PROFILE_SUMMARY_SELECT,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async publicProfile(username: string, viewerId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        role: true,
        createdAt: true,
        _count: { select: { followers: true, following: true, posts: true } },
        // Ne ramène (au plus) que la ligne de suivi du visiteur courant, jamais celle des
        // autres — d'où isFollowing dérivé ci-dessous plutôt qu'exposé tel quel.
        ...(viewerId ? { followers: { where: { followerId: viewerId }, select: { followerId: true } } } : {}),
      },
    });
    if (!user) throw new NotFoundException('Profil introuvable');
    const { followers, id, ...rest } = user as typeof user & { followers?: { followerId: string }[] };
    return { ...rest, isFollowing: !!followers?.length, isSelf: viewerId === id };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true, emailVerified: true, role: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Profil introuvable');
    return user;
  }

  // Réservé aux ADMIN (vérifié par RolesGuard côté contrôleur, pas ici).
  async updateRole(targetUsername: string, role: 'USER' | 'MODERATOR' | 'ADMIN') {
    const target = await this.requireByUsername(targetUsername);
    return this.prisma.user.update({ where: { id: target.id }, data: { role }, select: { id: true, username: true, role: true } });
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    // Les clés viennent de POST /media/upload-url (purpose: 'avatar'/'cover') : on revérifie ici
    // qu'elles pointent bien vers un objet réellement uploadé par cet utilisateur, du bon type,
    // avant de les convertir en URL publique définitive — jamais confiance dans une URL fournie
    // telle quelle par le client (même patron que les médias de post).
    const avatarUrl = dto.avatarKey !== undefined ? await this.media.assertUploadedObject(userId, dto.avatarKey, 'IMAGE', 'avatar') : undefined;
    const coverUrl = dto.coverKey !== undefined ? await this.media.assertUploadedObject(userId, dto.coverKey, 'IMAGE', 'cover') : undefined;

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}),
        ...(dto.bio !== undefined ? { bio: dto.bio.trim() } : {}),
        ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        ...(coverUrl !== undefined ? { coverUrl } : {}),
      },
      select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true },
    });
  }

  async follow(followerId: string, targetUsername: string) {
    const target = await this.requireByUsername(targetUsername);
    if (target.id === followerId) throw new BadRequestException('Impossible de se suivre soi-même');
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: target.id } },
    });
    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId: target.id } },
      create: { followerId, followingId: target.id },
      update: {},
    });
    if (!existing) await this.notifications.notifyFollow(target.id, followerId);
    return { following: true };
  }

  async unfollow(followerId: string, targetUsername: string) {
    const target = await this.requireByUsername(targetUsername);
    await this.prisma.follow.deleteMany({ where: { followerId, followingId: target.id } });
    return { following: false };
  }

  async followers(username: string, cursor?: string) {
    const target = await this.requireByUsername(username);
    const edges = await this.prisma.follow.findMany({
      where: { followingId: target.id },
      orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { followerId_followingId: { followerId: cursor, followingId: target.id } }, skip: 1 } : {}),
      include: { follower: { select: PROFILE_SUMMARY_SELECT } },
    });
    const next = edges.length > 20 ? edges.pop() : undefined;
    return { items: edges.map((edge) => edge.follower), nextCursor: next?.followerId ?? null };
  }

  async following(username: string, cursor?: string) {
    const source = await this.requireByUsername(username);
    const edges = await this.prisma.follow.findMany({
      where: { followerId: source.id },
      orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { followerId_followingId: { followerId: source.id, followingId: cursor } }, skip: 1 } : {}),
      include: { following: { select: PROFILE_SUMMARY_SELECT } },
    });
    const next = edges.length > 20 ? edges.pop() : undefined;
    return { items: edges.map((edge) => edge.following), nextCursor: next?.followingId ?? null };
  }
}
