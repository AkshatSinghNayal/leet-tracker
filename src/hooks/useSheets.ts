"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sheetsApi } from "@/lib/leet/api";

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["questions"] });
      qc.invalidateQueries({ queryKey: ["sheets"] });
    },
  });
}
