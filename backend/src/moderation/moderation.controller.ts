import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateReportDto, CursorQueryDto, ReviewReportDto } from './moderation.dto';
import { ModerationService } from './moderation.service';

@Controller('moderation')
@UseGuards(JwtAuthGuard)
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  // Ouvert à tout utilisateur authentifié : signaler du contenu ne demande aucun rôle particulier.
  @Post('reports')
  fileReport(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateReportDto) {
    return this.moderation.fileReport(principal.sub, dto.targetType, dto.targetId, dto.reason);
  }

  @Get('reports')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN')
  list(@Query() query: CursorQueryDto) {
    return this.moderation.list(query.status, query.cursor);
  }

  @Patch('reports/:id')
  @UseGuards(RolesGuard)
  @Roles('MODERATOR', 'ADMIN')
  review(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: ReviewReportDto) {
    return this.moderation.review(principal.sub, id, dto.status, dto.resolution, dto.applyAction ?? true);
  }
}
