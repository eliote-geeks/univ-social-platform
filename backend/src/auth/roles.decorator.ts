import { SetMetadata } from '@nestjs/common';
import { SiteRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: SiteRole[]) => SetMetadata(ROLES_KEY, roles);
