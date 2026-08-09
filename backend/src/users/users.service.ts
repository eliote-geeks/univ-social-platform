import { Injectable, NotFoundException } from '@nestjs/common';
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
        affiliations: {
          where: { verificationStatus: 'VERIFIED' },
          select: {
            role: true,
            level: true,
            university: { select: { name: true, slug: true } },
            faculty: { select: { name: true, slug: true } },
            program: { select: { name: true, slug: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('Profil introuvable');
    return user;
  }
}
