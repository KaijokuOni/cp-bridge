import { publish } from "@/lib/bus";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

function id() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function POST(
  req: Request,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text: string = (body.text ?? "").toString();
  const imageUrl: string | undefined = body.imageUrl;
  const kind: ChatMessage["kind"] = body.kind === "ai" || body.kind === "system" ? body.kind : "peer";

  if (!text.trim() && !imageUrl) {
    return Response.json({ error: "Empty message" }, { status: 400 });
  }
  if (!body.author?.id || !body.author?.name) {
    return Response.json({ error: "Missing author" }, { status: 400 });
  }

  const msg: ChatMessage = {
    id: id(),
    roomId,
    kind,
    author: { id: String(body.author.id), name: String(body.author.name) },
    text,
    imageUrl,
    createdAt: Date.now(),
  };

  publish(roomId, msg);
  return Response.json({ ok: true, message: msg });
}
