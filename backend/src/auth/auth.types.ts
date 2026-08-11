import { SiteRole } from '@prisma/client';

export interface AuthPrincipal {
  sub: string;
  sid: string;
  type: 'access';
  role: SiteRole;
}
