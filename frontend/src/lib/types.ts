import type { ModelId } from "./api";

export type StageTab = "chat" | "prd" | "code" | "review";

export interface Session {
  id: string;
  label: string;
  createdAt: number;
  activeTab: StageTab;
  chatModel: ModelId;
  prdModel: ModelId;
  codeModel: ModelId;
  featureSummary: string;
  prdMarkdown: string;
  codeMarkdown: string;
  reviewDiff: string;
  reviewMarkdown: string;
  reviewReviewedChanges: string[];
  reviewFixesApplied: string[];
  reviewSummary: string;
  reviewBranchName: string;
  reviewCommitMessage: string;
  reviewChangedFiles: string[];
  reviewBuildCommand: string;
  reviewBuildOutput: string;
  reviewBuildSucceeded: boolean;
  reviewBuildChecked: boolean;
  reviewStashMessage: string;
  reviewPrUrl: string;
  isComplete: boolean;
}

export interface AppSettings {
  defaultModel: ModelId;
  validatorAgents: ValidatorAgent[];
  connections: Connection[];
}

export interface ValidatorAgent {
  id: string;
  name: string;
  prompt: string;
  enabled: boolean;
}

export interface Connection {
  id: string;
  type: "github";
  label: string;
  config: GitHubConnectionConfig;
  connected: boolean;
}

export interface GitHubConnectionConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
}
