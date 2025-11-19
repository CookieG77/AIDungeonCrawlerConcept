"use client";

import React, { useState, useRef, useEffect, FormEvent } from "react";

const SYSTEM_PROMPT = "You are a helpful and friendly assistant.";

type LMSession = {
  promptStreaming: (prompt: string) => Promise<AsyncIterable<string> | any>;
  destroy: () => void;
  // You can add more fields if you need them (temperature, etc.)
};

async function createSession(): Promise<LMSession | null> {
  if (typeof window === "undefined") return null;

  const LanguageModel = (window as any).LanguageModel;
  if (!LanguageModel) {
    console.error("LanguageModel API is not available in this browser.");
    return null;
  }

  const session: LMSession = await LanguageModel.create({
    temperature: 1,
    topK: 3,
    initialPrompts: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
    ],
  });

  return session;
}

export default function PromptPage() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sessionRef = useRef<LMSession | null>(null);

  // Clean up session when the component unmounts
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.destroy();
        sessionRef.current = null;
      }
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    setIsLoading(true);
    setResponse("");

    try {
      let session = sessionRef.current;
      if (!session) {
        session = await createSession();
        if (!session) {
          throw new Error(
            "LanguageModel API not available. Use Chrome Dev Preview or a compatible browser."
          );
        }
        sessionRef.current = session;
      }

      const stream: AsyncIterable<string> | any =
        await session.promptStreaming(trimmedPrompt);

      let previousChunk = "";
      let fullText = "";

      // Streaming loop
      for await (const chunk of stream as any) {
        const newChunk =
          typeof chunk === "string" && chunk.startsWith(previousChunk)
            ? chunk.slice(previousChunk.length)
            : chunk;

        previousChunk = chunk;
        fullText += newChunk;

        // Append to state as chunks come in
        setResponse((prev) => prev + newChunk);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || String(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main style={{ padding: "1rem", maxWidth: 800, margin: "0 auto" }}>
      <h1>Prompt API test page</h1>

      <form onSubmit={handleSubmit}>
        <label>
          Prompt:
          <br />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            style={{ width: "100%" }}
          />
        </label>
        <br />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Thinking…" : "Send"}
        </button>
      </form>

      {error && (
        <p style={{ color: "red", marginTop: "1rem" }}>
          Error: {error}
        </p>
      )}

      {!!response && (
        <section style={{ marginTop: "1rem" }}>
          <h2>Response</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#f4f4f4",
              padding: "0.5rem",
              borderRadius: 4,
            }}
          >
            {response}
          </pre>
        </section>
      )}
    </main>
  );
}
