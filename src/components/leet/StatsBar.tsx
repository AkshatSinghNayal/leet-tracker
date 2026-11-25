"use client";

import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SheetStats } from "@/lib/leet/types";

interface Props {
  stats: SheetStats | null;
  syncWithGlobal?: boolean;
  className?: string;
}

export function StatsBar({ stats, syncWithGlobal = true, className }: Props) {
  if (!stats) return null;
  const totalPct = stats.total === 0 ? 0 : (stats.solved / stats.total) * 100;
  const diffs: Array<{ key: "Easy" | "Medium" | "Hard"; label: string; bar: string; text: string }> = [
    { key: "Easy", label: "Easy", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    { key: "Medium", label: "Medium", bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" },
    { key: "Hard", label: "Hard", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  ];

  return (
    <div className={cn("space-y-2.5", className)}>
      {!syncWithGlobal && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span className="font-medium">Revision Mode</span>
          <span className="text-amber-700/80 dark:text-amber-300/80">
            · Changes affect only this sheet. Your global LeetCode progress is safely preserved.
          </span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Overall" solved={stats.solved} total={stats.total} pct={totalPct} bar="bg-foreground" text="text-foreground" />
        {diffs.map((d) => {
          const s = stats.by_difficulty[d.key];
          const pct = s.total === 0 ? 0 : (s.solved / s.total) * 100;
          return <Card key={d.key} label={d.label} solved={s.solved} total={s.total} pct={pct} bar={d.bar} text={d.text} />;
        })}
      </div>
    </div>
  );
}

function Card({ label, solved, total, pct, bar, text }: { label: string; solved: number; total: number; pct: number; bar: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("text-sm font-semibold tabular-nums", text)}>
          {solved}<span className="text-muted-foreground">/{total}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-muted-foreground tabular-nums">{pct.toFixed(1)}%</div>
    </div>
  );
}
