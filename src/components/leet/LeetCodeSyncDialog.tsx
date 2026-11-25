"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  FileUp,
  Info,
  Loader2,
  RefreshCw,
  Terminal,
  Unlink,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import {
  leetcodeApi,
  type LeetCodeSyncUsernameResponse,
} from "@/lib/leet/api";
import {
  LEETCODE_CONSOLE_SNIPPET,
  parseLeetcodeImportText,
} from "@/lib/leet/sync-parser";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeetCodeSyncDialog({ open, onOpenChange }: Props) {
  const { user, updateUser } = useAuth();
  const qc = useQueryClient();

  const [tab, setTab] = useState<"username" | "import">("username");
  const [usernameInput, setUsernameInput] = useState<string | null>(null);
  const username = usernameInput ?? user?.leetcode_username ?? "";
  const [lastStats, setLastStats] = useState<LeetCodeSyncUsernameResponse | null>(null);

  const [importText, setImportText] = useState("");
  const [importFilename, setImportFilename] = useState<string | undefined>(undefined);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const parsedImport = useMemo(
    () => parseLeetcodeImportText(importText, importFilename),
    [importText, importFilename]
  );

  const usernameSyncMut = useMutation({
    mutationFn: (name: string) => leetcodeApi.syncByUsername(name),
    onSuccess: (res) => {
      setLastStats(res);
      updateUser({
        leetcode_username: res.leetcode_username,
        leetcode_last_synced_at: res.leetcode_last_synced_at,
      });
      qc.invalidateQueries({ queryKey: ["sheets"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
      toast.success(
        `Synced @${res.leetcode_username}: matched ${res.matched_questions} in sheets (${res.newly_marked_in_sheets} newly marked).`
      );
    },
    onError: (e) => {
      toast.error((e as Error).message || "LeetCode sync failed");
    },
  });

  const importSyncMut = useMutation({
    mutationFn: (payload: { solvedIds: number[]; solvedSlugs: string[]; username?: string }) =>
      leetcodeApi.syncImport(payload),
    onSuccess: (res) => {
      updateUser({
        leetcode_username: res.leetcode_username ?? user?.leetcode_username ?? null,
        leetcode_last_synced_at: res.leetcode_last_synced_at,
      });
      qc.invalidateQueries({ queryKey: ["sheets"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
      toast.success(
        `Imported ${res.total_submitted_ids} solved IDs (${res.newly_added_global} new global, ${res.newly_marked_in_sheets} marked in synced sheets).`
      );
      setImportText("");
      setImportFilename(undefined);
    },
    onError: (e) => {
      toast.error((e as Error).message || "Import sync failed");
    },
  });

  const disconnectMut = useMutation({
    mutationFn: () => leetcodeApi.disconnect(),
    onSuccess: () => {
      setUsernameInput("");
      setLastStats(null);
      updateUser({ leetcode_username: null });
      toast.success("LeetCode username disconnected (your solved progress was kept).");
    },
    onError: (e) => {
      toast.error((e as Error).message || "Failed to disconnect");
    },
  });

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(LEETCODE_CONSOLE_SNIPPET);
      setCopiedSnippet(true);
      toast.success("Console snippet copied");
      setTimeout(() => setCopiedSnippet(false), 2000);
    } catch {
      toast.error("Failed to copy snippet");
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    try {
      const content = await file.text();
      setImportFilename(file.name);
      setImportText(content);
    } catch {
      toast.error("Failed to read file");
    }
  };

  const formattedLastSync = user?.leetcode_last_synced_at
    ? new Date(user.leetcode_last_synced_at).toLocaleString()
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setUsernameInput(null);
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden [&>*]:min-w-0">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 shrink-0" />
            LeetCode Global Sync
          </DialogTitle>
          <DialogDescription>
            Sync solved problems into your global progress and all synced sheets — zero LeetCode cookies required.
          </DialogDescription>
        </DialogHeader>

        {(user?.leetcode_username || formattedLastSync) && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="truncate">
                {user?.leetcode_username ? (
                  <>
                    Linked: <span className="font-medium text-foreground">@{user.leetcode_username}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">No username linked</span>
                )}
              </span>
            </div>
            {formattedLastSync && (
              <span className="text-muted-foreground shrink-0">Last synced: {formattedLastSync}</span>
            )}
          </div>
        )}

        <Tabs value={tab} onValueChange={(v) => setTab(v as "username" | "import")} className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="username" className="text-xs sm:text-sm py-1.5 whitespace-normal text-center leading-tight">
              Username (Public)
            </TabsTrigger>
            <TabsTrigger value="import" className="text-xs sm:text-sm py-1.5 whitespace-normal text-center leading-tight">
              Import CSV / JSON (Offline)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="username" className="space-y-4 pt-2 min-w-0">
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = username.trim();
                if (!trimmed) {
                  toast.error("Enter your LeetCode username");
                  return;
                }
                usernameSyncMut.mutate(trimmed);
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="lc-username">LeetCode Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="lc-username"
                    value={username}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="e.g. neetcode"
                    autoComplete="off"
                  />
                  <Button type="submit" disabled={usernameSyncMut.isPending || !username.trim()}>
                    {usernameSyncMut.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Sync Now"
                    )}
                  </Button>
                </div>
              </div>
            </form>

            {lastStats && (
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2 text-xs">
                <div className="font-medium text-foreground">
                  Public Profile Stats (@{lastStats.leetcode_username})
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded border border-border bg-background p-1.5">
                    <div className="text-muted-foreground">All</div>
                    <div className="font-semibold tabular-nums">{lastStats.stats.all}</div>
                  </div>
                  <div className="rounded border border-border bg-background p-1.5">
                    <div className="text-emerald-600 dark:text-emerald-400">Easy</div>
                    <div className="font-semibold tabular-nums">{lastStats.stats.easy}</div>
                  </div>
                  <div className="rounded border border-border bg-background p-1.5">
                    <div className="text-yellow-600 dark:text-yellow-400">Medium</div>
                    <div className="font-semibold tabular-nums">{lastStats.stats.medium}</div>
                  </div>
                  <div className="rounded border border-border bg-background p-1.5">
                    <div className="text-red-600 dark:text-red-400">Hard</div>
                    <div className="font-semibold tabular-nums">{lastStats.stats.hard}</div>
                  </div>
                </div>
                <div className="text-muted-foreground">
                  Checked {lastStats.recent_ac_count} recent accepted submissions ·{" "}
                  <span className="text-foreground font-medium">{lastStats.matched_questions}</span> matched in your sheets ·{" "}
                  <span className="text-foreground font-medium">{lastStats.newly_marked_in_sheets}</span> newly marked solved.
                </div>
              </div>
            )}

            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-foreground/70" />
              <div>
                LeetCode&apos;s public GraphQL endpoint only returns your{" "}
                <span className="text-foreground font-medium">latest 20 accepted submissions</span>{" "}
                without cookies. To import your full historical solved list, use the{" "}
                <button
                  type="button"
                  onClick={() => setTab("import")}
                  className="text-foreground underline underline-offset-2 font-medium"
                >
                  Import CSV / JSON
                </button>{" "}
                tab.
              </div>
            </div>

            {user?.leetcode_username && (
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive gap-1.5"
                  disabled={disconnectMut.isPending}
                  onClick={() => disconnectMut.mutate()}
                >
                  {disconnectMut.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Unlink className="w-3.5 h-3.5" />
                  )}
                  Disconnect Username
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="import" className="space-y-4 pt-2 min-w-0">
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium min-w-0">
                  <Terminal className="w-3.5 h-3.5 shrink-0" />
                  <span>Export full solved history from leetcode.com (read-only)</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 shrink-0"
                  onClick={handleCopySnippet}
                >
                  {copiedSnippet ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedSnippet ? "Copied" : "Copy snippet"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Open <code className="bg-muted px-1 rounded">leetcode.com</code> while signed in, open DevTools Console, paste this snippet, and upload the downloaded{" "}
                <code className="bg-muted px-1 rounded">leetcode-solved.json</code> file below.
              </p>
              <div className="w-full min-w-0 overflow-hidden rounded border border-border bg-background">
                <pre className="max-h-24 w-full overflow-auto p-2 text-[11px] font-mono text-muted-foreground">
                  {LEETCODE_CONSOLE_SNIPPET}
                </pre>
              </div>
            </div>

            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="sync-import-text" className="text-xs sm:text-sm">
                  Paste IDs, slugs, JSON, or upload CSV / JSON
                </Label>
                <label className="inline-flex items-center gap-1 text-xs font-medium cursor-pointer text-foreground hover:underline shrink-0">
                  <FileUp className="w-3.5 h-3.5" />
                  Choose file
                  <input
                    type="file"
                    accept=".json,.csv,.txt,application/json,text/csv"
                    className="sr-only"
                    onChange={(e) => handleImportFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <Textarea
                id="sync-import-text"
                rows={5}
                value={importText}
                onChange={(e) => {
                  setImportFilename(undefined);
                  setImportText(e.target.value);
                }}
                placeholder={`Examples:\n1, 139, 72\ntwo-sum, word-break\n{"solvedIds": [1, 139]}\nOr upload a CSV (supports optional Status / Solved column)`}
                className="font-mono text-xs w-full min-w-0 resize-y"
              />
            </div>

            {importText.trim().length > 0 && (
              <div
                className={`rounded-md border p-2.5 text-xs ${
                  parsedImport.error
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-border bg-muted/30 text-muted-foreground"
                }`}
              >
                {parsedImport.error ? (
                  parsedImport.error
                ) : (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>
                      Format: <span className="font-medium text-foreground uppercase">{parsedImport.detectedFormat}</span>
                    </span>
                    <span>
                      IDs: <span className="font-medium text-foreground">{parsedImport.solvedIds.length}</span>
                    </span>
                    <span>
                      Slugs: <span className="font-medium text-foreground">{parsedImport.solvedSlugs.length}</span>
                    </span>
                    {parsedImport.username && (
                      <span>
                        User: <span className="font-medium text-foreground">@{parsedImport.username}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setImportText("");
                  setImportFilename(undefined);
                }}
                disabled={!importText}
              >
                Clear
              </Button>
              <Button
                type="button"
                disabled={
                  importSyncMut.isPending ||
                  !!parsedImport.error ||
                  (parsedImport.solvedIds.length === 0 && parsedImport.solvedSlugs.length === 0)
                }
                onClick={() =>
                  importSyncMut.mutate({
                    solvedIds: parsedImport.solvedIds,
                    solvedSlugs: parsedImport.solvedSlugs,
                    username: parsedImport.username,
                  })
                }
              >
                {importSyncMut.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    Importing…
                  </>
                ) : (
                  "Import & Sync"
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
