import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthPrincipal } from './auth.types';

// Pendant de CurrentUser pour les routes gardées par OptionalJwtAuthGuard : request.user peut
// être absent (visiteur anonyme) sans que ce soit une erreur.
export const OptionalUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthPrincipal | undefined => {
  const request = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
  return request.user;
});
