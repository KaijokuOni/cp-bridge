import { runAi, type AiTurn } from "@/lib/ai";
import type { Provider } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider: Provider =
    body.provider === "gemini" ? "gemini" : body.provider === "local" ? "local" : "claude";
  const apiKey: string = (body.apiKey ?? "").toString();
  const model: string = (body.model ?? "").toString();
  const language: string = (body.language ?? "C++").toString();
  const baseUrl: string = (body.baseUrl ?? "").toString();
  const sendImages: boolean = body.sendImages !== false;
  const turns: AiTurn[] = Array.isArray(body.turns) ? body.turns : [];

  // Local servers usually need no API key; cloud providers always do.
  if (provider !== "local" && !apiKey) {
    return Response.json({ error: "Missing API key" }, { status: 400 });
  }
  if (provider === "local" && !baseUrl) {
    return Response.json({ error: "Missing local server URL" }, { status: 400 });
  }
  if (!model) return Response.json({ error: "Missing model" }, { status: 400 });
  if (turns.length === 0) return Response.json({ error: "No input" }, { status: 400 });

  try {
    const text = await runAi({ provider, apiKey, model, language, turns, baseUrl, sendImages });
    return Response.json({ text });
  } catch (err: any) {
    return Response.json({ error: err?.message || "AI request failed" }, { status: 502 });
  }
}
