"use client";

import { useState } from "react";

import { confirmImplementation } from "@/lib/api";
import type { GitHubConnectionConfig } from "@/lib/types";

interface ReviewViewerProps {
  reviewMarkdown: string;
  reviewedChanges: string[];
  fixesApplied: string[];
  summary: string;
  branchName: string;
  commitMessage: string;
  changedFiles: string[];
  diff: string;
  buildCommand: string;
  buildOutput: string;
  buildSucceeded: boolean;
  buildChecked: boolean;
  stashMessage: string;
  prUrl: string;
  githubConnection?: GitHubConnectionConfig;
  onConfirmed: (prUrl: string) => void;
}

export default function ReviewViewer({
  reviewMarkdown,
  reviewedChanges,
  fixesApplied,
  summary,
  branchName,
  commitMessage,
  changedFiles,
  diff,
  buildCommand,
  buildOutput,
  buildSucceeded,
  buildChecked,
  stashMessage,
  prUrl,
  githubConnection,
  onConfirmed,
}: ReviewViewerProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setIsConfirming(true);
    setError(null);
    try {
      const result = await confirmImplementation({
        branch_name: branchName,
        commit_message: commitMessage,
        changed_files: changedFiles,
        summary,
        github_connection: githubConnection,
      });
      onConfirmed(result.pr_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to push and create PR.");
    }
    setIsConfirming(false);
  }

  if (!branchName) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h3 className="text-lg font-semibold text-zinc-300 mb-2">Review Not Ready</h3>
        <p className="text-sm text-zinc-500 max-w-md">
          Handoff the coding plan to the repo first. The prepared diff and build result will appear here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Review Changes</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleConfirm}
            disabled={Boolean(prUrl) || isConfirming || (buildChecked && !buildSucceeded)}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg transition-colors"
          >
            {isConfirming ? "Pushing..." : prUrl ? "PR Created" : "Confirm Push + PR"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-sm font-medium text-zinc-200 mb-3">Reviewer Report</div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">{reviewMarkdown || "No reviewer report available."}</pre>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-sm font-medium text-zinc-200 mb-3">Reviewed Changes</div>
            <div className="flex flex-wrap gap-2">
              {reviewedChanges.length > 0 ? reviewedChanges.map((item, index) => (
                <span key={`${item}-${index}`} className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 border border-zinc-700">{item}</span>
              )) : <span className="text-sm text-zinc-500">No reviewed changes listed.</span>}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-sm font-medium text-zinc-200 mb-3">Reviewer Fixes</div>
            <div className="flex flex-wrap gap-2">
              {fixesApplied.length > 0 ? fixesApplied.map((item, index) => (
                <span key={`${item}-${index}`} className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300 border border-emerald-500/20">{item}</span>
              )) : <span className="text-sm text-zinc-500">No reviewer fixes were applied.</span>}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-sm text-zinc-200 mb-2">{summary}</div>
          <div className="grid gap-2 text-xs text-zinc-400">
            <div><span className="text-zinc-500">Branch:</span> <code>{branchName}</code></div>
            <div><span className="text-zinc-500">Commit:</span> <code>{commitMessage}</code></div>
            {stashMessage && <div><span className="text-zinc-500">Stash:</span> <code>{stashMessage}</code></div>}
            {prUrl && (
              <div>
                <span className="text-zinc-500">PR:</span>{" "}
                <a href={prUrl} target="_blank" rel="noreferrer" className="text-indigo-400 underline hover:text-indigo-300">{prUrl}</a>
              </div>
            )}
          </div>
          {changedFiles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {changedFiles.map((file) => (
                <span key={file} className="rounded-lg bg-zinc-800 px-2 py-1 text-xs text-zinc-300 border border-zinc-700">{file}</span>
              ))}
            </div>
          )}
        </div>

        <div className={`rounded-2xl border p-4 ${buildChecked ? (buildSucceeded ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5") : "border-zinc-800 bg-zinc-900/60"}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-zinc-200">Build Verification</div>
            <div className={`text-xs ${buildChecked ? (buildSucceeded ? "text-emerald-400" : "text-red-400") : "text-zinc-500"}`}>
              {buildChecked ? (buildSucceeded ? "Passed" : "Failed") : "Not Checked"}
            </div>
          </div>
          {buildCommand && <div className="text-xs text-zinc-500 mb-2">Command: <code>{buildCommand}</code></div>}
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">{buildOutput || "No build output."}</pre>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="text-sm font-medium text-zinc-200 mb-3">Diff</div>
          <pre className="overflow-x-auto whitespace-pre-wrap text-xs text-zinc-300 bg-zinc-950/60 border border-zinc-800 rounded-xl p-3">{diff || "No diff available."}</pre>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}
      </div>
    </div>
  );
}
