import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';

const socketUrl = (
  import.meta.env.VITE_WS_GATEWAY_URL ||
  import.meta.env.VITE_API_GATEWAY_URL ||
  'http://localhost:3000'
).replace(/^ws/, 'http');

let socket = null;

function getSocket() {
  if (!socket) {
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
    });
  }

  return socket;
}

export const useMatchStream = (matchId, identity) => {
  const [data, setData] = useState(null);
  const activeMatchId = useMemo(() => matchId?.trim(), [matchId]);

  useEffect(() => {
    if (!activeMatchId) return undefined;

    const activeSocket = getSocket();
    const handleMatchUpdate = (event) => {
      if (!event.matchId || event.matchId === activeMatchId) {
        setData(event);
      }
    };

    activeSocket.emit('match:join', {
      matchId: activeMatchId,
      guestId: identity?.type === 'guest' ? identity.guestId : undefined,
      userId: identity?.type === 'user' ? identity.userId : undefined,
    });
    activeSocket.on('match:update', handleMatchUpdate);

    return () => {
      activeSocket.off('match:update', handleMatchUpdate);
      activeSocket.emit('match:leave', activeMatchId);
    };
  }, [activeMatchId, identity?.type, identity?.guestId, identity?.userId]);

  return {
    gameState: data,
    isRacing: data?.type === 'START_RACE',
    isGameOver: data?.type === 'GAME_OVER',
    winner: data?.winner,
    data,
  };
};
