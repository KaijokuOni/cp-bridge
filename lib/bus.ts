import type { ChatMessage } from "./types";

/**
 * In-memory pub/sub for room messages.
 *
 * This lives at module scope so it is shared across all requests handled by the
 * SAME Node process. That makes it perfect for:
 *   - `next dev` / `next start` (a single long-lived server)
 *   - running locally and exposing the port via a tunnel (ngrok / cloudflared)
 *
 * Caveat: on Vercel's serverless runtime each function invocation can land on a
 * different instance, so cross-instance realtime is NOT guaranteed there. For a
 * production multi-instance deploy, swap this module for Redis pub/sub
 * (e.g. Upstash) — the interface below is intentionally tiny to make that easy.
 */

type Subscriber = (msg: ChatMessage) => void;

type Room = {
  subscribers: Set<Subscriber>;
  history: ChatMessage[];
};

const HISTORY_LIMIT = 200;

// Survive Next.js hot-reloads in dev by stashing state on globalThis.
const g = globalThis as unknown as { __cpBridgeRooms?: Map<string, Room> };
const rooms: Map<string, Room> = g.__cpBridgeRooms ?? new Map();
g.__cpBridgeRooms = rooms;

function getRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = { subscribers: new Set(), history: [] };
    rooms.set(roomId, room);
  }
  return room;
}

export function publish(roomId: string, msg: ChatMessage): void {
  const room = getRoom(roomId);
  room.history.push(msg);
  if (room.history.length > HISTORY_LIMIT) {
    room.history.splice(0, room.history.length - HISTORY_LIMIT);
  }
  for (const sub of room.subscribers) {
    try {
      sub(msg);
    } catch {
      // Ignore a broken subscriber; it will be cleaned up on disconnect.
    }
  }
}

export function subscribe(roomId: string, sub: Subscriber): () => void {
  const room = getRoom(roomId);
  room.subscribers.add(sub);
  return () => {
    room.subscribers.delete(sub);
  };
}

export function getHistory(roomId: string): ChatMessage[] {
  return getRoom(roomId).history;
}

export function roomCount(roomId: string): number {
  return getRoom(roomId).subscribers.size;
}
