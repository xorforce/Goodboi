"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ModelId } from "@/lib/api";
import ModelSelector from "@/components/ModelSelector";

interface CodeViewerProps {
  featureSummary: string;
  prdMarkdown: string;
  codeMarkdown: string;
  reviewSummary: string;
  reviewBranchName: string;
  reviewDiff: string;
  reviewBuildCommand: string;
  reviewBuildOutput: string;
  reviewBuildSucceeded: boolean;
  reviewBuildChecked: boolean;
  model?: ModelId;
  onModelChange: (model: ModelId) => void;
  isHandingOff: boolean;
  onHandoff: () => void;
}

export default function CodeViewer({
  featureSummary,
  prdMarkdown,
  codeMarkdown,
  reviewSummary,
  reviewBranchName,
  reviewDiff,
  reviewBuildCommand,
  reviewBuildOutput,
  reviewBuildSucceeded,
  reviewBuildChecked,
  model,
  onModelChange,
  isHandingOff,
  onHandoff,
}: CodeViewerProps) {
  if (!featureSummary) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">Code-gen Not Ready</h3>
        <p className="text-sm text-zinc-500 max-w-md">
          Complete the feature request and PRD first. Then use the handoff button to generate code for this feature.
        </p>
      </div>
    );
  }

  if (!prdMarkdown) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center">
          <svg className="w-8 h-8 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">Waiting For PRD</h3>
        <p className="text-sm text-zinc-500 max-w-md">
          Generate the PRD first, then use the handoff button to generate code and prepare the repo diff.
        </p>
      </div>
    );
  }

  if (isHandingOff && !codeMarkdown) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-16 h-16 mb-6 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">Generating Code...</h3>
        <p className="text-sm text-zinc-500 max-w-md">
          The coding agent is generating implementation details and preparing a repository diff.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">
          Code-gen
        </span>
        <div className="flex items-center gap-2">
          {model && <ModelSelector model={model} onChange={onModelChange} compact />}
          <button
            onClick={onHandoff}
            disabled={!reviewDiff || isHandingOff}
            className="px-3 py-1.5 text-xs text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 rounded-lg transition-colors"
          >
            Handoff to Review Agent
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(codeMarkdown)}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Copy Markdown
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {reviewSummary && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="text-sm font-medium text-emerald-300 mb-2">Repo Changes Prepared</div>
            <div className="text-sm text-zinc-300 mb-3">{reviewSummary}</div>
            <div className="grid gap-2 text-xs text-zinc-400">
              {reviewBranchName && (
                <div>
                  <span className="text-zinc-500">Branch:</span> <code>{reviewBranchName}</code>
                </div>
              )}
              {reviewBuildChecked && (
                <div>
                  <span className="text-zinc-500">Build:</span> {reviewBuildSucceeded ? "passed" : "failed"}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="prose-prd max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{codeMarkdown}</ReactMarkdown>
        </div>

        {reviewBuildChecked && (
          <div className={`mt-6 rounded-2xl border p-4 ${reviewBuildSucceeded ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-zinc-200">Build Verification</div>
              <div className={`text-xs ${reviewBuildSucceeded ? "text-emerald-400" : "text-red-400"}`}>
                {reviewBuildSucceeded ? "Passed" : "Failed"}
              </div>
            </div>
            {reviewBuildCommand && <div className="text-xs text-zinc-500 mb-2">Command: <code>{reviewBuildCommand}</code></div>}
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">{reviewBuildOutput || "No build output."}</pre>
          </div>
        )}

        {reviewDiff && (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-sm font-medium text-zinc-200 mb-3">Inline Diff</div>
            <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">{reviewDiff}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
