import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseWsExceptionFilter } from '@nestjs/websockets';
import { Socket } from 'socket.io';

// Sans ce filtre, toute exception levée avant l'entrée dans un handler (typiquement un rejet du
// ValidationPipe sur un message WS malformé) est convertie par Nest en un événement `exception`
// générique ("Internal server error"), différent du format `error` utilisé partout ailleurs dans
// ce gateway. On uniformise ici sur un seul événement `error` avec un message exploitable côté client.
@Catch()
export class MessagingExceptionFilter extends BaseWsExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const client = host.switchToWs().getClient<Socket>();
    let message = 'Une erreur est survenue';
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const raw = typeof response === 'string' ? response : (response as { message?: string | string[] }).message;
      message = Array.isArray(raw) ? raw[0] : (raw ?? exception.message);
    }
    client.emit('error', { message });
  }
}
