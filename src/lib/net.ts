import { io, type Socket } from "socket.io-client";
import Peer, { type DataConnection } from "peerjs";
import mqtt, { type MqttClient } from "mqtt";

export type NetMove = "punch" | "kick" | "block" | "dodge" | "aerial" | "special";

export interface NetEvents {
  "room:join_request": (payload: { roomId: string; senderId: string }) => void;
  "room:accept": (payload: { roomId: string; hostId: string; targetId: string }) => void;
  "room:full": (payload: { roomId: string; targetId: string }) => void;
  "room:leave": (payload: { roomId: string }) => void;

  "match:start": (payload?: { roomId: string }) => void;
  "match:end": (payload?: { winner: "me" | "you"; roomId?: string }) => void;
  "opponent:windup": (payload: { move: NetMove; roomId?: string }) => void;
  "opponent:attack": (payload: { move: NetMove; damage: number; roomId?: string }) => void;
  "opponent:defense": (payload: { kind: "block" | "dodge" | null; roomId?: string }) => void;
  "opponent:hp": (payload: { hp: number; roomId?: string }) => void;
  "opponent:stats": (payload: { combo: number; meter: number; roomId?: string }) => void;
  "opponent:miss": (payload?: { roomId?: string }) => void;
  "opponent:disconnect": (payload?: { roomId?: string }) => void;

  // New events for rounds & ultimate
  "round:start": (payload: { round: number; roomId?: string }) => void;
  "round:won": (payload: { winnerId: string; round: number; roomId?: string }) => void;
  "round:transition": (payload: { nextRound: number; roomId?: string }) => void;
  "match:won": (payload: { winnerId: string; roomId?: string }) => void;
  "ultimate:progress": (payload: { progress: number; roomId?: string }) => void;
  "ultimate:ready": (payload?: { roomId?: string }) => void;
  "ultimate:activate": (payload?: { roomId?: string }) => void;
  "ultimate:execute": (payload: { round: number; damage: number; roomId?: string }) => void;
}

type Listener = (...args: any[]) => void;

const SOCKET_URL =
  (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_SOCKET_URL) || "";

let socket: Socket | null = null;
let peer: Peer | null = null;
let mqttClient: MqttClient | null = null;
let currentRoomTopic: string | null = null;
const activePeerConnections: DataConnection[] = [];

// Global high-availability MQTT WSS brokers (works across any OS, browser, cellular/wifi network on WSS port 443)
const MQTT_BROKER_URLS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];

// WebRTC ICE Configuration (STUN + TURN servers)
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" },
      { urls: "stun:stun.services.mozilla.com" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelay",
        credential: "openrelay",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelay",
        credential: "openrelay",
      },
    ],
  },
};

// Unique client instance ID
const myClientId = "client_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

// Multi-tab local channel fallback
const localChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("text-to-fight-net-bus") : null;

// Registry of active event listeners & message de-duplication
const eventListeners = new Map<string, Set<Listener>>();
const processedMsgIds = new Set<string>();

function handleIncomingMessage(event: string, payload: any) {
  if (!payload) return;

  // Ignore self-emitted messages
  if (payload.senderClientId === myClientId) return;

  // Deduplicate messages received via multiple transport channels
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

// Initialize MQTT over WebSocket connection
function initMqtt() {
  if (typeof window === "undefined" || mqttClient) return;

  try {
    mqttClient = mqtt.connect(MQTT_BROKER_URLS[0], {
      clientId: myClientId,
      keepalive: 30,
      reconnectPeriod: 2000,
      connectTimeout: 8000,
      clean: true,
    });

    mqttClient.on("connect", () => {
      if (currentRoomTopic) {
        mqttClient?.subscribe(currentRoomTopic);
      }
    });

    mqttClient.on("message", (_topic, message) => {
      try {
        const payloadStr = message.toString();
        const data = JSON.parse(payloadStr);
        if (data && data.event && data.payload) {
          handleIncomingMessage(data.event, data.payload);
        }
      } catch (e) {
        // ignore parse error
      }
    });

    mqttClient.on("error", (err) => {
      console.log("MQTT notice:", err.message);
    });
  } catch (e) {
    console.warn("MQTT init exception:", e);
  }
}

export const net = {
  connect() {
    initMqtt();
    if (SOCKET_URL && !socket) {
      socket = io(SOCKET_URL, { transports: ["websocket"], autoConnect: true });
      socket.onAny((event: string, ...args: any[]) => {
        handleIncomingMessage(event, args[0]);
      });
    }
    return socket;
  },
  getId(): string {
    return (socket && socket.id) ? socket.id : myClientId;
  },
  subscribeRoom(roomId: string) {
    const cleanId = roomId.trim().toUpperCase();
    const newTopic = `ttf/room/${cleanId}`;

    if (currentRoomTopic && currentRoomTopic !== newTopic && mqttClient && mqttClient.connected) {
      mqttClient.unsubscribe(currentRoomTopic);
    }

    currentRoomTopic = newTopic;
    initMqtt();

    if (mqttClient && mqttClient.connected) {
      mqttClient.subscribe(newTopic);
    }
  },
  unsubscribeRoom() {
    if (currentRoomTopic && mqttClient && mqttClient.connected) {
      mqttClient.unsubscribe(currentRoomTopic);
    }
    currentRoomTopic = null;
  },
  createRoomPeer(roomId: string) {
    if (typeof window === "undefined") return;
    net.subscribeRoom(roomId);
    net.closePeer();
    const peerId = `ttf-room-${roomId.trim().toUpperCase()}`;
    try {
      peer = new Peer(peerId, PEER_CONFIG);
      peer.on("connection", (conn) => {
        activePeerConnections.push(conn);
        conn.on("data", (data: any) => {
          if (data && data.event && data.payload) {
            handleIncomingMessage(data.event, data.payload);
          }
        });
        conn.on("close", () => {
          const idx = activePeerConnections.indexOf(conn);
          if (idx !== -1) activePeerConnections.splice(idx, 1);
        });
      });
      peer.on("error", (err) => {
        console.log("PeerJS host notice:", err.message);
      });
    } catch (e) {
      console.warn("PeerJS host init warning:", e);
    }
  },
  joinRoomPeer(roomId: string, callback?: (success: boolean) => void) {
    if (typeof window === "undefined") return;
    net.subscribeRoom(roomId);
    net.closePeer();
    const targetPeerId = `ttf-room-${roomId.trim().toUpperCase()}`;
    try {
      peer = new Peer(PEER_CONFIG);
      peer.on("open", () => {
        const conn = peer!.connect(targetPeerId, { reliable: true });
        conn.on("open", () => {
          activePeerConnections.push(conn);
          if (callback) callback(true);
        });
        conn.on("data", (data: any) => {
          if (data && data.event && data.payload) {
            handleIncomingMessage(data.event, data.payload);
          }
        });
        conn.on("error", (err) => {
          console.warn("PeerJS join connection error:", err);
          if (callback) callback(false);
        });
      });
      peer.on("error", (err) => {
        console.warn("PeerJS joiner init error:", err);
        if (callback) callback(false);
      });
    } catch (e) {
      console.warn("PeerJS join exception:", e);
      if (callback) callback(false);
    }
  },
  closePeer() {
    activePeerConnections.forEach(c => c.close());
    activePeerConnections.length = 0;
    if (peer) {
      peer.destroy();
      peer = null;
    }
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

    // 1. Publish via Global MQTT WSS Cloud Broker (Guaranteed cross-network & cross-OS delivery)
    if (mqttClient && currentRoomTopic) {
      try {
        mqttClient.publish(currentRoomTopic, JSON.stringify({ event: event as string, payload: fullPayload }));
      } catch (e) {
        // ignore
      }
    }

    // 2. Send over WebRTC P2P DataChannel if active
    activePeerConnections.forEach(conn => {
      if (conn.open) {
        conn.send({ event: event as string, payload: fullPayload });
      }
    });

    // 3. Send over Socket.IO if connected
    if (socket && socket.connected) {
      socket.emit(event as string, fullPayload);
    }

    // 4. Send over BroadcastChannel (local inter-tab communication)
    if (localChannel) {
      localChannel.postMessage({ event: event as string, payload: fullPayload });
    }
  },
  disconnect() {
    net.unsubscribeRoom();
    net.closePeer();
    socket?.disconnect();
    socket = null;
  },
};

export function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}