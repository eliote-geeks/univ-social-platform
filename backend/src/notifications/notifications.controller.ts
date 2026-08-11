import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthPrincipal } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotificationsQueryDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() principal: AuthPrincipal, @Query() query: NotificationsQueryDto) {
    return this.notifications.list(principal.sub, query.cursor);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() principal: AuthPrincipal) {
    return this.notifications.unreadCount(principal.sub);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser() principal: AuthPrincipal) {
    await this.notifications.markAllRead(principal.sub);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal) {
    return this.notifications.markRead(principal.sub, id);
  }
}
