import { io, type Socket } from "socket.io-client";

export type NetMove = "punch" | "kick" | "block" | "dodge" | "aerial" | "special";

export interface NetEvents {
  // Room signaling over socket relay / local channel
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

type Listener = (...args: any[]) => void;

const SOCKET_URL =
  (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SOCKET_URL) || "";

let socket: Socket | null = null;

// Unique client instance ID that works offline/locally without requiring a socket connection ID
const myClientId = "client_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

// Multi-tab local channel fallback (guarantees instant zero-backend communication across browser tabs)
const localChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("text-to-fight-net-bus") : null;

// Registry of active event listeners
const eventListeners = new Map<string, Set<Listener>>();
const processedMsgIds = new Set<string>();

function handleIncomingMessage(event: string, payload: any) {
  if (!payload) return;

  // Ignore self-emitted messages
  if (payload.senderClientId === myClientId) return;

  // Deduplicate messages received via multiple transports
  if (payload.msgId) {
    if (processedMsgIds.has(payload.msgId)) return;
    processedMsgIds.add(payload.msgId);
    if (processedMsgIds.size > 300) {
      const first = processedMsgIds.values().next().value;
      if (first) processedMsgIds.delete(first);
    }
  }

  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach(fn => {
      try {
        fn(payload);
      } catch (err) {
        console.error(`Error in event listener for ${event}:`, err);
      }
    });
  }
}

// Setup BroadcastChannel receiver
if (localChannel) {
  localChannel.onmessage = (msgEvent) => {
    if (msgEvent.data && msgEvent.data.event && msgEvent.data.payload) {
      handleIncomingMessage(msgEvent.data.event, msgEvent.data.payload);
    }
  };
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = SOCKET_URL
    ? io(SOCKET_URL, { transports: ["websocket"], autoConnect: true })
    : io({ transports: ["websocket"], autoConnect: true });
  return socket;
}

export const net = {
  connect() {
    const s = getSocket();
    // Register socket listener for all net events if connected
    if (s && !(s as any)._netBound) {
      (s as any)._netBound = true;
      s.onAny((event: string, ...args: any[]) => {
        const payload = args[0];
        handleIncomingMessage(event, payload);
      });
    }
    return s;
  },
  getId(): string {
    const s = getSocket();
    return (s && s.id) ? s.id : myClientId;
  },
  on<K extends keyof NetEvents>(event: K, cb: NetEvents[K]) {
    net.connect();
    if (!eventListeners.has(event as string)) {
      eventListeners.set(event as string, new Set());
    }
    const set = eventListeners.get(event as string)!;
    set.add(cb as Listener);

    return () => {
      set.delete(cb as Listener);
    };
  },
  emit<K extends keyof NetEvents>(event: K, ...args: Parameters<NetEvents[K]>) {
    const rawPayload = args[0] || {};
    const msgId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const fullPayload = {
      ...(typeof rawPayload === "object" && rawPayload !== null ? rawPayload : { data: rawPayload }),
      senderClientId: myClientId,
      msgId,
    };

    // 1. Send over Socket.IO if available
    const s = getSocket();
    if (s && s.connected) {
      s.emit(event as string, fullPayload);
    }

    // 2. Send over BroadcastChannel (instant inter-tab communication)
    if (localChannel) {
      localChannel.postMessage({ event: event as string, payload: fullPayload });
    }
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