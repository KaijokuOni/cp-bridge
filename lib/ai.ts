import type { Provider } from "./types";

export type AiTurn = {
  role: "user" | "assistant";
  text: string;
  // data URL like "data:image/png;base64,...."; only used on user turns.
  imageDataUrl?: string;
};

export function systemPrompt(language: string): string {
  return [
    "You are an elite competitive-programming assistant.",
    "The user may paste a problem statement as text or upload a screenshot/photo of one.",
    "",
    "When you receive a problem:",
    "1. If it is an image, first transcribe the FULL problem statement (including constraints, input/output format, and samples) so nothing is lost.",
    "2. State the core idea / algorithm and why it works.",
    "3. Give the time and space complexity.",
    `4. Provide a complete, correct, compilable ${language} solution using fast I/O.`,
    "5. Note tricky edge cases and, when useful, dry-run a sample.",
    "",
    "Prefer correctness and clarity. Keep the code idiomatic and ready to submit.",
    "If information is missing or ambiguous, state your assumption explicitly instead of guessing silently.",
  ].join("\n");
}

function parseDataUrl(dataUrl: string): { mediaType: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], base64: m[2] };
}

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  turns: AiTurn[]
): Promise<string> {
  const messages = turns.map((t) => {
    const content: any[] = [];
    if (t.imageDataUrl) {
      const parsed = parseDataUrl(t.imageDataUrl);
      if (parsed) {
        content.push({
          type: "image",
          source: { type: "base64", media_type: parsed.mediaType, data: parsed.base64 },
        });
      }
    }
    content.push({ type: "text", text: t.text || "(see image)" });
    return { role: t.role, content };
  });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model, max_tokens: 4096, system, messages }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Claude API error (${res.status}): ${msg}`);
  }
  const parts = (data.content || [])
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text);
  return parts.join("\n").trim() || "(empty response)";
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  turns: AiTurn[]
): Promise<string> {
  const contents = turns.map((t) => {
    const parts: any[] = [];
    if (t.imageDataUrl) {
      const parsed = parseDataUrl(t.imageDataUrl);
      if (parsed) {
        parts.push({ inline_data: { mime_type: parsed.mediaType, data: parsed.base64 } });
      }
    }
    parts.push({ text: t.text || "(see image)" });
    return { role: t.role === "assistant" ? "model" : "user", parts };
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { maxOutputTokens: 8192 },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Gemini API error (${res.status}): ${msg}`);
  }
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || [])
    .map((p: any) => p.text)
    .filter(Boolean)
    .join("\n")
    .trim();
  return text || "(empty response)";
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  turns: AiTurn[],
  sendImages: boolean
): Promise<string> {
  const messages: any[] = [{ role: "system", content: system }];
  for (const t of turns) {
    if (t.imageDataUrl && sendImages) {
      messages.push({
        role: t.role,
        content: [
          { type: "text", text: t.text || "(see image)" },
          { type: "image_url", image_url: { url: t.imageDataUrl } },
        ],
      });
    } else {
      messages.push({ role: t.role, content: t.text || "(see image)" });
    }
  }

  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Many local servers ignore auth, but some (vLLM, LM Studio) want a token.
        authorization: `Bearer ${apiKey || "local"}`,
      },
      body: JSON.stringify({ model, messages, max_tokens: 4096, stream: false }),
    });
  } catch (e: any) {
    throw new Error(
      `Could not reach local server at ${url}. Is it running? (${e?.message || e})`
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as any)?.error?.message || (data as any)?.error || JSON.stringify(data);
    throw new Error(`Local LLM error (${res.status}): ${msg}`);
  }
  const text = (data as any)?.choices?.[0]?.message?.content;
  return (typeof text === "string" ? text.trim() : "") || "(empty response)";
}

export async function runAi(opts: {
  provider: Provider;
  apiKey: string;
  model: string;
  language: string;
  turns: AiTurn[];
  baseUrl?: string;
  sendImages?: boolean;
}): Promise<string> {
  const { provider, apiKey, model, language, turns } = opts;
  const system = systemPrompt(language);
  if (provider === "claude") return callClaude(apiKey, model, system, turns);
  if (provider === "gemini") return callGemini(apiKey, model, system, turns);
  return callOpenAICompatible(
    opts.baseUrl || "http://localhost:11434/v1",
    apiKey,
    model,
    system,
    turns,
    opts.sendImages !== false
  );
}
