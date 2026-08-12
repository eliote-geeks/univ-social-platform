import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './config';
import { tokenStore } from './token-store';

// L'API expose le gateway de messagerie sur la même origine que le REST, sous /ws/messaging
// (cf. backend MessagingGateway). API_BASE_URL inclut /api/v1 ; on ne garde que l'origine.
function wsBaseUrl(): string {
  return new URL(API_BASE_URL).origin;
}

let socket: Socket | null = null;

// Singleton : une seule connexion WebSocket partagée par toute l'app (évite une reconnexion par
// composant qui monterait/démonterait la page de conversation). Se reconnecte automatiquement si
// le token a changé depuis la dernière connexion (ex: après un refresh de session).
export function getSocket(): Socket | null {
  const token = tokenStore.getAccessToken();
  if (!token) return null;

  if (socket && socket.auth && (socket.auth as { token?: string }).token !== token) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socket = io(`${wsBaseUrl()}/ws/messaging`, {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
