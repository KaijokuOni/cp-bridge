import { getHistory, roomCount } from "@/lib/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { roomId: string } }
) {
  return Response.json({
    messages: getHistory(params.roomId),
    connected: roomCount(params.roomId),
  });
}
