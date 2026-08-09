import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UniversitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.university.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, shortName: true, city: true, logoUrl: true },
      orderBy: { name: 'asc' },
    });
  }

  async find(slug: string) {
    const university = await this.prisma.university.findUnique({
      where: { slug },
      include: {
        campuses: { select: { id: true, slug: true, name: true, city: true }, orderBy: { name: 'asc' } },
        faculties: {
          select: { id: true, slug: true, name: true, programs: { select: { id: true, slug: true, name: true, level: true } } },
          orderBy: { name: 'asc' },
        },
      },
    });
    if (!university || !university.isActive) throw new NotFoundException('Université introuvable');
    return university;
  }
}
