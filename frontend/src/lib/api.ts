const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface AvailableModel {
  id: string;
  owned_by?: string;
  created?: number | null;
}

export type ModelId = string;

export interface ChatResponse {
  reply: string;
  is_complete: boolean;
  feature_summary: string;
}

export interface PRDResponse {
  prd_markdown: string;
}

export interface CodeResponse {
  code_markdown: string;
}

export interface ImplementCodeResponse {
  summary: string;
  branch_name: string;
  commit_message: string;
  changed_files: string[];
  stash_message: string;
  diff_markdown: string;
  review_markdown: string;
  reviewed_changes: string[];
  fixes_applied: string[];
  build_command: string;
  build_output: string;
  build_succeeded: boolean;
  build_checked: boolean;
  pushed: boolean;
  pr_url: string;
}

export interface ConfirmImplementationResponse {
  summary: string;
  branch_name: string;
  commit_message: string;
  changed_files: string[];
  pushed: boolean;
  pr_url: string;
}

export interface GitHubAuthStatusResponse {
  connected: boolean;
  message: string;
  repo_access?: boolean | null;
}

export interface SessionState {
  messages: { role: string; content: string }[];
  feature_summary: string;
  prd_markdown: string;
  code_markdown: string;
  is_complete: boolean;
}

let availableModelsCache: AvailableModel[] | null = null;
let availableModelsPromise: Promise<AvailableModel[]> | null = null;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail || `Server error ${res.status}`;
    throw new Error(detail);
  }
  return res.json();
}

export async function createSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/session`, { method: "POST" });
  const data = await handleResponse<{ session_id: string }>(res);
  return data.session_id;
}

export async function getAvailableModels(force = false): Promise<AvailableModel[]> {
  if (!force && availableModelsCache) {
    return availableModelsCache;
  }

  if (!force && availableModelsPromise) {
    return availableModelsPromise;
  }

  availableModelsPromise = (async () => {
    const res = await fetch(`${API_BASE}/api/models`);
    const data = await handleResponse<{ models: AvailableModel[] }>(res);
    availableModelsCache = data.models;
    availableModelsPromise = null;
    return data.models;
  })().catch((error) => {
    availableModelsPromise = null;
    throw error;
  });

  return availableModelsPromise;
}

export async function sendMessage(
  sessionId: string,
  message: string,
  model?: ModelId,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message, model }),
    signal,
  });
  return handleResponse<ChatResponse>(res);
}

export async function sendMessageWithFile(
  sessionId: string,
  message: string,
  file: File,
  model?: ModelId,
  signal?: AbortSignal
): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("message", message);
  formData.append("file", file);
  if (model) formData.append("model", model);

  const res = await fetch(`${API_BASE}/api/chat/upload`, {
    method: "POST",
    body: formData,
    signal,
  });
  return handleResponse<ChatResponse>(res);
}

export async function generatePRD(
  sessionId: string,
  model?: ModelId,
  signal?: AbortSignal
): Promise<PRDResponse> {
  const res = await fetch(`${API_BASE}/api/generate-prd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, model }),
    signal,
  });
  return handleResponse<PRDResponse>(res);
}

export async function generateCode(
  sessionId: string,
  model?: ModelId,
  signal?: AbortSignal
): Promise<CodeResponse> {
  const res = await fetch(`${API_BASE}/api/generate-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, model }),
    signal,
  });
  return handleResponse<CodeResponse>(res);
}

export async function implementCode(
  sessionId: string,
  githubConnection?: {
    token: string;
    owner: string;
    repo: string;
    branch: string;
  },
  model?: ModelId,
  signal?: AbortSignal
): Promise<ImplementCodeResponse> {
  const res = await fetch(`${API_BASE}/api/implement-code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      github_connection: githubConnection,
      model,
    }),
    signal,
  });
  return handleResponse<ImplementCodeResponse>(res);
}

export async function confirmImplementation(
  payload: {
    branch_name: string;
    commit_message: string;
    changed_files: string[];
    summary: string;
    github_connection?: {
      token: string;
      owner: string;
      repo: string;
      branch: string;
    };
  },
  signal?: AbortSignal
): Promise<ConfirmImplementationResponse> {
  const res = await fetch(`${API_BASE}/api/confirm-implementation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });
  return handleResponse<ConfirmImplementationResponse>(res);
}

export async function getGitHubAuthStatus(
  githubConnection?: {
    token: string;
    owner: string;
    repo: string;
    branch: string;
  }
): Promise<GitHubAuthStatusResponse> {
  const res = await fetch(`${API_BASE}/api/github-auth-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ github_connection: githubConnection }),
  });
  return handleResponse<GitHubAuthStatusResponse>(res);
}

export async function getSessionState(
  sessionId: string
): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
  return handleResponse<SessionState>(res);
}
