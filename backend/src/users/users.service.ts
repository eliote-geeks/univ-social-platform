import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from '../auth/auth.dto';
import { PrismaService } from '../prisma/prisma.service';

const PROFILE_SUMMARY_SELECT = {
  username: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private async requireByUsername(username: string) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true, username: true } });
    if (!user) throw new NotFoundException('Profil introuvable');
    return user;
  }

  async publicProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        _count: { select: { followers: true, following: true, posts: true } },
      },
    });
    if (!user) throw new NotFoundException('Profil introuvable');
    return user;
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true, emailVerified: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('Profil introuvable');
    return user;
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { ...(dto.displayName !== undefined ? { displayName: dto.displayName.trim() } : {}), ...(dto.bio !== undefined ? { bio: dto.bio.trim() } : {}) },
      select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true },
    });
  }

  async follow(followerId: string, targetUsername: string) {
    const target = await this.requireByUsername(targetUsername);
    if (target.id === followerId) throw new BadRequestException('Impossible de se suivre soi-même');
    await this.prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId: target.id } },
      create: { followerId, followingId: target.id },
      update: {},
    });
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
