"use client";

import { useState, useEffect } from "react";
import ChatPanel from "@/components/ChatPanel";
import PRDViewer from "@/components/PRDViewer";
import { createSession } from "@/lib/api";

type Tab = "chat" | "prd";

export default function Home() {
  const [sessionId, setSessionId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<Tab>("chat");
  const [featureSummary, setFeatureSummary] = useState("");
  const [prdReady, setPrdReady] = useState(false);

  useEffect(() => {
    createSession()
      .then(setSessionId)
      .catch(() => {
        // Fallback session ID if backend is down
        setSessionId(`local-${Date.now()}`);
      });
  }, []);

  function handleFeatureComplete(summary: string) {
    setFeatureSummary(summary);
    setPrdReady(true);
    // Auto-switch to PRD tab
    setActiveTab("prd");
  }

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-zinc-500 text-sm">Initializing session...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-zinc-100">PRD Generator</h1>
          <span className="text-xs text-zinc-600 font-mono">v0.1</span>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-zinc-900 rounded-xl p-1 border border-zinc-800">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === "chat"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Chat
          </button>
          <button
            onClick={() => setActiveTab("prd")}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "prd"
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            PRD
            {prdReady && (
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </button>
        </div>

        <div className="text-xs text-zinc-600 font-mono">
          session: {sessionId.slice(0, 8)}...
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className={activeTab === "chat" ? "h-full" : "hidden"}>
          <ChatPanel sessionId={sessionId} onComplete={handleFeatureComplete} />
        </div>
        <div className={activeTab === "prd" ? "h-full" : "hidden"}>
          <PRDViewer sessionId={sessionId} featureSummary={featureSummary} />
        </div>
      </main>
    </div>
  );
}
