"use client";

import type { ReactNode } from "react";
import type { StageTab } from "@/lib/types";

interface StageTabsProps {
  activeTab: StageTab;
  onTabChange: (tab: StageTab) => void;
  completedStages: Set<StageTab>;
}

const TABS: { id: StageTab; label: string; icon: ReactNode }[] = [
  {
    id: "chat",
    label: "Chat",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
  {
    id: "prd",
    label: "PRD",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "code",
    label: "Code",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    id: "review",
    label: "Code Review",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function StageTabs({
  activeTab,
  onTabChange,
  completedStages,
}: StageTabsProps) {
  return (
    <div className="flex items-center gap-1 bg-zinc-900/50 rounded-xl p-1 border border-zinc-800/60">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDone = completedStages.has(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              isActive
                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {tab.icon}
            {tab.label}
            {isDone && !isActive && (
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
