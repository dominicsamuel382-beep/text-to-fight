import { io, type Socket } from "socket.io-client";

// Wire events for the 1v1 typing fighter. Both clients are authoritative for
// their OWN hp/combo/meter and broadcast changes; the opponent renders what
// arrives over the wire.
export type NetMove = "punch" | "kick" | "block" | "dodge" | "aerial" | "special";

export interface NetEvents {
  // Room signaling over socket relay
  "room:join_request": (payload: { roomId: string; senderId: string }) => void;
  "room:accept": (payload: { roomId: string; hostId: string; targetId: string }) => void;
  "room:full": (payload: { roomId: string; targetId: string }) => void;
  "room:leave": (payload: { roomId: string }) => void;

  // In-game events (scoped to a room via roomId payload)
  "match:start": (payload?: { roomId: string }) => void;
  "match:end": (payload?: { winner: "me" | "you"; roomId?: string }) => void;
  "opponent:windup": (payload: { move: NetMove; roomId?: string }) => void;
  "opponent:attack": (payload: { move: NetMove; damage: number; roomId?: string }) => void;
  "opponent:defense": (payload: { kind: "block" | "dodge" | null; roomId?: string }) => void;
  "opponent:hp": (payload: { hp: number; roomId?: string }) => void;
  "opponent:stats": (payload: { combo: number; meter: number; roomId?: string }) => void;
  "opponent:miss": (payload?: { roomId?: string }) => void;
  "opponent:disconnect": (payload?: { roomId?: string }) => void;
}

type Listener = (...args: unknown[]) => void;

// The Socket.IO server URL is expected to be configured by the host env.
// If VITE_SOCKET_URL is empty the client falls back to same-origin.
const SOCKET_URL =
  (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SOCKET_URL) || "";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;
  socket = SOCKET_URL
    ? io(SOCKET_URL, { transports: ["websocket"], autoConnect: true })
    : io({ transports: ["websocket"], autoConnect: true });
  return socket;
}

export const net = {
  connect() {
    return getSocket();
  },
  getId(): string {
    return getSocket().id || "";
  },
  on<K extends keyof NetEvents>(event: K, cb: NetEvents[K]) {
    getSocket().on(event as string, cb as Listener);
    return () => getSocket().off(event as string, cb as Listener);
  },
  emit<K extends keyof NetEvents>(event: K, ...args: Parameters<NetEvents[K]>) {
    getSocket().emit(event as string, ...args);
  },
  disconnect() {
    socket?.disconnect();
    socket = null;
  },
};

/** Generate a human-readable 6-character room ID (letters + digits, no ambiguous chars). */
export function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}