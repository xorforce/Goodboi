"use client";

interface QAViewerProps {
  reviewMarkdown: string;
  reviewedChanges: string[];
  fixesApplied: string[];
  onHandoff: () => void;
}

export default function QAViewer({
  reviewMarkdown,
  reviewedChanges,
  fixesApplied,
  onHandoff,
}: QAViewerProps) {
  if (!reviewMarkdown) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">Reviewer Not Ready</h3>
        <p className="text-sm text-zinc-500 max-w-md">
          Prepare the repo changes from the Code tab first. The reviewer agent will inspect and fix them here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Reviewer Agent</span>
        <button
          onClick={onHandoff}
          className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
        >
          Handoff to Review
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-sm font-medium text-zinc-200 mb-3">Reviewed Changes</div>
          <div className="flex flex-wrap gap-2">
            {reviewedChanges.map((item, index) => (
              <span key={`${item}-${index}`} className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 border border-zinc-700">{item}</span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-sm font-medium text-zinc-200 mb-3">Fixes Applied</div>
          <div className="flex flex-wrap gap-2">
            {fixesApplied.length > 0 ? fixesApplied.map((item, index) => (
              <span key={`${item}-${index}`} className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 border border-emerald-500/20">{item}</span>
            )) : <span className="text-sm text-zinc-500">No reviewer fixes were needed.</span>}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-sm font-medium text-zinc-200 mb-3">Review Report</div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">{reviewMarkdown}</pre>
        </div>
      </div>
    </div>
  );
}
