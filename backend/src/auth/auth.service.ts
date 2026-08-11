import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SiteRole } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

type SessionUser = { id: string; email: string; username: string; displayName: string; role: SiteRole };

// Hash bidon utilisé pour égaliser le temps de réponse quand l'utilisateur n'existe pas,
// afin qu'un attaquant ne puisse pas déduire par le timing si un e-mail est enregistré.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$X2QhU4tXf3XyaLZfF6P1XwZzHhslQ1hKQd0RY6JKV6E';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string, userAgent?: string) {
    const email = dto.email.trim().toLowerCase();
    const username = dto.username.trim().toLowerCase();
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (existing) throw new ConflictException('Cet e-mail ou identifiant est déjà utilisé');

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        displayName: dto.displayName.trim(),
        passwordHash: await argon2.hash(dto.password, { type: argon2.argon2id }),
      },
    });
    return this.createSession(user, ipAddress, userAgent);
  }

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.trim().toLowerCase() } });
    // On vérifie toujours un hash (réel ou bidon) pour que le temps de réponse ne révèle pas
    // si l'e-mail existe en base (protection contre l'énumération de comptes par timing).
    const passwordOk = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, dto.password).catch(() => false);
    if (!user || user.status !== 'ACTIVE' || !passwordOk) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect');
    }
    return this.createSession(user, ipAddress, userAgent);
  }

  async refresh(refreshToken: string, ipAddress?: string, userAgent?: string) {
    let payload: { sub: string; sid: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken);
    } catch {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException('Session invalide');

    const session = await this.prisma.session.findUnique({ include: { user: true }, where: { id: payload.sid } });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
    if (!(await argon2.verify(session.refreshTokenHash, refreshToken))) {
      await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('Session invalide');
    }

    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return this.createSession(session.user, ipAddress, userAgent);
  }

  logout(sessionId: string) {
    return this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  // Résout le problème de l'œuf-et-la-poule des rôles : personne ne peut promouvoir le premier
  // ADMIN via l'endpoint réservé aux ADMIN puisqu'il n'en existe encore aucun. Cette route
  // s'auto-désactive dès qu'un ADMIN existe, et exige un secret côté serveur (jamais commité,
  // cf. kubectl create secret côté infra) en plus d'être déjà authentifié.
  async bootstrapAdmin(userId: string, token: string, ipAddress?: string, userAgent?: string) {
    const expected = this.config.get<string>('ADMIN_BOOTSTRAP_TOKEN');
    if (!expected) throw new ServiceUnavailableException("Bootstrap admin non configuré sur ce serveur");
    if (!timingSafeEqual(token, expected)) throw new ForbiddenException('Jeton de bootstrap invalide');

    const existingAdmin = await this.prisma.user.findFirst({ where: { role: 'ADMIN' } });
    if (existingAdmin) throw new ForbiddenException('Un administrateur existe déjà sur ce serveur');

    const user = await this.prisma.user.update({ where: { id: userId }, data: { role: 'ADMIN' } });
    return this.createSession(user, ipAddress, userAgent);
  }

  private async createSession(user: SessionUser, ipAddress?: string, userAgent?: string) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const session = await this.prisma.session.create({
      data: { userId: user.id, refreshTokenHash: 'pending', expiresAt, ipAddress, userAgent },
    });
    const accessToken = await this.jwt.signAsync({ sub: user.id, sid: session.id, type: 'access', role: user.role }, { expiresIn: '15m' });
    const refreshToken = await this.jwt.signAsync({ sub: user.id, sid: session.id, type: 'refresh' }, { expiresIn: '30d' });
    await this.prisma.session.update({ where: { id: session.id }, data: { refreshTokenHash: await argon2.hash(refreshToken) } });
    return { accessToken, refreshToken, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, role: user.role } };
  }
}

// Comparaison à temps constant pour éviter qu'un attaquant ne devine le jeton de bootstrap
// caractère par caractère via le timing des réponses (même logique que DUMMY_HASH ci-dessus).
function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
