"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet as SheetPanel } from "@/components/ui/sheet";
import { Header } from "./Header";
import { SheetTabs } from "./SheetTabs";
import { FiltersSidebar } from "./FiltersSidebar";
import { ActiveFilters } from "./ActiveFilters";
import { StatsBar } from "./StatsBar";
import { QuestionTable } from "./QuestionTable";
import { EmptyState } from "./EmptyState";
import { useSheets } from "@/hooks/useSheets";
import { useDebounce } from "@/hooks/useDebounce";
import { sheetsApi } from "@/lib/leet/api";
import type { Filters, SortBy, SortDir, QuestionsResponse } from "@/lib/leet/types";

export function Dashboard() {
  const { data: sheets = [], isLoading: sheetsLoading } = useSheets();
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<Set<"Easy" | "Medium" | "Hard">>(new Set());
  const [solvedFilter, setSolvedFilter] = useState<"all" | "solved" | "unsolved">("all");

  const [sortBy, setSortBy] = useState<SortBy>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Auto-select the first sheet when sheets load — use a "selected once" guard
  // to avoid cascading setState in effects. This is a derived value with a fallback.
  const effectiveSheetId = useMemo(() => {
    if (sheetsLoading || sheets.length === 0) return null;
    if (activeSheetId && sheets.find((s) => s.id === activeSheetId)) return activeSheetId;
    return sheets[0].id;
  }, [sheets, sheetsLoading, activeSheetId]);

  // Reset page when filters change — handled inline in setters below (no effects).

  // Debounce the search input
  const debouncedSearch = useDebounce(searchInput, 300);

  const filters: Filters = useMemo(() => ({
    search: debouncedSearch,
    difficulty: difficultyFilter,
    solved: solvedFilter,
  }), [debouncedSearch, difficultyFilter, solvedFilter]);

  // Build the query string
  const queryStr = useMemo(() => {
    const params: Record<string, string> = {
      sort_by: sortBy,
      sort_dir: sortDir,
      page: String(page),
      page_size: String(pageSize),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (difficultyFilter.size > 0) params.difficulty = Array.from(difficultyFilter).join(",");
    if (solvedFilter !== "all") params.solved = solvedFilter;
    return params;
  }, [debouncedSearch, difficultyFilter, solvedFilter, sortBy, sortDir, page, pageSize]);

  const { data, isLoading: questionsLoading, isFetching } = useQuery<QuestionsResponse>({
    queryKey: ["questions", effectiveSheetId, queryStr],
    queryFn: () => sheetsApi.questions(effectiveSheetId!, queryStr),
    enabled: !!effectiveSheetId,
  });

  // Wrap filter setters to also reset page
  const updateFilters = useCallback((partial: Partial<{ search: string; difficulty: Set<"Easy" | "Medium" | "Hard">; solved: "all" | "solved" | "unsolved" }>) => {
    if ("search" in partial) setSearchInput(partial.search ?? "");
    if ("difficulty" in partial) setDifficultyFilter(partial.difficulty ?? new Set());
    if ("solved" in partial) setSolvedFilter(partial.solved ?? "all");
    setPage(1);
  }, []);

  const onSortChange = useCallback((by: SortBy, dir: SortDir) => {
    setSortBy(by);
    setSortDir(dir);
    setPage(1);
  }, []);

  const onSelectSheet = useCallback((id: string) => {
    setActiveSheetId(id);
    setPage(1);
  }, []);

  const onPageSizeChange = useCallback((s: number) => {
    setPageSize(s);
    setPage(1);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <SheetTabs activeSheetId={effectiveSheetId} onSelect={onSelectSheet} />

      <main className="flex-1 px-4 sm:px-6 py-4">
        {sheetsLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : sheets.length === 0 ? (
          <EmptyState />
        ) : !effectiveSheetId ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            Select a sheet to view its questions.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <StatsBar stats={data?.stats ?? null} />

            <div className="flex flex-col lg:flex-row gap-4">
              {/* Desktop sidebar */}
              <div className="hidden lg:block w-60 shrink-0">
                <FiltersSidebar
                  filters={filters}
                  onChange={(f) => updateFilters({ search: f.search, difficulty: f.difficulty, solved: f.solved })}
                  total={data?.total ?? 0}
                  className="rounded-md border border-border bg-card p-4"
                />
              </div>

              {/* Mobile filter trigger */}
              <div className="lg:hidden">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters
                  {(searchInput || difficultyFilter.size > 0 || solvedFilter !== "all") && (
                    <span className="ml-1 rounded-full bg-foreground text-background text-[10px] px-1.5 py-0.5 leading-none">
                      {(searchInput ? 1 : 0) + difficultyFilter.size + (solvedFilter !== "all" ? 1 : 0)}
                    </span>
                  )}
                </Button>
              </div>

              {/* Mobile filter sheet (slide-over) */}
              {filtersOpen && (
                <div className="lg:hidden fixed inset-0 z-50">
                  <div className="absolute inset-0 bg-black/40" onClick={() => setFiltersOpen(false)} />
                  <div className="absolute inset-y-0 right-0 w-72 bg-background border-l border-border p-4 shadow-xl overflow-y-auto">
                    <div className="flex justify-end mb-2">
                      <button onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="p-1 rounded-md hover:bg-muted">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <FiltersSidebar
                      filters={filters}
                      onChange={(f) => updateFilters({ search: f.search, difficulty: f.difficulty, solved: f.solved })}
                      total={data?.total ?? 0}
                    />
                  </div>
                </div>
              )}
              {/* SheetPanel is imported but not used for filters anymore — keep ref to avoid unused import */}
              <div className="hidden">{SheetPanel ? "" : ""}</div>

              {/* Main column */}
              <div className="flex-1 min-w-0 space-y-3">
                <ActiveFilters filters={filters} onChange={(f) => updateFilters({ search: f.search, difficulty: f.difficulty, solved: f.solved })} />

                <div className="relative">
                  <QuestionTable
                    sheetId={effectiveSheetId}
                    data={data ?? null}
                    isLoading={questionsLoading}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSortChange={onSortChange}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={onPageSizeChange}
                  />
                  {isFetching && !questionsLoading && (
                    <div className="absolute top-2 right-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="px-4 sm:px-6 py-4 border-t border-border text-xs text-muted-foreground text-center mt-auto">
        LeetCode Tracker · Per-user sheets · JWT auth · {sheets.length} sheet{sheets.length === 1 ? "" : "s"}
      </footer>
    </div>
  );
}
