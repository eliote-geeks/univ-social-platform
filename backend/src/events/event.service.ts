import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventRsvpStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const USER_SUMMARY_SELECT = { id: true, username: true, displayName: true, avatarUrl: true } as const;
const EVENT_INCLUDE = {
  createdBy: { select: USER_SUMMARY_SELECT },
  group: { select: { slug: true, name: true } },
  page: { select: { slug: true, name: true } },
  _count: { select: { attendees: true } },
} as const;

// Même patron que myReactionInclude (posts) / groupSelectFor (groupes) : ne ramène (au plus)
// que le RSVP du visiteur courant.
function eventIncludeFor(viewerId?: string) {
  return { ...EVENT_INCLUDE, ...(viewerId ? { attendees: { where: { userId: viewerId }, select: { status: true } } } : {}) };
}
function withMyStatus<T extends { attendees?: { status: EventRsvpStatus }[] }>(event: T) {
  const { attendees, ...rest } = event;
  return { ...rest, myStatus: attendees?.[0]?.status ?? null };
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: { title: string; description?: string; location?: string; onlineUrl?: string; startAt: string; endAt?: string; groupSlug?: string; pageSlug?: string },
  ) {
    if (dto.groupSlug && dto.pageSlug) throw new BadRequestException("Un événement ne peut être rattaché qu'à un groupe OU une page, pas les deux");

    const startAt = new Date(dto.startAt);
    const endAt = dto.endAt ? new Date(dto.endAt) : undefined;
    if (endAt && endAt <= startAt) throw new BadRequestException('La date de fin doit être postérieure à la date de début');

    let groupId: string | undefined;
    let pageId: string | undefined;

    if (dto.groupSlug) {
      const group = await this.prisma.group.findUnique({ where: { slug: dto.groupSlug }, select: { id: true } });
      if (!group) throw new NotFoundException('Groupe introuvable');
      const membership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: group.id, userId } } });
      if (!membership) throw new ForbiddenException('Il faut être membre du groupe pour y créer un événement');
      groupId = group.id;
    }
    if (dto.pageSlug) {
      const page = await this.prisma.page.findUnique({ where: { slug: dto.pageSlug }, select: { id: true, ownerId: true } });
      if (!page) throw new NotFoundException('Page introuvable');
      if (page.ownerId !== userId) throw new ForbiddenException('Seul le gestionnaire de la page peut y créer un événement');
      pageId = page.id;
    }

    const event = await this.prisma.event.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim(),
        location: dto.location?.trim(),
        onlineUrl: dto.onlineUrl,
        startAt,
        endAt,
        groupId,
        pageId,
        createdById: userId,
        attendees: { create: { userId, status: 'GOING' } },
      },
      include: EVENT_INCLUDE,
    });
    return { ...event, myStatus: 'GOING' as const };
  }

  async list(filters: { groupId?: string; pageId?: string }, cursor?: string, viewerId?: string) {
    const rows = await this.prisma.event.findMany({
      where: { ...(filters.groupId ? { groupId: filters.groupId } : {}), ...(filters.pageId ? { pageId: filters.pageId } : {}) },
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: eventIncludeFor(viewerId),
    });
    const next = rows.length > 20 ? rows.pop() : undefined;
    return { items: rows.map(withMyStatus), nextCursor: next?.id ?? null };
  }

  async getById(id: string, viewerId?: string) {
    const event = await this.prisma.event.findUnique({ where: { id }, include: eventIncludeFor(viewerId) });
    if (!event) throw new NotFoundException('Événement introuvable');
    return withMyStatus(event);
  }

  private async resolveEvent(id: string) {
    const event = await this.prisma.event.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Événement introuvable');
    return event;
  }

  private async assertCanManage(event: { id: string; createdById: string; groupId: string | null; pageId: string | null }, userId: string) {
    if (event.createdById === userId) return;
    if (event.groupId) {
      const membership = await this.prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: event.groupId, userId } } });
      if (membership && (membership.role === 'OWNER' || membership.role === 'ADMIN')) return;
    }
    if (event.pageId) {
      const page = await this.prisma.page.findUnique({ where: { id: event.pageId }, select: { ownerId: true } });
      if (page?.ownerId === userId) return;
    }
    throw new ForbiddenException("Action réservée à l'organisateur de l'événement");
  }

  async update(id: string, userId: string, dto: { title?: string; description?: string; location?: string; onlineUrl?: string; startAt?: string; endAt?: string }) {
    const event = await this.resolveEvent(id);
    await this.assertCanManage(event, userId);

    const startAt = dto.startAt ? new Date(dto.startAt) : event.startAt;
    const endAt = dto.endAt !== undefined ? (dto.endAt ? new Date(dto.endAt) : null) : event.endAt;
    if (endAt && endAt <= startAt) throw new BadRequestException('La date de fin doit être postérieure à la date de début');

    return this.prisma.event.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.location !== undefined ? { location: dto.location.trim() } : {}),
        ...(dto.onlineUrl !== undefined ? { onlineUrl: dto.onlineUrl } : {}),
        ...(dto.startAt !== undefined ? { startAt } : {}),
        ...(dto.endAt !== undefined ? { endAt } : {}),
      },
      include: EVENT_INCLUDE,
    });
  }

  async remove(id: string, userId: string) {
    const event = await this.resolveEvent(id);
    await this.assertCanManage(event, userId);
    await this.prisma.event.delete({ where: { id } });
  }

  async rsvp(id: string, userId: string, status: EventRsvpStatus) {
    await this.resolveEvent(id);
    const attendee = await this.prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      create: { eventId: id, userId, status },
      update: { status, respondedAt: new Date() },
    });
    return attendee;
  }

  async removeRsvp(id: string, userId: string) {
    await this.prisma.eventAttendee.deleteMany({ where: { eventId: id, userId } });
  }

  async listAttendees(id: string, status: EventRsvpStatus | undefined, cursor?: string) {
    await this.resolveEvent(id);
    const rows = await this.prisma.eventAttendee.findMany({
      where: { eventId: id, ...(status ? { status } : {}) },
      orderBy: [{ respondedAt: 'desc' }, { userId: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { eventId_userId: { eventId: id, userId: cursor } }, skip: 1 } : {}),
      include: { user: { select: USER_SUMMARY_SELECT } },
    });
    const next = rows.length > 20 ? rows.pop() : undefined;
    return { items: rows.map((r) => ({ ...r.user, status: r.status, respondedAt: r.respondedAt })), nextCursor: next?.userId ?? null };
  }
}
