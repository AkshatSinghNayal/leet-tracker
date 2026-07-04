"use client";

import { ArrowUp, ArrowDown, ArrowUpDown, ExternalLink, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { QuestionsResponse, SortBy, SortDir } from "@/lib/leet/types";
import { DifficultyBadge } from "./DifficultyBadge";
import { useToggleSolved } from "@/hooks/useSheets";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Props {
  sheetId: string;
  data: QuestionsResponse | null;
  isLoading: boolean;
  sortBy: SortBy;
  sortDir: SortDir;
  onSortChange: (by: SortBy, dir: SortDir) => void;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

export function QuestionTable({
  sheetId, data, isLoading, sortBy, sortDir, onSortChange, page, pageSize, onPageChange, onPageSizeChange,
}: Props) {
  const toggleMut = useToggleSolved(sheetId);
  const qc = useQueryClient();

  const headers: Array<{ key: SortBy | "status" | "actions"; label: string; sortable: boolean; className?: string }> = [
    { key: "status", label: "✓", sortable: false, className: "w-10" },
    { key: "id", label: "#", sortable: true, className: "w-16 tabular-nums" },
    { key: "title", label: "Title", sortable: true },
    { key: "difficulty", label: "Level", sortable: true, className: "w-24" },
    { key: "primary_topic", label: "Topic", sortable: true, className: "w-44" },
    { key: "actions", label: "", sortable: false, className: "w-10" },
  ];

  const onSortClick = (key: SortBy) => {
    if (sortBy === key) {
      onSortChange(key, sortDir === "asc" ? "desc" : "asc");
    } else {
      onSortChange(key, "asc");
    }
  };

  const handleToggle = async (questionId: string, leetcodeId: number, currentSolved: boolean) => {
    const newSolved = !currentSolved;
    try {
      const result = await toggleMut.mutateAsync({ questionId, solved: newSolved });
      // Invalidate all queries — global solved sync means other sheets may have changed too
      qc.invalidateQueries({ queryKey: ["questions"] });
      qc.invalidateQueries({ queryKey: ["sheets"] });
      if (result.propagated) {
        toast.info(
          newSolved
            ? `Marked solved across all sheets (LeetCode #${leetcodeId}).`
            : `Marked unsolved across all sheets (LeetCode #${leetcodeId}).`,
          { duration: 2500 }
        );
      }
    } catch (e) {
      toast.error((e as Error).message || "Failed to toggle");
    }
  };

  return (
    <div className="rounded-md border border-border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {headers.map((h) => (
                <TableHead key={h.key} className={cn("text-xs font-medium text-muted-foreground", h.className)}>
                  {h.sortable ? (
                    <button
                      onClick={() => onSortClick(h.key as SortBy)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {h.label}
                      {sortBy === h.key ? (
                        sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    h.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell>
                </TableRow>
              ))
            ) : !data || data.questions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                  No questions match your filters.
                </TableCell>
              </TableRow>
            ) : (
              data.questions.map((q) => (
                <TableRow
                  key={q.id}
                  className={cn(
                    "group",
                    q.solved && "opacity-60"
                  )}
                >
                  <TableCell>
                    <Checkbox
                      checked={q.solved}
                      onCheckedChange={() => handleToggle(q.id, q.leetcode_id, q.solved)}
                      aria-label={`Mark ${q.title} as ${q.solved ? "unsolved" : "solved"}`}
                      disabled={toggleMut.isPending}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{q.leetcode_id}</TableCell>
                  <TableCell>
                    <a
                      href={q.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "text-sm hover:underline inline-flex items-center gap-1.5 group/link",
                        q.solved && "line-through"
                      )}
                    >
                      <span>{q.title}</span>
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover/link:opacity-100 text-muted-foreground" />
                    </a>
                  </TableCell>
                  <TableCell><DifficultyBadge difficulty={q.difficulty} /></TableCell>
                  <TableCell>
                    {q.primary_topic && q.primary_topic !== "Uncategorized" ? (
                      <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs text-muted-foreground">
                        {q.primary_topic}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data && data.total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-3 py-2 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <span className="hidden sm:inline">
              · {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, data.total)} of {data.total}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page <= 1}
              onClick={() => onPageChange(1)}
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Prev
            </Button>
            <span className="text-xs text-muted-foreground px-2 tabular-nums">
              {page} / {data.total_pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page >= data.total_pages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              disabled={page >= data.total_pages}
              onClick={() => onPageChange(data.total_pages)}
            >
              Last
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
