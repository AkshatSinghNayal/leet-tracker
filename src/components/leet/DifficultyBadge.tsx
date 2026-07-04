"use client";

import { cn } from "@/lib/utils";

type Diff = "Easy" | "Medium" | "Hard";

export function DifficultyBadge({ difficulty, className }: { difficulty: Diff; className?: string }) {
  const cls =
    difficulty === "Easy"
      ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : difficulty === "Medium"
      ? "text-yellow-600 dark:text-yellow-400 border-yellow-500/30 bg-yellow-500/10"
      : "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10";
  return (
    <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium", cls, className)}>
      {difficulty}
    </span>
  );
}
