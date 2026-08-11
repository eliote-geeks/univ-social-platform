import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { AuthPrincipal } from './auth.types';

// Pour les routes consultables sans compte (groupes/pages publics) mais dont la réponse change
// si l'appelant est connecté (ex : visibilité d'un groupe privé dont il est membre). Ne rejette
// jamais la requête : un token absent ou invalide laisse simplement request.user à undefined.
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return true;
    try {
      const payload = await this.jwt.verifyAsync<AuthPrincipal>(token);
      if (payload.type === 'access') request.user = payload;
    } catch {
      // Token présent mais invalide/expiré : on continue en mode anonyme plutôt que de rejeter,
      // pour ne pas casser la consultation publique à cause d'un token client périmé.
    }
    return true;
  }
}
