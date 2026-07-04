"use client";

import { useState } from "react";
import { Plus, Upload, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useSheets, useCreateSheet, useRenameSheet, useDeleteSheet, useUploadCsv } from "@/hooks/useSheets";
import type { Sheet } from "@/lib/leet/types";
import { parseLeetcodeCsvClient } from "@/lib/leet/csv-client";

interface Props {
  activeSheetId: string | null;
  onSelect: (id: string) => void;
}

export function SheetTabs({ activeSheetId, onSelect }: Props) {
  const { data: sheets = [], isLoading } = useSheets();
  const [uploadOpen, setUploadOpen] = useState(false);

  if (isLoading) {
    return <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="px-4 sm:px-6 py-3 border-b border-border overflow-x-auto">
      <div className="flex items-center gap-1.5 min-w-max">
        {sheets.map((s) => (
          <SheetTab
            key={s.id}
            sheet={s}
            active={s.id === activeSheetId}
            onSelect={() => onSelect(s.id)}
          />
        ))}
        <UploadSheetButton open={uploadOpen} onOpenChange={setUploadOpen} />
      </div>
    </div>
  );
}

function SheetTab({ sheet, active, onSelect }: { sheet: Sheet; active: boolean; onSelect: () => void }) {
  const renameMut = useRenameSheet();
  const deleteMut = useDeleteSheet();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(sheet.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submitRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === sheet.name) { setRenaming(false); return; }
    try {
      await renameMut.mutateAsync({ id: sheet.id, name: trimmed });
      setRenaming(false);
      toast.success("Sheet renamed");
    } catch (e) {
      toast.error((e as Error).message || "Rename failed");
    }
  };

  return (
    <div
      className={`group inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors cursor-pointer ${
        active
          ? "border-foreground/30 bg-foreground/5 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
      }`}
      onClick={() => !renaming && onSelect()}
    >
      {renaming ? (
        <>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submitRename(); if (e.key === "Escape") setRenaming(false); }}
            className="h-6 w-24 px-1 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
          <button onClick={(e) => { e.stopPropagation(); submitRename(); }} className="text-foreground hover:text-foreground/80" aria-label="Confirm rename">
            <Check className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setRenaming(false); setName(sheet.name); }} className="text-muted-foreground hover:text-foreground" aria-label="Cancel rename">
            <X className="w-3.5 h-3.5" />
          </button>
        </>
      ) : (
        <>
          <span className="font-medium">{sheet.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {sheet.solved_count}/{sheet.question_count}
          </span>
          <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
            <button
              onClick={(e) => { e.stopPropagation(); setRenaming(true); setName(sheet.name); }}
              className="text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Rename sheet"
              title="Rename"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              className="text-muted-foreground hover:text-destructive p-0.5"
              aria-label="Delete sheet"
              title="Delete"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </span>
        </>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sheet &quot;{sheet.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the sheet and all {sheet.question_count} questions in it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await deleteMut.mutateAsync(sheet.id);
                  toast.success("Sheet deleted");
                  setConfirmDelete(false);
                } catch (e) {
                  toast.error((e as Error).message || "Delete failed");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UploadSheetButton({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [step, setStep] = useState<"pick" | "configure">("pick");
  const [file, setFile] = useState<File | null>(null);
  const [alias, setAlias] = useState("");
  const [mode, setMode] = useState<"create" | "replace">("create");
  const [targetSheetId, setTargetSheetId] = useState<string>("");
  const uploadMut = useUploadCsv();
  const { data: sheets = [] } = useSheets();
  const createMut = useCreateSheet();

  const reset = () => {
    setStep("pick");
    setFile(null);
    setAlias("");
    setMode("create");
    setTargetSheetId("");
  };

  const handlePick = (f: File | null) => {
    if (!f) return;
    setFile(f);
    // Derive alias from filename (without extension)
    const base = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    setAlias(base || "New Sheet");
    setStep("configure");
  };

  const handleConfirm = async () => {
    if (!file) return;
    try {
      if (mode === "create") {
        const trimmed = alias.trim();
        if (!trimmed) { toast.error("Sheet name required"); return; }
        // Validate CSV format client-side first
        const text = await file.text();
        const preview = parseLeetcodeCsvClient(text);
        if (preview.error) { toast.error(preview.error); return; }
        if (preview.valid === 0) { toast.error("No valid rows in CSV"); return; }
        // Create sheet first
        const created = await createMut.mutateAsync(trimmed);
        // Then upload
        const result = await uploadMut.mutateAsync({ sheetId: created.id, file });
        toast.success(`Imported ${result.imported} questions (skipped: ${result.skipped})`);
      } else {
        if (!targetSheetId) { toast.error("Select a sheet to replace"); return; }
        const result = await uploadMut.mutateAsync({ sheetId: targetSheetId, file });
        toast.success(`Replaced with ${result.imported} questions. Preserved ${result.preserved_solved} solved.`);
      }
      onOpenChange(false);
      reset();
    } catch (e) {
      toast.error((e as Error).message || "Upload failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload CSV</DialogTitle>
          <DialogDescription>
            CSV must have these headers: <code className="text-xs bg-muted px-1 py-0.5 rounded">ID, URL, Title, Difficulty</code>
          </DialogDescription>
        </DialogHeader>

        {step === "pick" ? (
          <div className="space-y-3">
            <label
              htmlFor="csv-input"
              className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-md py-10 px-4 cursor-pointer hover:border-foreground/30 transition-colors"
            >
              <Upload className="w-6 h-6 text-muted-foreground" />
              <div className="text-sm font-medium">Click to choose a CSV file</div>
              <div className="text-xs text-muted-foreground">Max 5 MB</div>
              <input
                id="csv-input"
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground truncate">
              File: <span className="text-foreground font-medium">{file?.name}</span>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Mode</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("create")}
                  className={`text-left p-3 rounded-md border text-sm transition-colors ${
                    mode === "create" ? "border-foreground/40 bg-foreground/5" : "border-border hover:border-foreground/20"
                  }`}
                >
                  <div className="font-medium">Create new sheet</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Upload as a new named sheet</div>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={`text-left p-3 rounded-md border text-sm transition-colors ${
                    mode === "replace" ? "border-foreground/40 bg-foreground/5" : "border-border hover:border-foreground/20"
                  }`}
                >
                  <div className="font-medium">Replace existing</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Keeps solved state for matching IDs</div>
                </button>
              </div>
            </div>

            {mode === "create" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="alias-input">Sheet name</label>
                <Input id="alias-input" value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={60} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="target-sheet">Sheet to replace</label>
                <select
                  id="target-sheet"
                  value={targetSheetId}
                  onChange={(e) => setTargetSheetId(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select a sheet…</option>
                  {sheets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.question_count} questions)</option>
                  ))}
                </select>
                {targetSheetId && (
                  <p className="text-xs text-muted-foreground">
                    Existing solved questions matching the CSV&apos;s IDs will keep their solved state.
                  </p>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("pick")}>Back</Button>
              <Button onClick={handleConfirm} disabled={uploadMut.isPending || createMut.isPending}>
                {(uploadMut.isPending || createMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                {mode === "create" ? "Create & Upload" : "Replace"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
