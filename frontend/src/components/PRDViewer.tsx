"use client";

import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { generatePRD, type ModelId } from "@/lib/api";
import ModelSelector from "@/components/ModelSelector";

interface PRDViewerProps {
  sessionId: string;
  featureSummary: string;
  prdMarkdown?: string;
  model: ModelId;
  onModelChange: (model: ModelId) => void;
  isHandingOff?: boolean;
  onHandoff?: () => void;
  onGenerated?: (prdMarkdown: string) => void;
}

export default function PRDViewer({
  sessionId,
  featureSummary,
  prdMarkdown = "",
  model,
  onModelChange,
  isHandingOff,
  onHandoff,
  onGenerated,
}: PRDViewerProps) {
  const [prdContent, setPrdContent] = useState<string>(prdMarkdown);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPrdContent(prdMarkdown);
  }, [prdMarkdown]);

  const handleGenerate = useCallback(async () => {
    if (!featureSummary) return;
    setIsGenerating(true);
    setError(null);

    try {
      const res = await generatePRD(sessionId, model);
      setPrdContent(res.prd_markdown);
      onGenerated?.(res.prd_markdown);
    } catch {
      setError("Failed to generate PRD. Please try again.");
    }

    setIsGenerating(false);
  }, [sessionId, featureSummary, onGenerated, model]);

  // Waiting state
  if (!featureSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">PRD Not Ready Yet</h3>
        <p className="text-sm text-zinc-500 max-w-md">
          Complete the feature request conversation in the Chat tab first,
          then use the handoff button to generate the PRD.
        </p>
      </div>
    );
  }

  // Generating state
  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">Generating PRD...</h3>
        <p className="text-sm text-zinc-500 max-w-md">
          The AI is writing a comprehensive Product Requirements Document based on your feature request.
          This may take a moment.
        </p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-red-600/10 border border-red-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">Generation Failed</h3>
        <p className="text-sm text-zinc-500 mb-4">{error}</p>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // PRD content
  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
          Product Requirements Document
        </span>
        <div className="flex items-center gap-2">
          <ModelSelector model={model} onChange={onModelChange} compact />
          <button
            onClick={onHandoff}
            disabled={!prdContent || isHandingOff}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
          >
            {isHandingOff ? "Handing off..." : "Handoff to Code"}
          </button>
          <button
            onClick={() => {
              const blob = new Blob([prdContent], { type: "text/markdown;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "goodboi-prd.md";
              link.click();
              URL.revokeObjectURL(url);
            }}
            disabled={!prdContent}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors disabled:text-zinc-600"
          >
            Download
          </button>
          <button
            onClick={handleGenerate}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Regenerate
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(prdContent)}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Copy Markdown
          </button>
        </div>
      </div>

      {/* PRD Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="prose-prd max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{prdContent}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
