import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthPrincipal } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AddMemberDto, CreateGroupDto, CursorQueryDto, RenameGroupDto, SendMessageDto, StartConversationDto } from './messaging.dto';
import { MessagingGateway } from './messaging.gateway';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly gateway: MessagingGateway,
  ) {}

  @Get('conversations')
  conversations(@CurrentUser() principal: AuthPrincipal, @Query() query: CursorQueryDto) {
    return this.messaging.listConversations(principal.sub, query.cursor);
  }

  @Post('conversations')
  startConversation(@CurrentUser() principal: AuthPrincipal, @Body() dto: StartConversationDto) {
    return this.messaging.getOrCreateDirect(principal.sub, dto.username);
  }

  @Post('conversations/group')
  async createGroup(@CurrentUser() principal: AuthPrincipal, @Body() dto: CreateGroupDto) {
    const conversation = await this.messaging.createGroup(principal.sub, dto.title, dto.usernames);
    return conversation;
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

  @Patch('conversations/:id')
  async renameGroup(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: RenameGroupDto) {
    const conversation = await this.messaging.renameGroup(id, principal.sub, dto.title);
    this.gateway.broadcast(id, 'conversation:renamed', { conversationId: id, title: conversation.title });
    return conversation;
  }

  @Post('conversations/:id/members')
  async addMember(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal, @Body() dto: AddMemberDto) {
    const conversation = await this.messaging.addMember(id, principal.sub, dto.username);
    this.gateway.broadcast(id, 'member:added', { conversationId: id, username: dto.username });
    return conversation;
  }

  @Delete('conversations/:id/members/:username')
  async removeMember(@Param('id') id: string, @Param('username') username: string, @CurrentUser() principal: AuthPrincipal) {
    const result = await this.messaging.removeMember(id, principal.sub, username);
    this.gateway.broadcast(id, 'member:removed', { conversationId: id, username });
    this.gateway.evictUser(id, result.removedUserId);
    return result;
  }

  @Post('conversations/:id/leave')
  async leave(@Param('id') id: string, @CurrentUser() principal: AuthPrincipal) {
    const result = await this.messaging.leaveConversation(id, principal.sub);
    if (!result.deleted) {
      this.gateway.broadcast(id, 'member:left', { conversationId: id, userId: principal.sub, promotedUserId: result.promotedUserId });
    }
    this.gateway.evictUser(id, principal.sub);
    return result;
  }
}
