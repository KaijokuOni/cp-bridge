import { subscribe, getHistory } from "@/lib/bus";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Server-Sent Events stream: pushes every new room message to the client.
export async function GET(
  _req: Request,
  { params }: { params: { roomId: string } }
) {
  const roomId = params.roomId;
  const encoder = new TextEncoder();

  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (msg: ChatMessage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
        } catch {
          /* stream already closed */
        }
      };

      // Replay recent history so a device joining late sees context.
      for (const msg of getHistory(roomId)) send(msg);

      const unsubscribe = subscribe(roomId, send);

      // Keep-alive comments so proxies don't close an idle connection.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          /* stream already closed */
        }
      }, 20000);

      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
      };
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
