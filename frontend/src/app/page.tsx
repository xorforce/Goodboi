"use client";

import { useCallback, useEffect, useState } from "react";

import ChatPanel from "@/components/ChatPanel";
import CodeViewer from "@/components/CodeViewer";
import PRDViewer from "@/components/PRDViewer";
import ReviewViewer from "@/components/ReviewViewer";
import SettingsModal from "@/components/SettingsModal";
import Sidebar from "@/components/Sidebar";
import StageTabs from "@/components/StageTabs";
import {
  createSession,
  generateCode,
  generatePRD,
  implementCode,
} from "@/lib/api";
import type { AppSettings, Session, StageTab } from "@/lib/types";
import {
  createNewSession,
  loadSessions,
  loadSettings,
  saveSessions,
  saveSettings,
} from "@/lib/store";

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ready, setReady] = useState(false);
  const [isHandingOffToPrd, setIsHandingOffToPrd] = useState(false);
  const [isHandingOffToCode, setIsHandingOffToCode] = useState(false);

  useEffect(() => {
    const saved = loadSessions();
    const savedSettings = loadSettings();
    setSettings(savedSettings);

    if (saved.length > 0) {
      setSessions(saved);
      setActiveSessionId(saved[0].id);
      setReady(true);
      return;
    }

    createSession()
      .then((id) => {
        const session = createNewSession(id);
        session.chatModel = savedSettings.defaultModel;
        session.prdModel = savedSettings.defaultModel;
        session.codeModel = savedSettings.defaultModel;
        setSessions([session]);
        saveSessions([session]);
        setActiveSessionId(id);
        setReady(true);
      })
      .catch(() => {
        const id = `local-${Date.now()}`;
        const session = createNewSession(id);
        session.chatModel = savedSettings.defaultModel;
        session.prdModel = savedSettings.defaultModel;
        session.codeModel = savedSettings.defaultModel;
        setSessions([session]);
        saveSessions([session]);
        setActiveSessionId(id);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  const activeSession = sessions.find((session) => session.id === activeSessionId);
  const activeGitHubConnection = settings?.connections.find(
    (connection) => connection.type === "github" && connection.connected
  );

  const updateSession = useCallback((id: string, patch: Partial<Session>) => {
    setSessions((prev) => prev.map((session) => (session.id === id ? { ...session, ...patch } : session)));
  }, []);

  async function handleNewSession() {
    const defaultModel = settings?.defaultModel ?? "gpt-4o";

    try {
      const id = await createSession();
      const session = createNewSession(id);
      session.chatModel = defaultModel;
      session.prdModel = defaultModel;
      session.codeModel = defaultModel;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(id);
    } catch {
      const id = `local-${Date.now()}`;
      const session = createNewSession(id);
      session.chatModel = defaultModel;
      session.prdModel = defaultModel;
      session.codeModel = defaultModel;
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(id);
    }
  }

  function handleTabChange(tab: StageTab) {
    if (activeSession) {
      updateSession(activeSession.id, { activeTab: tab });
    }
  }

  function handleFeatureComplete(summary: string) {
    if (!activeSession) return;

    updateSession(activeSession.id, {
      featureSummary: summary,
      prdMarkdown: "",
      codeMarkdown: "",
      reviewDiff: "",
      reviewMarkdown: "",
      reviewReviewedChanges: [],
      reviewFixesApplied: [],
      reviewSummary: "",
      reviewBranchName: "",
      reviewCommitMessage: "",
      reviewChangedFiles: [],
      reviewBuildCommand: "",
      reviewBuildOutput: "",
      reviewBuildSucceeded: false,
      reviewBuildChecked: false,
      reviewStashMessage: "",
      reviewPrUrl: "",
      isComplete: true,
    });
  }

  async function handoffToPrd() {
    if (!activeSession?.featureSummary) return;

    setIsHandingOffToPrd(true);
    try {
      const result = await generatePRD(activeSession.id, activeSession.prdModel);
      updateSession(activeSession.id, {
        prdMarkdown: result.prd_markdown,
        activeTab: "prd",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate PRD.";
      updateSession(activeSession.id, {
        prdMarkdown: `# PRD Generation Failed\n\n${message}`,
        activeTab: "prd",
      });
    } finally {
      setIsHandingOffToPrd(false);
    }
  }

  async function handoffToCode() {
    if (!activeSession?.prdMarkdown) return;

    setIsHandingOffToCode(true);
    updateSession(activeSession.id, {
      activeTab: "code",
      codeMarkdown: "",
      reviewDiff: "",
      reviewMarkdown: "",
      reviewReviewedChanges: [],
      reviewFixesApplied: [],
      reviewSummary: "",
      reviewBranchName: "",
      reviewCommitMessage: "",
      reviewChangedFiles: [],
      reviewBuildCommand: "",
      reviewBuildOutput: "",
      reviewBuildSucceeded: false,
      reviewBuildChecked: false,
      reviewStashMessage: "",
      reviewPrUrl: "",
    });

    try {
      const codeResult = await generateCode(activeSession.id, activeSession.codeModel);
      updateSession(activeSession.id, { codeMarkdown: codeResult.code_markdown });

      const prepared = await implementCode(
        activeSession.id,
        activeGitHubConnection?.config,
        activeSession.codeModel
      );

      updateSession(activeSession.id, {
        reviewMarkdown: prepared.review_markdown,
        reviewReviewedChanges: prepared.reviewed_changes,
        reviewFixesApplied: prepared.fixes_applied,
        reviewSummary: prepared.summary,
        reviewBranchName: prepared.branch_name,
        reviewCommitMessage: prepared.commit_message,
        reviewChangedFiles: prepared.changed_files,
        reviewStashMessage: prepared.stash_message,
        reviewDiff: prepared.diff_markdown,
        reviewBuildCommand: prepared.build_command,
        reviewBuildOutput: prepared.build_output,
        reviewBuildSucceeded: prepared.build_succeeded,
        reviewBuildChecked: prepared.build_checked,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate code.";
      updateSession(activeSession.id, {
        codeMarkdown: `# Code Generation Failed\n\n${message}`,
      });
    } finally {
      setIsHandingOffToCode(false);
    }
  }

  function handoffToReview() {
    if (activeSession?.reviewDiff) {
      updateSession(activeSession.id, { activeTab: "review" });
    }
  }

  function handlePrdGenerated(prdMarkdown: string) {
    if (activeSession) {
      updateSession(activeSession.id, { prdMarkdown });
    }
  }

  function handleReviewConfirmed(prUrl: string) {
    if (activeSession) {
      updateSession(activeSession.id, { reviewPrUrl: prUrl });
    }
  }

  function handleSaveSettings(nextSettings: AppSettings) {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  }

  const completedStages = new Set<StageTab>();
  if (activeSession?.isComplete) completedStages.add("chat");
  if (activeSession?.prdMarkdown) completedStages.add("prd");
  if (activeSession?.codeMarkdown) completedStages.add("code");
  if (activeSession?.reviewDiff) completedStages.add("review");

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-zinc-500 text-sm">Initializing...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h1 className="text-sm font-semibold text-zinc-100">goodboi</h1>
          </div>

          {activeSession && (
            <StageTabs
              activeTab={activeSession.activeTab}
              onTabChange={handleTabChange}
              completedStages={completedStages}
            />
          )}

          <div className="text-xs text-zinc-600 font-mono">{activeSessionId.slice(0, 8)}</div>
        </header>

        <main className="flex-1 overflow-hidden">
          {activeSession && (
            <>
              <div className={activeSession.activeTab === "chat" ? "h-full" : "hidden"}>
                <ChatPanel
                  key={activeSession.id}
                  sessionId={activeSession.id}
                  model={activeSession.chatModel}
                  onModelChange={(chatModel) => updateSession(activeSession.id, { chatModel })}
                  canHandoff={Boolean(activeSession.featureSummary)}
                  isHandingOff={isHandingOffToPrd}
                  onHandoff={handoffToPrd}
                  onComplete={handleFeatureComplete}
                />
              </div>

              <div className={activeSession.activeTab === "prd" ? "h-full" : "hidden"}>
                <PRDViewer
                  key={`prd-${activeSession.id}`}
                  sessionId={activeSession.id}
                  featureSummary={activeSession.featureSummary}
                  prdMarkdown={activeSession.prdMarkdown}
                  model={activeSession.prdModel}
                  onModelChange={(prdModel) => updateSession(activeSession.id, { prdModel })}
                  isHandingOff={isHandingOffToCode}
                  onHandoff={handoffToCode}
                  onGenerated={handlePrdGenerated}
                />
              </div>

              <div className={activeSession.activeTab === "code" ? "h-full" : "hidden"}>
                <CodeViewer
                  featureSummary={activeSession.featureSummary}
                  prdMarkdown={activeSession.prdMarkdown}
                  codeMarkdown={activeSession.codeMarkdown}
                  reviewSummary={activeSession.reviewSummary}
                  reviewBranchName={activeSession.reviewBranchName}
                  reviewDiff={activeSession.reviewDiff}
                  reviewBuildCommand={activeSession.reviewBuildCommand}
                  reviewBuildOutput={activeSession.reviewBuildOutput}
                  reviewBuildSucceeded={activeSession.reviewBuildSucceeded}
                  reviewBuildChecked={activeSession.reviewBuildChecked}
                  model={activeSession.codeModel}
                  onModelChange={(codeModel) => updateSession(activeSession.id, { codeModel })}
                  isHandingOff={isHandingOffToCode}
                  onHandoff={handoffToReview}
                />
              </div>

              <div className={activeSession.activeTab === "review" ? "h-full" : "hidden"}>
                <ReviewViewer
                  reviewMarkdown={activeSession.reviewMarkdown}
                  reviewedChanges={activeSession.reviewReviewedChanges}
                  fixesApplied={activeSession.reviewFixesApplied}
                  summary={activeSession.reviewSummary}
                  branchName={activeSession.reviewBranchName}
                  commitMessage={activeSession.reviewCommitMessage}
                  changedFiles={activeSession.reviewChangedFiles}
                  diff={activeSession.reviewDiff}
                  buildCommand={activeSession.reviewBuildCommand}
                  buildOutput={activeSession.reviewBuildOutput}
                  buildSucceeded={activeSession.reviewBuildSucceeded}
                  buildChecked={activeSession.reviewBuildChecked}
                  stashMessage={activeSession.reviewStashMessage}
                  prUrl={activeSession.reviewPrUrl}
                  githubConnection={activeGitHubConnection?.config}
                  onConfirmed={handleReviewConfirmed}
                />
              </div>
            </>
          )}
        </main>
      </div>

      {showSettings && settings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
