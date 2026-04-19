"use client";

import { useEffect, useRef, useState } from "react";

import { getAvailableModels, type AvailableModel, type ModelId } from "@/lib/api";

interface ModelSelectorProps {
  model: ModelId;
  onChange: (model: ModelId) => void;
  compact?: boolean;
}

export default function ModelSelector({
  model,
  onChange,
  compact = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setIsLoading(true);
      setError(null);
      try {
        const availableModels = await getAvailableModels();
        if (!cancelled) {
          setModels(availableModels);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load models.");
        }
      }
      if (!cancelled) {
        setIsLoading(false);
      }
    }

    void loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentModel = models.find((availableModel) => availableModel.id === model);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex items-center gap-1.5 bg-zinc-800/50 border border-zinc-700 rounded-xl transition-colors text-zinc-400 hover:text-zinc-200 ${
          compact ? "h-8 px-2.5 text-[11px]" : "h-9 px-3 text-xs"
        }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        {currentModel?.id || model}
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50 max-h-72 overflow-y-auto">
          {isLoading && (
            <div className="px-3 py-3 text-sm text-zinc-500">Loading models...</div>
          )}

          {!isLoading && error && (
            <div className="px-3 py-3 space-y-2">
              <div className="text-xs text-red-400 whitespace-pre-wrap">{error}</div>
              <button
                type="button"
                onClick={async () => {
                  setIsLoading(true);
                  setError(null);
                  try {
                    const availableModels = await getAvailableModels(true);
                    setModels(availableModels);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Failed to load models.");
                  }
                  setIsLoading(false);
                }}
                className="text-xs text-zinc-300 hover:text-white"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !error && models.map((availableModel) => (
            <button
              key={availableModel.id}
              type="button"
              onClick={() => {
                onChange(availableModel.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                availableModel.id === model
                  ? "bg-indigo-600/10 text-indigo-400"
                  : "text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <div className="font-medium break-all">{availableModel.id}</div>
              <div className="text-xs text-zinc-500">{availableModel.owned_by || "OpenAI"}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
