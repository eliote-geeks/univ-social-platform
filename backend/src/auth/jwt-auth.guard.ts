import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthPrincipal } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: AuthPrincipal }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Token manquant');
    try {
      const payload = await this.jwt.verifyAsync<AuthPrincipal>(token);
      if (payload.type !== 'access') throw new UnauthorizedException('Token invalide');
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Session invalide ou expirée');
    }
  }
}
