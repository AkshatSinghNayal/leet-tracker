"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Filters } from "@/lib/leet/types";

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  className?: string;
}

export function ActiveFilters({ filters, onChange, className }: Props) {
  const chips: { label: string; clear: () => void }[] = [];

  if (filters.search) {
    chips.push({
      label: `Search: "${filters.search}"`,
      clear: () => onChange({ ...filters, search: "" }),
    });
  }
  for (const d of Array.from(filters.difficulty)) {
    chips.push({
      label: d,
      clear: () => {
        const next = new Set(filters.difficulty);
        next.delete(d as "Easy" | "Medium" | "Hard");
        onChange({ ...filters, difficulty: next });
      },
    });
  }
  if (filters.solved !== "all") {
    chips.push({
      label: filters.solved,
      clear: () => onChange({ ...filters, solved: "all" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {chips.map((c, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-xs"
        >
          <span className="capitalize">{c.label}</span>
          <button
            onClick={c.clear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Remove filter"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
