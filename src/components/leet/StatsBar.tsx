"use client";

import { cn } from "@/lib/utils";
import type { SheetStats } from "@/lib/leet/types";

interface Props {
  stats: SheetStats | null;
  className?: string;
}

export function StatsBar({ stats, className }: Props) {
  if (!stats) return null;
  const totalPct = stats.total === 0 ? 0 : (stats.solved / stats.total) * 100;
  const diffs: Array<{ key: "Easy" | "Medium" | "Hard"; label: string; bar: string; text: string }> = [
    { key: "Easy", label: "Easy", bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    { key: "Medium", label: "Medium", bar: "bg-yellow-500", text: "text-yellow-600 dark:text-yellow-400" },
    { key: "Hard", label: "Hard", bar: "bg-red-500", text: "text-red-600 dark:text-red-400" },
  ];

  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3", className)}>
      <Card label="Overall" solved={stats.solved} total={stats.total} pct={totalPct} bar="bg-foreground" text="text-foreground" />
      {diffs.map((d) => {
        const s = stats.by_difficulty[d.key];
        const pct = s.total === 0 ? 0 : (s.solved / s.total) * 100;
        return <Card key={d.key} label={d.label} solved={s.solved} total={s.total} pct={pct} bar={d.bar} text={d.text} />;
      })}
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
