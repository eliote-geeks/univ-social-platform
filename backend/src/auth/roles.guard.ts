import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthPrincipal } from './auth.types';
import { ROLES_KEY } from './roles.decorator';

// À utiliser après JwtAuthGuard (@UseGuards(JwtAuthGuard, RolesGuard)) : suppose que
// request.user est déjà renseigné. Le rôle vient du JWT, donc soumis au même délai de
// propagation de 15 minutes que documenté sur SiteRole dans le schéma Prisma.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;
    const request = context.switchToHttp().getRequest<Request & { user: AuthPrincipal }>();
    if (!required.includes(request.user?.role)) {
      throw new ForbiddenException('Action réservée à la modération');
    }
    return true;
  }
}
