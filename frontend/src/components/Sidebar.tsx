"use client";

import type { Session } from "@/lib/types";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onOpenSettings: () => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onOpenSettings,
}: SidebarProps) {
  return (
    <aside className="w-64 h-full flex flex-col bg-zinc-950 border-r border-zinc-800/80">
      {/* New Chat -- pinned top */}
      <div className="p-3">
        <button
          onClick={onNewSession}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Chat
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        {sessions.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-zinc-600">
            No sessions yet
          </div>
        )}

        {sessions.map((s) => {
          const isActive = s.id === activeSessionId;
          return (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-3.5 h-3.5 shrink-0 opacity-50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
                <span className="truncate">{s.label}</span>
                {s.isComplete && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom: Settings */}
      <div className="p-3 border-t border-zinc-800/80">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
