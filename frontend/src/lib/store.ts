/**
 * Simple in-memory store with localStorage persistence for sessions & settings.
 * Not using a state management lib to keep deps minimal.
 */

import type { Session, AppSettings, ValidatorAgent, Connection } from "./types";
import type { ModelId } from "./api";

const SESSIONS_KEY = "goodboi_sessions";
const SETTINGS_KEY = "goodboi_settings";

// ── Sessions ────────────────────────────────────────────────────────────

export function loadSessions(): Session[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    return raw
        ? JSON.parse(raw).map((session: Partial<Session>) => ({
          chatModel: DEFAULT_SETTINGS.defaultModel,
          prdModel: DEFAULT_SETTINGS.defaultModel,
          codeModel: DEFAULT_SETTINGS.defaultModel,
          prdMarkdown: "",
          codeMarkdown: "",
          reviewMarkdown: "",
          reviewReviewedChanges: [],
          reviewFixesApplied: [],
          reviewDiff: "",
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
          featureSummary: "",
          isComplete: false,
          activeTab: "chat",
          ...session,
        }))
      : [];
  } catch {
    return [];
  }
}

export function saveSessions(sessions: Session[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function createNewSession(id: string): Session {
  return {
    id,
    label: `Session ${id.slice(0, 6)}`,
    createdAt: Date.now(),
    activeTab: "chat",
    chatModel: DEFAULT_SETTINGS.defaultModel,
    prdModel: DEFAULT_SETTINGS.defaultModel,
    codeModel: DEFAULT_SETTINGS.defaultModel,
    featureSummary: "",
    prdMarkdown: "",
    codeMarkdown: "",
    reviewMarkdown: "",
    reviewReviewedChanges: [],
    reviewFixesApplied: [],
    reviewDiff: "",
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
    isComplete: false,
  };
}

// ── Settings ────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: AppSettings = {
  defaultModel: "gpt-4o" as ModelId,
  validatorAgents: [
    {
      id: "prd-reviewer",
      name: "PRD Reviewer",
      prompt:
        "Review the PRD for completeness, clarity, and feasibility. Flag any gaps.",
      enabled: true,
    },
  ],
  connections: [],
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function addValidatorAgent(
  settings: AppSettings,
  agent: ValidatorAgent
): AppSettings {
  return { ...settings, validatorAgents: [...settings.validatorAgents, agent] };
}

export function removeValidatorAgent(
  settings: AppSettings,
  agentId: string
): AppSettings {
  return {
    ...settings,
    validatorAgents: settings.validatorAgents.filter((a) => a.id !== agentId),
  };
}

export function addConnection(
  settings: AppSettings,
  connection: Connection
): AppSettings {
  return { ...settings, connections: [...settings.connections, connection] };
}

export function removeConnection(
  settings: AppSettings,
  connectionId: string
): AppSettings {
  return {
    ...settings,
    connections: settings.connections.filter((c) => c.id !== connectionId),
  };
}
