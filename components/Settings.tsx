"use client";

import { useState } from "react";
import type { AiSettings, Provider } from "@/lib/types";

const DEFAULT_MODEL: Record<Provider, string> = {
  claude: "claude-3-5-sonnet-latest",
  gemini: "gemini-2.0-flash",
};

export function defaultSettings(): AiSettings {
  return { provider: "claude", apiKey: "", model: DEFAULT_MODEL.claude, language: "C++" };
}

export default function Settings({
  value,
  onChange,
  onClose,
}: {
  value: AiSettings;
  onChange: (s: AiSettings) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<AiSettings>(value);

  function setProvider(provider: Provider) {
    setDraft((d) => ({
      ...d,
      provider,
      // Reset to that provider's default model unless the user typed a custom one.
      model:
        d.model === DEFAULT_MODEL.claude || d.model === DEFAULT_MODEL.gemini
          ? DEFAULT_MODEL[provider]
          : d.model,
    }));
  }

  function save() {
    onChange(draft);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-edge bg-panel p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">AI settings</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">
            ×
          </button>
        </div>

        <label className="block text-sm text-gray-400 mb-1.5">Provider</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(["claude", "gemini"] as Provider[]).map((p) => (
            <button
              key={p}
              onClick={() => setProvider(p)}
              className={`rounded-lg border px-3 py-2 text-sm capitalize transition-colors ${
                draft.provider === p
                  ? "border-sky-500 bg-sky-500/10 text-sky-300"
                  : "border-edge hover:bg-white/5"
              }`}
            >
              {p === "claude" ? "Claude (Anthropic)" : "Gemini (Google)"}
            </button>
          ))}
        </div>

        <label className="block text-sm text-gray-400 mb-1.5">
          API key
          <span className="text-gray-600"> — stored in this browser only</span>
        </label>
        <input
          type="password"
          value={draft.apiKey}
          onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
          placeholder={draft.provider === "claude" ? "sk-ant-..." : "AIza..."}
          className="w-full rounded-lg bg-ink border border-edge px-3 py-2.5 outline-none focus:border-sky-500 font-mono text-sm mb-4"
        />

        <label className="block text-sm text-gray-400 mb-1.5">Model</label>
        <input
          value={draft.model}
          onChange={(e) => setDraft({ ...draft, model: e.target.value })}
          className="w-full rounded-lg bg-ink border border-edge px-3 py-2.5 outline-none focus:border-sky-500 font-mono text-sm mb-1"
        />
        <p className="text-xs text-gray-600 mb-4">
          Default:{" "}
          <code className="text-gray-400">{DEFAULT_MODEL[draft.provider]}</code>. Change it to any
          model your key can access.
        </p>

        <label className="block text-sm text-gray-400 mb-1.5">Solution language</label>
        <select
          value={draft.language}
          onChange={(e) => setDraft({ ...draft, language: e.target.value })}
          className="w-full rounded-lg bg-ink border border-edge px-3 py-2.5 outline-none focus:border-sky-500 text-sm mb-6"
        >
          {["C++", "Python", "Java", "C", "JavaScript", "Go", "Rust", "Kotlin"].map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-edge py-2.5 text-sm hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={save}
            className="flex-1 rounded-lg bg-sky-600 hover:bg-sky-500 py-2.5 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
