"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sheetsApi } from "@/lib/leet/api";
import type { QuestionsResponse, Sheet } from "@/lib/leet/types";

export function useSheets() {
  return useQuery({
    queryKey: ["sheets"],
    queryFn: () => sheetsApi.list().then((r) => r.sheets),
  });
}

export function useCreateSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => sheetsApi.create(name).then((r) => r.sheet),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}

export function useRenameSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => sheetsApi.rename(id, name).then((r) => r.sheet),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sheets"] }),
  });
}

export function useToggleSheetSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, syncWithGlobal }: { id: string; syncWithGlobal: boolean }) =>
      sheetsApi.setSyncWithGlobal(id, syncWithGlobal).then((r) => r.sheet),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheets"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useResetSheetRevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sheetsApi.resetRevision(id).then((r) => r.sheet),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheets"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useDeleteSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sheetsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheets"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useUploadCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sheetId, file }: { sheetId: string; file: File }) => sheetsApi.upload(sheetId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheets"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
  });
}

export function useToggleSolved(sheetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, solved }: { questionId: string; solved: boolean }) =>
      sheetsApi.toggleSolved(sheetId, questionId, solved),
    onMutate: async ({ questionId, solved }) => {
      await qc.cancelQueries({ queryKey: ["questions"] });
      await qc.cancelQueries({ queryKey: ["sheets"] });

      const previousQuestions = qc.getQueriesData<QuestionsResponse>({ queryKey: ["questions"] });
      const previousSheets = qc.getQueryData<Sheet[]>(["sheets"]);

      const activeSheet = previousSheets?.find((s) => s.id === sheetId);
      const isSyncedSheet = activeSheet?.sync_with_global ?? true;
      const syncedSheetIds = new Set(
        (previousSheets ?? []).filter((s) => s.sync_with_global).map((s) => s.id)
      );

      // Find the target question in cached queries for the active sheet
      let targetQuestion: QuestionsResponse["questions"][number] | undefined;
      for (const [key, data] of previousQuestions) {
        if (key[1] === sheetId && data) {
          targetQuestion = data.questions.find((q) => q.id === questionId);
          if (targetQuestion) break;
        }
      }

      const nowIso = solved ? new Date().toISOString() : null;
      const targetLeetcodeId = targetQuestion?.leetcode_id;

      // Track how each sheet's solved_count changes optimistically
      const sheetDelta = new Map<string, number>();

      for (const [key, data] of previousQuestions) {
        if (!data) continue;
        const querySheetId = key[1];
        if (typeof querySheetId !== "string") continue;

        const shouldUpdateSheet =
          querySheetId === sheetId ||
          (isSyncedSheet && targetLeetcodeId !== undefined && syncedSheetIds.has(querySheetId));

        if (!shouldUpdateSheet) continue;

        let changedQuestion: QuestionsResponse["questions"][number] | undefined;
        const nextQuestions = data.questions.map((q) => {
          const matches =
            querySheetId === sheetId && q.id === questionId
              ? true
              : isSyncedSheet && targetLeetcodeId !== undefined && q.leetcode_id === targetLeetcodeId;
          if (!matches || q.solved === solved) return q;
          changedQuestion = q;
          return { ...q, solved, solved_at: nowIso };
        });

        if (!changedQuestion) continue;

        const delta = solved ? 1 : -1;
        if (!sheetDelta.has(querySheetId)) {
          sheetDelta.set(querySheetId, delta);
        }

        const diffKey = changedQuestion.difficulty;
        const prevDiff = data.stats.by_difficulty[diffKey];
        const nextStats = {
          ...data.stats,
          solved: Math.max(0, Math.min(data.stats.total, data.stats.solved + delta)),
          by_difficulty: {
            ...data.stats.by_difficulty,
            [diffKey]: {
              ...prevDiff,
              solved: Math.max(0, Math.min(prevDiff.total, prevDiff.solved + delta)),
            },
          },
        };

        qc.setQueryData<QuestionsResponse>(key, {
          ...data,
          questions: nextQuestions,
          stats: nextStats,
        });
      }

      if (previousSheets) {
        qc.setQueryData<Sheet[]>(
          ["sheets"],
          previousSheets.map((s) => {
            const delta = sheetDelta.get(s.id);
            if (!delta) return s;
            return {
              ...s,
              solved_count: Math.max(0, Math.min(s.question_count, s.solved_count + delta)),
            };
          })
        );
      }

      return { previousQuestions, previousSheets };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previousQuestions) {
        for (const [key, data] of ctx.previousQuestions) {
          qc.setQueryData(key, data);
        }
      }
      if (ctx?.previousSheets) {
        qc.setQueryData(["sheets"], ctx.previousSheets);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["questions"] });
      qc.invalidateQueries({ queryKey: ["sheets"] });
    },
  });
}
