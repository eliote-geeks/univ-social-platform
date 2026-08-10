import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateProfileDto } from '../auth/auth.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
