"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function randomRoom() {
  const words = ["delta", "prime", "graph", "modulo", "vertex", "greedy", "kadane", "trie"];
  const w = words[Math.floor(Math.random() * words.length)];
  const n = Math.floor(1000 + Math.random() * 9000);
  return `${w}-${n}`;
}

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");

  useEffect(() => {
    setRoom(randomRoom());
    const saved = typeof window !== "undefined" ? localStorage.getItem("cpb.name") : "";
    if (saved) setName(saved);
  }, []);

  function join(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim() || "Guest";
    const r = room.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || randomRoom();
    localStorage.setItem("cpb.name", n);
    router.push(`/room/${encodeURIComponent(r)}?name=${encodeURIComponent(n)}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-sky-400/80 mb-3">
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" /> live bridge
          </div>
          <h1 className="text-4xl font-bold tracking-tight">CP&nbsp;Bridge</h1>
          <p className="mt-3 text-gray-400 leading-relaxed">
            Connect two PCs in the same room and chat in real time. A built-in AI
            (Claude or Gemini) reads screenshots of contest problems and returns
            full solutions — shared instantly with everyone in the room.
          </p>
        </div>

        <form
          onSubmit={join}
          className="rounded-2xl border border-edge bg-panel/70 backdrop-blur p-6 shadow-xl space-y-4"
        >
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Your name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arko"
              className="w-full rounded-lg bg-ink border border-edge px-3 py-2.5 outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Room ID</label>
            <div className="flex gap-2">
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="share this with the other PC"
                className="w-full rounded-lg bg-ink border border-edge px-3 py-2.5 outline-none focus:border-sky-500 font-mono"
              />
              <button
                type="button"
                onClick={() => setRoom(randomRoom())}
                className="shrink-0 rounded-lg border border-edge px-3 text-sm text-gray-300 hover:bg-white/5"
              >
                Shuffle
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Both computers must open the same URL and enter this exact Room ID.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 transition-colors py-2.5 font-medium"
          >
            Enter room →
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-600">
          Your AI API key is stored only in this browser and sent directly to
          your chosen provider.
        </p>
      </div>
    </main>
  );
}
