"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import type { AiSettings, ChatMessage } from "@/lib/types";
import Markdown from "@/components/Markdown";
import Settings, { defaultSettings } from "@/components/Settings";

function getIdentity(nameFromUrl: string) {
  let id = localStorage.getItem("cpb.id");
  if (!id) {
    id = Math.random().toString(36).slice(2);
    localStorage.setItem("cpb.id", id);
  }
  const name = nameFromUrl || localStorage.getItem("cpb.name") || "Guest";
  localStorage.setItem("cpb.name", name);
  return { id, name };
}

function loadSettings(): AiSettings {
  try {
    const raw = localStorage.getItem("cpb.settings");
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {}
  return defaultSettings();
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const roomId = decodeURIComponent(params.roomId);

  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [settings, setSettings] = useState<AiSettings>(defaultSettings());
  const [showSettings, setShowSettings] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const [connected, setConnected] = useState(0);
  const [online, setOnline] = useState(false);

  const [mode, setMode] = useState<"peer" | "ai">("ai");
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Init identity + settings on mount.
  useEffect(() => {
    setMe(getIdentity(search.get("name") || ""));
    setSettings(loadSettings());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist settings whenever they change.
  useEffect(() => {
    localStorage.setItem("cpb.settings", JSON.stringify(settings));
  }, [settings]);

  // Subscribe to the room's SSE stream.
  useEffect(() => {
    const es = new EventSource(`/api/room/${encodeURIComponent(roomId)}/events`);
    es.onopen = () => setOnline(true);
    es.onerror = () => setOnline(false);
    es.onmessage = (ev) => {
      try {
        const msg: ChatMessage = JSON.parse(ev.data);
        if (seenIds.current.has(msg.id)) return;
        seenIds.current.add(msg.id);
        setMessages((prev) => [...prev, msg]);
      } catch {}
    };
    return () => es.close();
  }, [roomId]);

  // Poll the connected-device count.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/room/${encodeURIComponent(roomId)}/history`, {
          cache: "no-store",
        });
        const d = await r.json();
        if (alive) setConnected(d.connected ?? 0);
      } catch {}
    };
    tick();
    const iv = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [roomId]);

  // Auto-scroll to newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, aiBusy]);

  async function postToRoom(payload: Partial<ChatMessage>) {
    if (!me) return;
    await fetch(`/api/room/${encodeURIComponent(roomId)}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, author: me }),
    });
  }

  async function pickImage(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    setImage({ dataUrl, name: file.name });
  }

  async function onSend() {
    setError("");
    const body = text.trim();
    if (!body && !image) return;
    if (!me) return;

    if (mode === "peer") {
      await postToRoom({ kind: "peer", text: body, imageUrl: image?.dataUrl });
      setText("");
      setImage(null);
      return;
    }

    // AI mode -----------------------------------------------------------
    if (!settings.apiKey) {
      setShowSettings(true);
      setError("Add your API key first (gear icon).");
      return;
    }

    // Echo the human's question into the room so both PCs see what was asked.
    await postToRoom({
      kind: "peer",
      text: body ? `@ai ${body}` : "@ai (image)",
      imageUrl: image?.dataUrl,
    });

    const turns = [
      {
        role: "user" as const,
        text: body || "Solve this competitive-programming problem.",
        imageDataUrl: image?.dataUrl,
      },
    ];

    setText("");
    const usedImage = image;
    setImage(null);
    setAiBusy(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: settings.provider,
          apiKey: settings.apiKey,
          model: settings.model,
          language: settings.language,
          turns,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "AI request failed");
      await postToRoom({ kind: "ai", text: d.text });
    } catch (e: any) {
      setError(e?.message || "AI request failed");
      // Surface the failure in the room too, so the other PC isn't left waiting.
      await postToRoom({ kind: "system", text: `⚠️ AI error: ${e?.message || "request failed"}` });
      void usedImage;
    } finally {
      setAiBusy(false);
    }
  }

  const shareUrl = useMemo(
    () => (typeof window !== "undefined" ? `${window.location.origin}/room/${encodeURIComponent(roomId)}` : ""),
    [roomId]
  );

  return (
    <main className="h-screen flex flex-col">
      {/* Header */}
      <header className="shrink-0 border-b border-edge bg-panel/60 backdrop-blur px-4 py-3 flex items-center gap-3">
        <a href="/" className="text-sky-400 font-semibold shrink-0">
          CP&nbsp;Bridge
        </a>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-gray-500">room</span>
          <code className="font-mono text-gray-200 truncate">{roomId}</code>
          <button
            onClick={() => navigator.clipboard?.writeText(shareUrl)}
            title="Copy room link"
            className="text-xs rounded border border-edge px-1.5 py-0.5 text-gray-400 hover:bg-white/5"
          >
            copy link
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs">
          <span className={`flex items-center gap-1.5 ${online ? "text-emerald-400" : "text-amber-400"}`}>
            <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-amber-400"}`} />
            {online ? "live" : "reconnecting"}
          </span>
          <span className="text-gray-500">
            {connected} device{connected === 1 ? "" : "s"}
          </span>
          <span className="hidden sm:inline text-gray-500">
            {settings.provider} · {settings.language}
          </span>
          <button
            onClick={() => setShowSettings(true)}
            className="rounded-lg border border-edge px-2.5 py-1 text-gray-300 hover:bg-white/5"
          >
            ⚙ Settings
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-16">
              <p className="text-lg">Room is ready.</p>
              <p className="mt-1 text-sm">
                Share the room link with the other PC, then paste a problem or drop a
                screenshot and ask the AI.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} m={m} mine={m.author.id === me?.id} />
          ))}

          {aiBusy && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
              AI is solving…
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-edge bg-panel/60 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {error && <div className="mb-2 text-sm text-red-400">{error}</div>}

          <div className="flex items-center gap-2 mb-2">
            <div className="inline-flex rounded-lg border border-edge overflow-hidden text-sm">
              <button
                onClick={() => setMode("ai")}
                className={`px-3 py-1.5 ${mode === "ai" ? "bg-sky-600 text-white" : "text-gray-400 hover:bg-white/5"}`}
              >
                🤖 Ask AI
              </button>
              <button
                onClick={() => setMode("peer")}
                className={`px-3 py-1.5 ${mode === "peer" ? "bg-sky-600 text-white" : "text-gray-400 hover:bg-white/5"}`}
              >
                💬 Room chat
              </button>
            </div>
            <span className="text-xs text-gray-500">
              {mode === "ai"
                ? "Sent to the AI; the answer is shared with the whole room."
                : "Sent to the other PC only."}
            </span>
          </div>

          {image && (
            <div className="mb-2 flex items-center gap-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.dataUrl} alt="" className="h-12 w-12 rounded object-cover border border-edge" />
              <span className="text-gray-400 truncate">{image.name}</span>
              <button onClick={() => setImage(null)} className="text-gray-500 hover:text-red-400">
                remove
              </button>
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              title="Attach problem screenshot"
              className="shrink-0 rounded-lg border border-edge h-11 w-11 text-lg hover:bg-white/5"
            >
              📎
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0])}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              onPaste={(e) => {
                const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith("image/"));
                if (f) pickImage(f);
              }}
              rows={1}
              placeholder={
                mode === "ai"
                  ? "Paste a problem or attach a screenshot, then press Enter…"
                  : "Message the other PC…"
              }
              className="flex-1 resize-none rounded-lg bg-ink border border-edge px-3 py-2.5 outline-none focus:border-sky-500 max-h-40"
            />
            <button
              onClick={onSend}
              disabled={aiBusy}
              className="shrink-0 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 h-11 px-5 font-medium"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {showSettings && (
        <Settings value={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />
      )}
    </main>
  );
}

function MessageBubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  if (m.kind === "system") {
    return (
      <div className="text-center">
        <span className="inline-block text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1">
          {m.text}
        </span>
      </div>
    );
  }

  const isAi = m.kind === "ai";
  const align = isAi ? "items-start" : mine ? "items-end" : "items-start";
  const bubble = isAi
    ? "bg-panel border border-edge w-full"
    : mine
      ? "bg-sky-600/90"
      : "bg-white/5 border border-edge";

  return (
    <div className={`flex flex-col ${align}`}>
      <div className="text-xs text-gray-500 mb-1 px-1">
        {isAi ? "🤖 AI" : m.author.name}
        {!isAi && mine && " (you)"}
      </div>
      <div className={`rounded-2xl px-4 py-2.5 max-w-full ${bubble} ${isAi ? "" : "max-w-[85%]"}`}>
        {m.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={m.imageUrl}
            alt="attachment"
            className="rounded-lg mb-2 max-h-72 border border-edge"
          />
        )}
        {isAi ? (
          <Markdown text={m.text} />
        ) : (
          <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
        )}
      </div>
    </div>
  );
}
