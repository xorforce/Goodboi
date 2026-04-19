"use client";

import { useEffect, useState } from "react";
import { getGitHubAuthStatus } from "@/lib/api";
import type { AppSettings, ValidatorAgent, Connection, GitHubConnectionConfig } from "@/lib/types";

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onClose: () => void;
}

type SettingsTab = "validators" | "connections";

export default function SettingsModal({
  settings,
  onSave,
  onClose,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("validators");
  const [local, setLocal] = useState<AppSettings>(() => structuredClone(settings));
  const [authMessages, setAuthMessages] = useState<Record<string, string>>({});
  const [checkingConnections, setCheckingConnections] = useState<Record<string, boolean>>({});

  // ── Validator agent helpers ─────────────────────────────────────────
  function addAgent() {
    const agent: ValidatorAgent = {
      id: `agent-${Date.now()}`,
      name: "",
      prompt: "",
      enabled: true,
    };
    setLocal({ ...local, validatorAgents: [...local.validatorAgents, agent] });
  }

  function updateAgent(id: string, patch: Partial<ValidatorAgent>) {
    setLocal({
      ...local,
      validatorAgents: local.validatorAgents.map((a) =>
        a.id === id ? { ...a, ...patch } : a
      ),
    });
  }

  function removeAgent(id: string) {
    setLocal({
      ...local,
      validatorAgents: local.validatorAgents.filter((a) => a.id !== id),
    });
  }

  // ── Connection helpers ──────────────────────────────────────────────
  function addGitHubConnection() {
    const conn: Connection = {
      id: `conn-${Date.now()}`,
      type: "github",
      label: "GitHub",
      config: { token: "", owner: "", repo: "", branch: "main" },
      connected: false,
    };
    setLocal({ ...local, connections: [...local.connections, conn] });
  }

  function updateConnection(id: string, config: Partial<GitHubConnectionConfig>) {
    setLocal({
      ...local,
      connections: local.connections.map((c) =>
        c.id === id ? { ...c, config: { ...c.config, ...config } } : c
      ),
    });
  }

  async function checkConnectionAuth(id: string) {
    const connection = local.connections.find((c) => c.id === id);
    if (!connection) return;

    setCheckingConnections((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await getGitHubAuthStatus(connection.config);
      setLocal((prev) => ({
        ...prev,
        connections: prev.connections.map((c) =>
          c.id === id ? { ...c, connected: result.connected } : c
        ),
      }));
      setAuthMessages((prev) => ({
        ...prev,
        [id]: result.connected ? "Connected" : result.message,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "GitHub auth check failed.";
      setLocal((prev) => ({
        ...prev,
        connections: prev.connections.map((c) =>
          c.id === id ? { ...c, connected: false } : c
        ),
      }));
      setAuthMessages((prev) => ({ ...prev, [id]: message }));
    }
    setCheckingConnections((prev) => ({ ...prev, [id]: false }));
  }

  useEffect(() => {
    if (activeTab !== "connections") return;
    local.connections.forEach((connection) => {
      void checkConnectionAuth(connection.id);
    });
    // intentionally only reacts to connection list changes / tab changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, local.connections.length]);

  function removeConnection(id: string) {
    setLocal({
      ...local,
      connections: local.connections.filter((c) => c.id !== id),
    });
  }

  function handleSave() {
    onSave(local);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button
            onClick={onClose}
            className="p-1 text-zinc-500 hover:text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex px-6 pt-3 gap-1">
          <button
            onClick={() => setActiveTab("validators")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "validators"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Validator Agents
          </button>
          <button
            onClick={() => setActiveTab("connections")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === "connections"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Connections
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === "validators" && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                Validator agents review outputs at each stage. Configure their
                name and system prompt.
              </p>

              {local.validatorAgents.map((agent) => (
                <div
                  key={agent.id}
                  className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl space-y-3"
                >
                  <div className="flex items-center gap-3">
                    {/* Enabled toggle */}
                    <button
                      onClick={() => updateAgent(agent.id, { enabled: !agent.enabled })}
                      className={`w-8 h-5 rounded-full transition-colors relative ${
                        agent.enabled ? "bg-indigo-600" : "bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                          agent.enabled ? "left-3.5" : "left-0.5"
                        }`}
                      />
                    </button>

                    <input
                      type="text"
                      value={agent.name}
                      onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                      placeholder="Agent name"
                      className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />

                    <button
                      onClick={() => removeAgent(agent.id)}
                      className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <textarea
                    value={agent.prompt}
                    onChange={(e) => updateAgent(agent.id, { prompt: e.target.value })}
                    placeholder="System prompt for this validator agent..."
                    rows={3}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 resize-none"
                  />
                </div>
              ))}

              <button
                onClick={addAgent}
                className="w-full py-2 text-sm text-zinc-500 hover:text-zinc-300 border border-dashed border-zinc-700 hover:border-zinc-600 rounded-xl transition-colors"
              >
                + Add Validator Agent
              </button>
            </div>
          )}

          {activeTab === "connections" && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-500">
                Connect external services to push PRDs, code, and other
                artifacts.
              </p>

              {local.connections.map((conn) => (
                <div
                  key={conn.id}
                  className="p-4 bg-zinc-800/50 border border-zinc-700/50 rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* GitHub icon */}
                      <svg className="w-5 h-5 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                      </svg>
                      <span className="text-sm font-medium text-zinc-200">GitHub</span>
                      <span className="inline-flex items-center gap-1.5 text-xs px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            conn.connected ? "bg-emerald-400" : "bg-red-400"
                          }`}
                        />
                        {conn.connected ? "Connected" : "Disconnected"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void checkConnectionAuth(conn.id)}
                        disabled={checkingConnections[conn.id]}
                        className="px-3 py-1 text-xs rounded-lg transition-colors bg-indigo-600 text-white hover:bg-indigo-500 disabled:bg-zinc-700"
                      >
                        {checkingConnections[conn.id] ? "Checking..." : "Check Auth"}
                      </button>
                      <button
                        onClick={() => removeConnection(conn.id)}
                        className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Personal Access Token</label>
                      <input
                        type="password"
                        value={conn.config.token}
                        onChange={(e) => updateConnection(conn.id, { token: e.target.value })}
                        placeholder="ghp_..."
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Owner / Org</label>
                      <input
                        type="text"
                        value={conn.config.owner}
                        onChange={(e) => updateConnection(conn.id, { owner: e.target.value })}
                        placeholder="my-org"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Repository</label>
                      <input
                        type="text"
                        value={conn.config.repo}
                        onChange={(e) => updateConnection(conn.id, { repo: e.target.value })}
                        placeholder="my-repo"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Branch</label>
                      <input
                        type="text"
                        value={conn.config.branch}
                        onChange={(e) => updateConnection(conn.id, { branch: e.target.value })}
                        placeholder="main"
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                    </div>
                  </div>

                  <div className="text-xs text-zinc-500 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2">
                    {authMessages[conn.id] || "Run GitHub auth check to verify this connection."}
                  </div>
                </div>
              ))}

              <button
                onClick={addGitHubConnection}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-zinc-500 hover:text-zinc-300 border border-dashed border-zinc-700 hover:border-zinc-600 rounded-xl transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Add GitHub Connection
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
