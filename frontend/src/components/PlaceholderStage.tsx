"use client";

import type { ReactNode } from "react";

interface PlaceholderStageProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export default function PlaceholderStage({
  title,
  description,
  icon,
}: PlaceholderStageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="w-16 h-16 mb-6 rounded-2xl bg-zinc-800 border border-zinc-700/50 flex items-center justify-center text-zinc-500">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-zinc-300 mb-2">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-md">{description}</p>
    </div>
  );
}
