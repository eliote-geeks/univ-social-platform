import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ReportStatus, ReportTargetType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const REPORT_INCLUDE = {
  reporter: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
  reviewedBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
} as const;

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async fileReport(reporterId: string, targetType: ReportTargetType, targetId: string, reason: string) {
    await this.assertTargetExists(targetType, targetId);
    return this.prisma.report.create({
      data: { reporterId, targetType, targetId, reason: reason.trim() },
      include: REPORT_INCLUDE,
    });
  }

  async list(status: ReportStatus | undefined, cursor?: string) {
    const rows = await this.prisma.report.findMany({
      where: status ? { status } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 21,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: REPORT_INCLUDE,
    });
    const next = rows.length > 20 ? rows.pop() : undefined;
    return { items: rows, nextCursor: next?.id ?? null };
  }

  async review(moderatorId: string, reportId: string, status: 'ACTIONED' | 'DISMISSED', resolution: string | undefined, applyAction: boolean) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Signalement introuvable');
    if (report.status !== 'PENDING') throw new BadRequestException('Ce signalement a déjà été traité');

    if (status === 'ACTIONED' && applyAction) {
      await this.applyModerationAction(report.targetType, report.targetId);
    }

    return this.prisma.report.update({
      where: { id: reportId },
      data: { status, resolution: resolution?.trim(), reviewedById: moderatorId, reviewedAt: new Date() },
      include: REPORT_INCLUDE,
    });
  }

  private async assertTargetExists(targetType: ReportTargetType, targetId: string) {
    const exists = await this.targetExists(targetType, targetId);
    if (!exists) throw new NotFoundException('Le contenu signalé est introuvable');
  }

  private async targetExists(targetType: ReportTargetType, targetId: string): Promise<boolean> {
    switch (targetType) {
      case 'POST':
        return !!(await this.prisma.post.findUnique({ where: { id: targetId }, select: { id: true } }));
      case 'COMMENT':
        return !!(await this.prisma.comment.findUnique({ where: { id: targetId }, select: { id: true } }));
      case 'USER':
        return !!(await this.prisma.user.findUnique({ where: { id: targetId }, select: { id: true } }));
      case 'GROUP':
        return !!(await this.prisma.group.findUnique({ where: { id: targetId }, select: { id: true } }));
      case 'PAGE':
        return !!(await this.prisma.page.findUnique({ where: { id: targetId }, select: { id: true } }));
      case 'EVENT':
        return !!(await this.prisma.event.findUnique({ where: { id: targetId }, select: { id: true } }));
    }
  }

  // Sanction appliquée quand un modérateur clôt un signalement en ACTIONED. Best-effort : si la
  // cible a déjà disparu entre-temps (P2025), on l'ignore silencieusement plutôt que de bloquer
  // la clôture du signalement.
  private async applyModerationAction(targetType: ReportTargetType, targetId: string) {
    try {
      switch (targetType) {
        case 'POST':
          await this.prisma.post.delete({ where: { id: targetId } });
          break;
        case 'COMMENT':
          await this.prisma.comment.delete({ where: { id: targetId } });
          break;
        case 'USER':
          await this.prisma.user.update({ where: { id: targetId }, data: { status: 'SUSPENDED' } });
          break;
        case 'GROUP':
          await this.prisma.group.delete({ where: { id: targetId } });
          break;
        case 'PAGE':
          await this.prisma.page.delete({ where: { id: targetId } });
          break;
        case 'EVENT':
          await this.prisma.event.delete({ where: { id: targetId } });
          break;
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return;
      throw error;
    }
  }
}
