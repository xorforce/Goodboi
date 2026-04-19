"use client";

import { useRef, useState, useEffect, type FormEvent } from "react";
import { sendMessage, sendMessageWithFile, type ChatResponse } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  sessionId: string;
  onComplete: (featureSummary: string) => void;
}

export default function ChatPanel({ sessionId, onComplete }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send initial greeting on mount
  useEffect(() => {
    async function greet() {
      setIsLoading(true);
      try {
        const res = await sendMessage(
          sessionId,
          "Hello, I'd like to create a feature request."
        );
        setMessages([
          {
            role: "user",
            content: "Hello, I'd like to create a feature request.",
          },
          { role: "assistant", content: res.reply },
        ]);
      } catch {
        setMessages([
          {
            role: "assistant",
            content:
              "Welcome! I'm here to help you build a feature request. Describe your idea and I'll help refine it into a proper specification. You can also upload a file for context.",
          },
        ]);
      }
      setIsLoading(false);
    }
    greet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() && !file) return;
    if (isLoading) return;

    const userMsg = input.trim() || (file ? `[Uploaded file: ${file.name}]` : "");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setInput("");
    setIsLoading(true);

    try {
      let res: ChatResponse;
      if (file) {
        res = await sendMessageWithFile(sessionId, userMsg, file);
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        res = await sendMessage(sessionId, userMsg);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply },
      ]);

      if (res.is_complete) {
        setIsComplete(true);
        onComplete(res.feature_summary);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    }

    setIsLoading(false);
  }

  function cleanContent(content: string): string {
    // Strip XML tags from display
    return content
      .replace(/<feature_summary>[\s\S]*?<\/feature_summary>/g, "")
      .replace(/\*\*\[FEATURE_REQUEST_COMPLETE\]\*\*/g, "")
      .trim();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-800 text-zinc-200 border border-zinc-700/50"
              }`}
            >
              <div className="whitespace-pre-wrap">
                {cleanContent(msg.content)}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 border border-zinc-700/50 rounded-2xl px-4 py-3 text-sm text-zinc-400">
              <span className="inline-flex gap-1">
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* File attachment badge */}
      {file && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-zinc-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
          <span>{file.name}</span>
          <button
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            className="text-zinc-500 hover:text-zinc-300"
          >
            x
          </button>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.md,.csv,.json,.yaml,.yml,.xml,.log"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
            title="Attach file"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isComplete
                ? "Feature request complete! Check the PRD tab."
                : "Describe your feature idea..."
            }
            disabled={isLoading || isComplete}
            className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isLoading || isComplete || (!input.trim() && !file)}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
