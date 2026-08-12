import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaService } from '../media/media.service';
import { CreatePostDto } from '../posts/posts.dto';
import { PostsService } from '../posts/posts.service';
import { PrismaService } from '../prisma/prisma.service';
import { uniqueSlug } from '../common/slugify';

const USER_SUMMARY_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;
const GROUP_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  visibility: true,
  coverUrl: true,
  createdAt: true,
  createdBy: { select: USER_SUMMARY_SELECT },
  _count: { select: { members: true } },
} as const;

// Même patron que myReactionInclude côté posts : ne ramène (au plus) que la ligne de membership
// du visiteur courant, jamais celle des autres — le frontend en a besoin pour savoir s'il doit
// afficher "Rejoindre" / "Quitter" / les contrôles d'administration.
function groupSelectFor(viewerId?: string) {
  return { ...GROUP_SELECT, ...(viewerId ? { members: { where: { userId: viewerId }, select: { role: true } } } : {}) };
}
function withMyRole<T extends { members?: { role: string }[] }>(group: T) {
  const { members, ...rest } = group;
  return { ...rest, myRole: members?.[0]?.role ?? null };
}

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly posts: PostsService,
    private readonly media: MediaService,
  ) {}

  async create(userId: string, name: string, description: string | undefined, visibility: 'PUBLIC' | 'PRIVATE' | undefined) {
    const slug = await uniqueSlug(name, async (candidate) => !!(await this.prisma.group.findUnique({ where: { slug: candidate }, select: { id: true } })));
    const group = await this.prisma.group.create({
      data: {
        slug,
        name: name.trim(),
        description: description?.trim(),
        visibility: visibility ?? 'PUBLIC',
        createdById: userId,
        members: { create: { userId, role: 'OWNER' } },
      },
      select: GROUP_SELECT,
    });
    return { ...group, myRole: 'OWNER' as const };
  }

  async list(requesterId: string | undefined, q: string | undefined, cursor?: string) {
    const rows = await this.prisma.group.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
        OR: [{ visibility: 'PUBLIC' }, ...(requesterId ? [{ members: { some: { userId: requesterId } } }] : [])],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: groupSelectFor(requesterId),
    });
    const next = rows.length > 20 ? rows.pop() : undefined;
    return { items: rows.map(withMyRole), nextCursor: next?.id ?? null };
  }

  async getBySlug(slug: string, requesterId?: string) {
    const group = await this.prisma.group.findUnique({ where: { slug }, select: groupSelectFor(requesterId) });
    if (!group) throw new NotFoundException('Groupe introuvable');
    if (group.visibility === 'PRIVATE') {
      const isMember = requesterId ? await this.isMember(group.id, requesterId) : false;
      // 404 (pas 403) pour ne pas révéler l'existence d'un groupe privé à qui n'y est pas.
      if (!isMember) throw new NotFoundException('Groupe introuvable');
    }
    return withMyRole(group);
  }

  private async resolveGroup(slug: string) {
    const group = await this.prisma.group.findUnique({ where: { slug } });
    if (!group) throw new NotFoundException('Groupe introuvable');
    return group;
  }

  private async isMember(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    return !!membership;
  }

  private async requireMembership(groupId: string, userId: string) {
    const membership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId, userId } } });
    if (!membership) throw new NotFoundException('Groupe introuvable');
    return membership;
  }

  private async requireManager(groupId: string, userId: string) {
    const membership = await this.requireMembership(groupId, userId);
    if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
      throw new ForbiddenException('Action réservée aux administrateurs du groupe');
    }
    return membership;
  }

  async join(slug: string, userId: string) {
    const group = await this.resolveGroup(slug);
    if (group.visibility === 'PRIVATE') throw new ForbiddenException('Ce groupe est privé, une invitation est nécessaire');
    await this.prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId } },
      create: { groupId: group.id, userId, role: 'MEMBER' },
      update: {},
    });
    return { groupId: group.id, joined: true };
  }

  async addMember(slug: string, requesterId: string, targetUsername: string) {
    const group = await this.resolveGroup(slug);
    await this.requireManager(group.id, requesterId);
    const target = await this.prisma.user.findUnique({ where: { username: targetUsername.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new NotFoundException('Profil introuvable');
    const existing = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: target.id } } });
    if (existing) throw new BadRequestException('Cette personne fait déjà partie du groupe');
    await this.prisma.groupMember.create({ data: { groupId: group.id, userId: target.id, role: 'MEMBER' } });
    return { groupId: group.id, addedUserId: target.id };
  }

  async removeMember(slug: string, requesterId: string, targetUsername: string) {
    const group = await this.resolveGroup(slug);
    const requester = await this.requireManager(group.id, requesterId);
    const target = await this.prisma.user.findUnique({ where: { username: targetUsername.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new NotFoundException('Profil introuvable');
    if (target.id === requesterId) throw new BadRequestException('Utilisez "quitter le groupe" pour vous retirer vous-même');

    const targetMembership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: target.id } } });
    if (!targetMembership) throw new NotFoundException('Cette personne ne fait pas partie du groupe');
    if (targetMembership.role === 'OWNER') throw new ForbiddenException("Impossible de retirer le créateur du groupe");
    // Un ADMIN ne peut retirer que de simples membres, pas un autre ADMIN : seul l'OWNER a
    // autorité sur les ADMIN.
    if (targetMembership.role === 'ADMIN' && requester.role !== 'OWNER') {
      throw new ForbiddenException("Seul le créateur du groupe peut retirer un administrateur");
    }

    await this.prisma.groupMember.delete({ where: { groupId_userId: { groupId: group.id, userId: target.id } } });
    return { groupId: group.id, removedUserId: target.id };
  }

  async updateMemberRole(slug: string, requesterId: string, targetUsername: string, role: 'ADMIN' | 'MEMBER') {
    const group = await this.resolveGroup(slug);
    const requester = await this.requireMembership(group.id, requesterId);
    if (requester.role !== 'OWNER') throw new ForbiddenException('Seul le créateur du groupe peut changer les rôles');
    const target = await this.prisma.user.findUnique({ where: { username: targetUsername.trim().toLowerCase() }, select: { id: true } });
    if (!target) throw new NotFoundException('Profil introuvable');
    const targetMembership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: target.id } } });
    if (!targetMembership) throw new NotFoundException('Cette personne ne fait pas partie du groupe');
    if (targetMembership.role === 'OWNER') throw new BadRequestException('Impossible de changer le rôle du créateur');

    await this.prisma.groupMember.update({ where: { groupId_userId: { groupId: group.id, userId: target.id } }, data: { role } });
    return { groupId: group.id, userId: target.id, role };
  }

  async leave(slug: string, userId: string) {
    const group = await this.resolveGroup(slug);
    const me = await this.requireMembership(group.id, userId);
    await this.prisma.groupMember.delete({ where: { groupId_userId: { groupId: group.id, userId } } });

    const remaining = await this.prisma.groupMember.findMany({ where: { groupId: group.id }, orderBy: { joinedAt: 'asc' } });
    if (remaining.length === 0) {
      await this.prisma.group.delete({ where: { id: group.id } });
      return { groupId: group.id, deleted: true, promotedUserId: null };
    }

    let promotedUserId: string | null = null;
    if (me.role === 'OWNER' && !remaining.some((m) => m.role === 'OWNER')) {
      // Priorité à un ADMIN existant avant un simple MEMBRE, puis ancienneté.
      const successor = remaining.find((m) => m.role === 'ADMIN') ?? remaining[0];
      await this.prisma.groupMember.update({ where: { groupId_userId: { groupId: group.id, userId: successor.userId } }, data: { role: 'OWNER' } });
      promotedUserId = successor.userId;
    }
    return { groupId: group.id, deleted: false, promotedUserId };
  }

  async update(slug: string, requesterId: string, dto: { name?: string; description?: string; visibility?: 'PUBLIC' | 'PRIVATE'; coverKey?: string }) {
    const group = await this.resolveGroup(slug);
    const membership = await this.requireManager(group.id, requesterId);
    const coverUrl = dto.coverKey !== undefined ? await this.media.assertUploadedObject(requesterId, dto.coverKey, 'IMAGE', 'cover') : undefined;
    const updated = await this.prisma.group.update({
      where: { id: group.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(coverUrl !== undefined ? { coverUrl } : {}),
      },
      select: GROUP_SELECT,
    });
    return { ...updated, myRole: membership.role };
  }

  async remove(slug: string, requesterId: string) {
    const group = await this.resolveGroup(slug);
    const membership = await this.requireMembership(group.id, requesterId);
    if (membership.role !== 'OWNER') throw new ForbiddenException('Seul le créateur du groupe peut le supprimer');
    await this.prisma.group.delete({ where: { id: group.id } });
  }

  async listMembers(slug: string, requesterId: string | undefined, cursor?: string) {
    await this.getBySlug(slug, requesterId); // applique la même règle de visibilité que la fiche groupe
    const group = await this.resolveGroup(slug);
    const rows = await this.prisma.groupMember.findMany({
      where: { groupId: group.id },
      orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
      take: 21,
      ...(cursor ? { cursor: { groupId_userId: { groupId: group.id, userId: cursor } }, skip: 1 } : {}),
      include: { user: { select: USER_SUMMARY_SELECT } },
    });
    const next = rows.length > 20 ? rows.pop() : undefined;
    return { items: rows.map((r) => ({ ...r.user, role: r.role, joinedAt: r.joinedAt })), nextCursor: next?.userId ?? null };
  }

  async feed(slug: string, requesterId: string | undefined, cursor?: string) {
    const group = await this.getBySlug(slug, requesterId); // vérifie déjà la visibilité
    return this.posts.feedForGroup(group.id, cursor);
  }

  async createPost(slug: string, requesterId: string, dto: CreatePostDto) {
    const group = await this.resolveGroup(slug);
    const membership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId: requesterId } } });
    if (!membership) {
      // Groupe privé : on ne révèle pas son existence à un non-membre (cohérent avec
      // getBySlug/feed). Groupe public : l'utilisateur vient potentiellement de le consulter en
      // 200, un 404 "introuvable" serait trompeur — 403 explicite à la place.
      if (group.visibility === 'PRIVATE') throw new NotFoundException('Groupe introuvable');
      throw new ForbiddenException('Il faut être membre du groupe pour y publier');
    }
    return this.posts.create(requesterId, dto, { groupId: group.id });
  }
}
