import { io, Socket } from 'socket.io-client';
import { getSocketBaseUrl, onServerUrlChange } from '../api/serverConfig';

let socketInstance: Socket | null = null;
let currentToken: string | null = null;

// Listen for server URL changes and automatically reconnect
onServerUrlChange((newUrl) => {
  if (currentToken && socketInstance) {
    console.log('[Socket.IO Mobile] Server URL changed to:', newUrl, '- Reconnecting...');
    disconnectSocket();
    initSocket(currentToken);
  }
});

export function initSocket(token: string): Socket {
  currentToken = token;

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }

  const socketUrl = getSocketBaseUrl();
  console.log('[Socket.IO Mobile] Connecting to:', socketUrl);

  socketInstance = io(socketUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 10000,
  });

  socketInstance.on('connect', () => {
    console.log('[Socket.IO Mobile] Connected, socket ID:', socketInstance?.id);
  });

  socketInstance.on('connect_error', (err) => {
    console.warn('[Socket.IO Mobile] Connection error:', err.message);
  });

  return socketInstance;
}

export function getSocket(): Socket | null {
  return socketInstance;
}

export function disconnectSocket(): void {
  currentToken = null;
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
