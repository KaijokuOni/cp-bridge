export type Author = {
  id: string;
  name: string;
};

export type ChatMessage = {
  id: string;
  roomId: string;
  kind: "peer" | "ai" | "system";
  author: Author;
  text: string;
  // Optional image attached to a peer/ai message (data URL or remote URL).
  imageUrl?: string;
  createdAt: number;
};

export type Provider = "claude" | "gemini" | "local";

export type AiSettings = {
  provider: Provider;
  apiKey: string;
  model: string;
  language: string; // preferred solution language, e.g. "C++"
  // Local (OpenAI-compatible) server settings — Ollama, LM Studio, llama.cpp, vLLM…
  baseUrl: string; // e.g. http://localhost:11434/v1
  visionCapable: boolean; // true if the local model can read images directly
};
