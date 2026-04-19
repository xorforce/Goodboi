const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChatResponse {
  reply: string;
  is_complete: boolean;
  feature_summary: string;
}

export interface PRDResponse {
  prd_markdown: string;
}

export interface SessionState {
  messages: { role: string; content: string }[];
  feature_summary: string;
  is_complete: boolean;
}

export async function createSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/session`, { method: "POST" });
  const data = await res.json();
  return data.session_id;
}

export async function sendMessage(
  sessionId: string,
  message: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message }),
  });
  return res.json();
}

export async function sendMessageWithFile(
  sessionId: string,
  message: string,
  file: File
): Promise<ChatResponse> {
  const formData = new FormData();
  formData.append("session_id", sessionId);
  formData.append("message", message);
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/chat/upload`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export async function generatePRD(sessionId: string): Promise<PRDResponse> {
  const res = await fetch(`${API_BASE}/api/generate-prd`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, message: "" }),
  });
  return res.json();
}

export async function getSessionState(
  sessionId: string
): Promise<SessionState> {
  const res = await fetch(`${API_BASE}/api/session/${sessionId}`);
  return res.json();
}
