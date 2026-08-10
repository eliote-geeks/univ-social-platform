import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthPrincipal } from './auth.types';

export const CurrentUser = createParamDecorator((_: unknown, context: ExecutionContext): AuthPrincipal => {
  const request = context.switchToHttp().getRequest<Request & { user: AuthPrincipal }>();
  return request.user;
});
