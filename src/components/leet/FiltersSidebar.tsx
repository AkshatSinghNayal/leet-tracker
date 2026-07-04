"use client";

import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Filters, SolvedFilter } from "@/lib/leet/types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  total: number;
  className?: string;
}

const DIFFS: Array<"Easy" | "Medium" | "Hard"> = ["Easy", "Medium", "Hard"];

export function FiltersSidebar({ filters, onChange, total, className }: Props) {
  const toggleDiff = (d: "Easy" | "Medium" | "Hard") => {
    const next = new Set(filters.difficulty);
    if (next.has(d)) next.delete(d); else next.add(d);
    onChange({ ...filters, difficulty: next });
  };

  const setSolved = (s: SolvedFilter) => onChange({ ...filters, solved: s });

  const clearAll = () => onChange({ search: "", difficulty: new Set(), solved: "all" });

  const hasActive = filters.search.length > 0 || filters.difficulty.size > 0 || filters.solved !== "all";

  return (
    <aside className={cn("flex flex-col gap-5", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Filters</h2>
        {hasActive && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={clearAll}>
            <RotateCcw className="w-3 h-3 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Search */}
      <div className="space-y-1.5">
        <Label htmlFor="search" className="text-xs text-muted-foreground">Title search</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            id="search"
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search by title…"
            className="pl-8 h-9"
          />
        </div>
      </div>

      {/* Difficulty */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Difficulty</Label>
        <div className="flex flex-col gap-1.5">
          {DIFFS.map((d) => {
            const active = filters.difficulty.has(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => toggleDiff(d)}
                className={cn(
                  "inline-flex items-center justify-between rounded-md border px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "border-foreground/40 bg-foreground/5 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("w-1.5 h-1.5 rounded-full", diffDotClass(d))} />
                  {d}
                </span>
                <span className={cn(
                  "w-3.5 h-3.5 rounded-sm border",
                  active ? "bg-foreground border-foreground" : "border-border"
                )} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Solved */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Solved state</Label>
        <div className="grid grid-cols-3 gap-1">
          {(["all", "solved", "unsolved"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSolved(s)}
              className={cn(
                "rounded-md border px-2 py-1.5 text-xs capitalize transition-colors",
                filters.solved === s
                  ? "border-foreground/40 bg-foreground/5 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-muted-foreground border-t border-border pt-3">
        {total.toLocaleString()} question{total === 1 ? "" : "s"} match
      </div>
    </aside>
  );
}

function diffDotClass(d: "Easy" | "Medium" | "Hard") {
  if (d === "Easy") return "bg-emerald-500";
  if (d === "Medium") return "bg-yellow-500";
  return "bg-red-500";
}
