# CP Bridge

A real-time communication bridge between two PCs, with a built-in AI assistant
(Claude or Gemini, using **your own API key**) that reads screenshots of
competitive-programming problems and returns full solutions — shared instantly
with everyone in the room.

- 🔗 **Room-based bridge** — both computers open the same URL + Room ID and chat live.
- 🤖 **AI problem solver** — paste a statement or drop a screenshot; get approach,
  complexity, and ready-to-submit code (C++/Python/Java/…).
- 🖼️ **Vision** — solves directly from a photo/screenshot of the problem.
- 🏠 **Local LLM** — point it at Ollama / LM Studio / llama.cpp / vLLM and run
  fully offline; no cloud, no key.
- 🔎 **On-device OCR** — Tesseract.js turns a screenshot into text right in your
  browser (the image never leaves the machine), so even text-only local coder
  models can solve problems from images.
- 🔑 **Your key, your control** — cloud API keys live in your browser's
  localStorage and are sent only to your chosen provider.

---

## 1. Run locally

```bash
cd cp-bridge
npm install
npm run dev
```

Open <http://localhost:3000>, enter a name and Room ID, and you're in.
Click **⚙ Settings**, pick Claude or Gemini, paste your API key, and choose your
solution language.

### Connecting a second PC

**Same Wi-Fi / LAN** — find your Mac's IP (`ipconfig getifaddr en0`) and have the
other PC open `http://<your-ip>:3000` with the **same Room ID**. Start the server
with `npm run dev -- -H 0.0.0.0` so it accepts LAN connections.

**Different networks (a truly "random" PC)** — expose your local server with a
tunnel, then share the public URL:

```bash
# either of these
npx cloudflared tunnel --url http://localhost:3000
# or
ngrok http 3000
```

Real-time sync works flawlessly this way because everything runs in one Node
process.

---

## 2. Deploy to Vercel

```bash
npm i -g vercel
vercel        # from inside cp-bridge/
```

No environment variables are required — each user supplies their own AI key in
the browser. Both PCs just open the deployed URL and join the same room.

> **Realtime caveat on serverless:** the live message relay uses an in-memory
> pub/sub (`lib/bus.ts`). On a single Node server (localhost, `npm start`, or a
> tunnel) this is rock-solid. On Vercel's serverless runtime, invocations can
> land on different instances, so cross-instance delivery isn't guaranteed under
> load. For a bulletproof multi-instance deploy, replace `lib/bus.ts` with Redis
> pub/sub (e.g. Upstash) — the module exposes just `publish` / `subscribe` /
> `getHistory`, so it's a small swap. For personal two-PC use, the
> **localhost + tunnel** path above is the most reliable.

---

## Using a local LLM (offline, no key)

1. Install [Ollama](https://ollama.com) and pull a model:
   ```bash
   ollama pull qwen2.5-coder:7b     # great at competitive programming (text)
   ollama pull llama3.2-vision      # can read screenshots directly (vision)
   ```
   (LM Studio, llama.cpp `--server`, and vLLM also work — anything exposing an
   OpenAI-compatible `/v1/chat/completions` endpoint.)
2. Start Ollama so your browser is allowed to call it. The local provider talks
   to Ollama **directly from your browser**, so it works on the hosted
   `cp-bridge.vercel.app` too — you just have to let Ollama accept the request:
   ```bash
   # macOS: allow any origin (simplest), then restart Ollama
   launchctl setenv OLLAMA_ORIGINS "*"
   # or run it inline:
   OLLAMA_ORIGINS="*" ollama serve
   ```
   (LM Studio: enable "CORS" / "Serve on Local Network" in its server settings.)
3. In **⚙ Settings**, pick **Local LLM**, set the base URL
   (`http://localhost:11434/v1` for Ollama, `http://localhost:1234/v1` for LM
   Studio), and enter the model name. Leave the API key blank.
4. If your model has vision (llava, llama3.2-vision), tick **"This model can read
   images"**. For text-only coder models, leave it off — screenshots are
   auto-converted to text with on-device OCR before sending.

## OCR (image → text on-device)

Attach a screenshot and click **🔎 Extract text** to OCR it into the message box
(review/edit before sending). It also runs automatically when you send an image
to a text-only local model. OCR is powered by Tesseract.js and runs entirely in
your browser — the image is never uploaded anywhere.

## Getting API keys

- **Claude (Anthropic):** <https://console.anthropic.com/> → API Keys. Default
  model `claude-3-5-sonnet-latest` (editable in Settings).
- **Gemini (Google):** <https://aistudio.google.com/app/apikey>. Default model
  `gemini-2.0-flash` (editable in Settings).

If a model name is rejected, open Settings and change it to one your key can
access.

---

## How it works

```
Browser (PC A) ─┐                             ┌─ Anthropic / Google API
                ├─ SSE  /api/room/:id/events  │   (called server-side with
Browser (PC B) ─┘  POST /api/room/:id/send    │    your key — avoids CORS)
                   POST /api/ai ──────────────┘
```

- `lib/bus.ts` — in-memory room pub/sub + recent history.
- `app/api/room/[roomId]/events` — Server-Sent Events stream (live messages).
- `app/api/room/[roomId]/send` — post a message to a room.
- `app/api/ai` — proxies to Claude/Gemini with the CP-solving system prompt.
- `lib/ai.ts` — provider adapters (text + image/vision).

## Tech

Next.js 14 (App Router) · TypeScript · Tailwind · Server-Sent Events.
