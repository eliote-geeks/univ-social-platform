import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CursorQueryDto, SendMessageDto, StartConversationDto } from './messaging.dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('conversations')
  conversations(@CurrentUser() principal: AuthPrincipal, @Query() query: CursorQueryDto) {
    return this.messaging.listConversations(principal.sub, query.cursor);
  }

  @Post('conversations')
  startConversation(@CurrentUser() principal: AuthPrincipal, @Body() dto: StartConversationDto) {
    return this.messaging.getOrCreateDirect(principal.sub, dto.username);
  }

  @Get('conversations/:id/messages')
  messages(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Query() query: CursorQueryDto) {
    return this.messaging.listMessages(id, principal.sub, query.cursor);
  }

  // Fallback REST au cas où le client n'a pas de connexion WebSocket active ; passe par le
  // même service que le gateway, donc même comportement (mise à jour lastMessageAt, etc.).
  @Post('conversations/:id/messages')
  send(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: SendMessageDto) {
    return this.messaging.sendMessage(id, principal.sub, dto.body);
  }

  @Patch('conversations/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal) {
    return this.messaging.markRead(id, principal.sub);
  }
}
