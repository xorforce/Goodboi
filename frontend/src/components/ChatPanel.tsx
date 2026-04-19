"use client";

import { useRef, useState, useEffect, type FormEvent } from "react";
import {
  getSessionState,
  sendMessage,
  sendMessageWithFile,
  type ChatResponse,
  type ModelId,
} from "@/lib/api";
import ModelSelector from "@/components/ModelSelector";

interface Message {
  role: "user" | "assistant";
  content: string;
  images?: string[];
  isError?: boolean;
}

interface ChatPanelProps {
  sessionId: string;
  model: ModelId;
  onModelChange: (m: ModelId) => void;
  canHandoff: boolean;
  isHandingOff: boolean;
  onHandoff: () => void;
  onComplete: (featureSummary: string) => void;
}

export default function ChatPanel({
  sessionId,
  model,
  onModelChange,
  canHandoff,
  isHandingOff,
  onHandoff,
  onComplete,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrateSession() {
      try {
        const session = await getSessionState(sessionId);
        if (cancelled) return;

        const hydratedMessages: Message[] = session.messages.map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content,
        }));

        if (
          session.is_complete &&
          !hydratedMessages.some(
            (message) => message.content === "Continue, to handoff to next stage."
          )
        ) {
          hydratedMessages.push({
            role: "assistant",
            content: "Continue, to handoff to next stage.",
          });
        }

        setMessages(hydratedMessages);
        setIsComplete(session.is_complete);
      } catch {
        if (!cancelled) {
          setMessages([]);
          setIsComplete(false);
        }
      }
    }

    void hydrateSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // ── Cancel ──────────────────────────────────────────────────────────

  function handleCancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }

  // ── Image handling ────────────────────────────────────────────────────

  function handleImageSelect(files: FileList | null) {
    if (!files) return;
    const newImages: File[] = [];
    const newPreviews: string[] = [];

    Array.from(files).forEach((f) => {
      if (!f.type.startsWith("image/")) return;
      newImages.push(f);
      newPreviews.push(URL.createObjectURL(f));
    });

    setImages((prev) => [...prev, ...newImages]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  }

  function removeImage(idx: number) {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  }

  // ── Submit ────────────────────────────────────────────────────────────

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!input.trim() && images.length === 0) || isLoading) return;

    const userMsg =
      input.trim() || (images.length > 0 ? `[Attached ${images.length} image(s)]` : "");
    const userImages = [...imagePreviews];

    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMsg, images: userImages },
    ]);
    setInput("");

    const currentImages = [...images];
    setImages([]);
    setImagePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsLoading(true);

    // Create a new AbortController for this request
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let res: ChatResponse;
      if (currentImages.length > 0) {
        res = await sendMessageWithFile(
          sessionId, userMsg, currentImages[0], model, controller.signal
        );
      } else {
        res = await sendMessage(sessionId, userMsg, model, controller.signal);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: res.reply },
      ]);

      if (res.is_complete) {
        setIsComplete(true);
        onComplete(res.feature_summary);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Continue, to handoff to next stage." },
        ]);
      }
    } catch (err: unknown) {
      // Don't show error if the user cancelled
      if (err instanceof DOMException && err.name === "AbortError") {
        // Request was cancelled by user -- no error message needed
      } else {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: message, isError: true },
        ]);
      }
    }

    abortRef.current = null;
    setIsLoading(false);
  }

  function cleanContent(content: string): string {
    return content
      .replace(/<feature_summary>[\s\S]*?<\/feature_summary>/g, "")
      .replace(/\*\*\[FEATURE_REQUEST_COMPLETE\]\*\*/g, "")
      .trim();
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-12 h-12 mb-4 rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500 max-w-sm">
              Describe your feature idea to get started. You can also attach images for context.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : msg.isError
                    ? "bg-red-950/50 text-red-300 border border-red-800/50"
                    : "bg-zinc-800 text-zinc-200 border border-zinc-700/50"
              }`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {msg.images.map((src, j) => (
                    <img
                      key={j}
                      src={src}
                      alt="uploaded"
                      className="w-20 h-20 object-cover rounded-lg border border-white/10"
                    />
                  ))}
                </div>
              )}
              <div className="whitespace-pre-wrap">{cleanContent(msg.content)}</div>
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

      {/* Image preview strip */}
      {imagePreviews.length > 0 && (
        <div className="mx-4 mb-2 flex items-center gap-2 flex-wrap">
          {imagePreviews.map((src, i) => (
            <div key={i} className="relative group">
              <img
                src={src}
                alt="preview"
                className="w-14 h-14 object-cover rounded-lg border border-zinc-700"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-800 border border-zinc-600 rounded-full flex items-center justify-center text-zinc-400 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800">
        <div className="flex items-end gap-2">
          {/* + button for image upload */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            onChange={(e) => handleImageSelect(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="shrink-0 w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl transition-colors disabled:opacity-40"
            title="Attach images"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>

          {/* Text input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isComplete
                ? "Feature summary ready. Hand off to PRD when you're satisfied."
                : "Describe your feature idea..."
            }
            disabled={isComplete}
            className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-xl px-4 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 disabled:opacity-50"
          />

          {/* Model selector */}
          <ModelSelector model={model} onChange={onModelChange} />

          <button
            type="button"
            onClick={onHandoff}
            disabled={!canHandoff || isLoading || isHandingOff}
            className="shrink-0 h-9 px-3 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl transition-colors"
          >
            {isHandingOff ? "Handing off..." : "Handoff to PRD"}
          </button>

          {/* Send or Cancel */}
          {isLoading ? (
            <button
              type="button"
              onClick={handleCancel}
              className="shrink-0 w-9 h-9 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors"
              title="Cancel request"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isComplete || (!input.trim() && images.length === 0)}
              className="shrink-0 w-9 h-9 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
