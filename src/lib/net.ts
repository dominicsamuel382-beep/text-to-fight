import { io, type Socket } from "socket.io-client";

// Wire events for the 1v1 typing fighter. Both clients are authoritative for
// their OWN hp/combo/meter and broadcast changes; the opponent renders what
// arrives over the wire.
export type NetMove = "punch" | "kick" | "block" | "dodge" | "aerial" | "special";

export interface NetEvents {
  "match:start": () => void;
  "match:end": (payload: { winner: "me" | "you" }) => void;
  "opponent:windup": (payload: { move: NetMove }) => void;
  "opponent:attack": (payload: { move: NetMove; damage: number }) => void;
  "opponent:defense": (payload: { kind: "block" | "dodge" | null }) => void;
  "opponent:hp": (payload: { hp: number }) => void;
  "opponent:stats": (payload: { combo: number; meter: number }) => void;
  "opponent:miss": () => void;
  "opponent:disconnect": () => void;
}

type Listener = (...args: unknown[]) => void;

// The Socket.IO server URL is expected to be configured by the host env.
// If VITE_SOCKET_URL is empty the client falls back to same-origin, which
// works whenever the socket server is mounted alongside the app.
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
  on<K extends keyof NetEvents>(event: K, cb: NetEvents[K]) {
    getSocket().on(event as string, cb as Listener);
    return () => getSocket().off(event as string, cb as Listener);
  },
  emit<K extends keyof NetEvents>(event: K, ...args: Parameters<NetEvents[K]>) {
    getSocket().emit(event as string, ...args);
  },
  ready() {
    getSocket().emit("player:ready");
  },
  disconnect() {
    socket?.disconnect();
    socket = null;
  },
};