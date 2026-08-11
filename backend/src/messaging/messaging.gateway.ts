import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { AuthPrincipal } from '../auth/auth.types';
import { MessagingService } from './messaging.service';
import { MessagingExceptionFilter } from './ws-exception.filter';

class JoinConversationDto {
  @IsString()
  @MaxLength(64)
  conversationId!: string;
}

class SendMessageWsDto {
  @IsString()
  @MaxLength(64)
  conversationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string;
}

const roomName = (conversationId: string) => `conversation:${conversationId}`;

// Mêmes origines que l'API REST (cf. main.ts) ; lu directement depuis process.env car les
// options du décorateur sont évaluées au chargement de la classe, avant l'injection Nest/ConfigService.
const corsOrigins = (process.env.CORS_ORIGINS ?? '').split(',').map((v) => v.trim()).filter(Boolean);

@WebSocketGateway({ namespace: '/ws/messaging', cors: { origin: corsOrigins.length ? corsOrigins : false, credentials: true } })
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@UseFilters(new MessagingExceptionFilter())
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MessagingGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly messaging: MessagingService,
  ) {}

  async handleConnection(client: Socket) {
    const raw = client.handshake.auth?.token as string | undefined;
    const token = raw ?? client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');
    try {
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<AuthPrincipal>(token);
      if (payload.type !== 'access') throw new Error('wrong token type');
      client.data.userId = payload.sub;
    } catch {
      client.emit('error', { message: 'Authentification invalide' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Déconnexion socket ${client.id}`);
  }

  @SubscribeMessage('conversation:join')
  async onJoin(@ConnectedSocket() client: Socket, @MessageBody() data: JoinConversationDto) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    // Laisse l'exception (404 si non-participant) remonter au MessagingExceptionFilter,
    // qui émettra un événement `error` uniforme au client.
    await this.messaging.assertParticipant(data.conversationId, userId);
    await client.join(roomName(data.conversationId));
    client.emit('conversation:joined', { conversationId: data.conversationId });
  }

  @SubscribeMessage('conversation:leave')
  async onLeave(@ConnectedSocket() client: Socket, @MessageBody() data: JoinConversationDto) {
    await client.leave(roomName(data.conversationId));
  }

  @SubscribeMessage('message:send')
  async onSend(@ConnectedSocket() client: Socket, @MessageBody() data: SendMessageWsDto) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    const message = await this.messaging.sendMessage(data.conversationId, userId, data.body);
    this.server.to(roomName(data.conversationId)).emit('message:new', { conversationId: data.conversationId, message });
  }

  @SubscribeMessage('conversation:read')
  async onRead(@ConnectedSocket() client: Socket, @MessageBody() data: JoinConversationDto) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    const result = await this.messaging.markRead(data.conversationId, userId);
    this.server.to(roomName(data.conversationId)).emit('conversation:read', { conversationId: data.conversationId, userId, readAt: result.readAt });
  }
}
