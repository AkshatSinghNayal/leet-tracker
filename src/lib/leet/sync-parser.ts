// Client-side parser for LeetCode Sync import mode (.json, .csv, or pasted IDs/slugs/URLs)

export const LEETCODE_CONSOLE_SNIPPET = `(async () => {
  const res = await fetch("/api/problems/all/", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch problems (make sure you are logged into leetcode.com)");
  const data = await res.json();
  const solved = (data.stat_status_pairs || []).filter((p) => p.status === "ac");
  const payload = {
    username: data.user_name || undefined,
    solvedIds: solved.map((p) => p.stat?.frontend_question_id).filter(Boolean),
    solvedSlugs: solved.map((p) => p.stat?.question__title_slug).filter(Boolean),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leetcode-solved.json";
  a.click();
})();`;

export interface ParsedSyncImport {
  solvedIds: number[];
  solvedSlugs: string[];
  username?: string;
  detectedFormat: "json" | "csv" | "text";
  error?: string;
}

const SOLVED_STATUS_VALUES = new Set([
  "ac",
  "accepted",
  "solved",
  "done",
  "yes",
  "true",
  "1",
  "✓",
  "checked",
]);

function extractSlugFromUrlOrToken(raw: string): string | null {
  const urlMatch = raw.match(/leetcode\.com\/problems\/([^/?#]+)/i);
  if (urlMatch) return urlMatch[1].toLowerCase();
  return null;
}

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        fields.push(current);
        current = "";
      } else current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function isStatusSolved(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    return SOLVED_STATUS_VALUES.has(val.trim().toLowerCase());
  }
  return false;
}

function collectFromItem(
  item: unknown,
  ids: Set<number>,
  slugs: Set<string>
): void {
  if (typeof item === "number") {
    if (Number.isInteger(item) && item > 0) ids.add(item);
    return;
  }
  if (typeof item === "string") {
    const trimmed = item.trim();
    if (!trimmed) return;
    if (/^\d+$/.test(trimmed)) {
      const n = parseInt(trimmed, 10);
      if (n > 0) ids.add(n);
      return;
    }
    const urlSlug = extractSlugFromUrlOrToken(trimmed);
    slugs.add((urlSlug ?? trimmed).toLowerCase());
    return;
  }
  if (!item || typeof item !== "object") return;

  const obj = item as Record<string, unknown>;
  // Handle LeetCode stat_status_pairs entry: { status: "ac", stat: { frontend_question_id, question__title_slug } }
  if ("stat" in obj && obj.stat && typeof obj.stat === "object") {
    if ("status" in obj && obj.status !== "ac" && !isStatusSolved(obj.status)) {
      return;
    }
    const stat = obj.stat as Record<string, unknown>;
    const fid = Number(stat.frontend_question_id ?? stat.question_id);
    if (Number.isInteger(fid) && fid > 0) ids.add(fid);
    const slug = stat.question__title_slug;
    if (typeof slug === "string" && slug.trim()) slugs.add(slug.trim().toLowerCase());
    return;
  }

  // If status/solved field is explicitly present, require it to be solved
  if ("status" in obj && obj.status !== undefined && obj.status !== null && obj.status !== "") {
    if (!isStatusSolved(obj.status)) return;
  } else if ("solved" in obj && obj.solved !== undefined && obj.solved !== null && obj.solved !== "") {
    if (!isStatusSolved(obj.solved)) return;
  }

  const rawId =
    obj.leetcode_id ??
    obj.leetcodeId ??
    obj.frontend_question_id ??
    obj.questionFrontendId ??
    obj.frontendQuestionId ??
    obj.id;
  const numId = Number(rawId);
  if (Number.isInteger(numId) && numId > 0) ids.add(numId);

  const rawSlug = obj.titleSlug ?? obj.title_slug ?? obj.slug;
  if (typeof rawSlug === "string" && rawSlug.trim()) {
    slugs.add(rawSlug.trim().toLowerCase());
  }

  const rawUrl = obj.url ?? obj.link;
  if (typeof rawUrl === "string" && rawUrl.trim()) {
    const extracted = extractSlugFromUrlOrToken(rawUrl.trim());
    if (extracted) slugs.add(extracted);
  }
}

function parseJsonImport(trimmed: string): ParsedSyncImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      solvedIds: [],
      solvedSlugs: [],
      detectedFormat: "json",
      error: "Invalid JSON syntax",
    };
  }

  const ids = new Set<number>();
  const slugs = new Set<string>();
  let username: string | undefined;

  if (Array.isArray(parsed)) {
    for (const item of parsed) collectFromItem(item, ids, slugs);
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const rawUsername = obj.username ?? obj.user_name;
    if (typeof rawUsername === "string" && rawUsername.trim()) {
      username = rawUsername.trim();
    }

    if (Array.isArray(obj.solvedIds)) {
      for (const item of obj.solvedIds) collectFromItem(item, ids, slugs);
    }
    if (Array.isArray(obj.solvedSlugs)) {
      for (const item of obj.solvedSlugs) collectFromItem(item, ids, slugs);
    }
    if (Array.isArray(obj.stat_status_pairs)) {
      for (const item of obj.stat_status_pairs) collectFromItem(item, ids, slugs);
    }
    if (Array.isArray(obj.questions)) {
      for (const item of obj.questions) collectFromItem(item, ids, slugs);
    }
    if (Array.isArray(obj.recentAcSubmissionList)) {
      for (const item of obj.recentAcSubmissionList) collectFromItem(item, ids, slugs);
    }
  } else {
    return {
      solvedIds: [],
      solvedSlugs: [],
      detectedFormat: "json",
      error: "JSON must be an array or object",
    };
  }

  return {
    solvedIds: Array.from(ids),
    solvedSlugs: Array.from(slugs),
    username,
    detectedFormat: "json",
    error:
      ids.size === 0 && slugs.size === 0
        ? "No solved question IDs or slugs found in JSON"
        : undefined,
  };
}

function looksLikeCsv(text: string, filename?: string): boolean {
  if (filename?.toLowerCase().endsWith(".csv")) return true;
  const firstLine = text.split(/\r?\n/)[0]?.toLowerCase() ?? "";
  if (!firstLine.includes(",")) return false;
  const headers = splitCsvLine(firstLine).map((h) => h.trim());
  return headers.some((h) =>
    ["id", "leetcode_id", "frontend_question_id", "question_id", "url", "slug", "titleslug", "title_slug", "status", "solved"].includes(h)
  );
}

function parseCsvImport(text: string): ParsedSyncImport {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);

  if (lines.length === 0) {
    return { solvedIds: [], solvedSlugs: [], detectedFormat: "csv", error: "CSV is empty" };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => {
    idx[h] = i;
  });

  const idIdx =
    idx.id ??
    idx.leetcode_id ??
    idx.frontend_question_id ??
    idx.question_id ??
    idx["#"] ??
    -1;
  const slugIdx = idx.titleslug ?? idx.title_slug ?? idx.slug ?? -1;
  const urlIdx = idx.url ?? idx.link ?? -1;
  const statusIdx = idx.status ?? idx.solved ?? idx.state ?? idx.ac ?? -1;

  if (idIdx === -1 && slugIdx === -1 && urlIdx === -1) {
    return {
      solvedIds: [],
      solvedSlugs: [],
      detectedFormat: "csv",
      error: "CSV needs at least an ID, URL, or slug column",
    };
  }

  const ids = new Set<number>();
  const slugs = new Set<string>();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (statusIdx !== -1) {
      const rawStatus = (cols[statusIdx] ?? "").trim();
      if (!isStatusSolved(rawStatus)) continue;
    }

    if (idIdx !== -1) {
      const n = parseInt((cols[idIdx] ?? "").trim(), 10);
      if (Number.isInteger(n) && n > 0) ids.add(n);
    }
    if (slugIdx !== -1) {
      const s = (cols[slugIdx] ?? "").trim().toLowerCase();
      if (s) slugs.add(s);
    }
    if (urlIdx !== -1) {
      const u = (cols[urlIdx] ?? "").trim();
      if (u) {
        const extracted = extractSlugFromUrlOrToken(u);
        if (extracted) slugs.add(extracted);
      }
    }
  }

  return {
    solvedIds: Array.from(ids),
    solvedSlugs: Array.from(slugs),
    detectedFormat: "csv",
    error:
      ids.size === 0 && slugs.size === 0
        ? statusIdx !== -1
          ? "No rows with a solved/AC status found in CSV"
          : "No valid IDs or slugs found in CSV"
        : undefined,
  };
}

export function parseLeetcodeImportText(rawText: string, filename?: string): ParsedSyncImport {
  const cleaned = rawText.replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    return { solvedIds: [], solvedSlugs: [], detectedFormat: "text" };
  }

  if (
    filename?.toLowerCase().endsWith(".json") ||
    cleaned.startsWith("{") ||
    cleaned.startsWith("[")
  ) {
    return parseJsonImport(cleaned);
  }

  if (looksLikeCsv(cleaned, filename)) {
    return parseCsvImport(cleaned);
  }

  // Plain text: comma / whitespace / newline-separated IDs, slugs, or URLs
  const ids = new Set<number>();
  const slugs = new Set<string>();
  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);

  for (const token of tokens) {
    const cleanToken = token.replace(/^#/, "").trim();
    if (/^\d+$/.test(cleanToken)) {
      const n = parseInt(cleanToken, 10);
      if (n > 0) ids.add(n);
      continue;
    }
    const urlSlug = extractSlugFromUrlOrToken(cleanToken);
    if (urlSlug) {
      slugs.add(urlSlug);
      continue;
    }
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(cleanToken)) {
      slugs.add(cleanToken.toLowerCase());
    }
  }

  return {
    solvedIds: Array.from(ids),
    solvedSlugs: Array.from(slugs),
    detectedFormat: "text",
    error:
      ids.size === 0 && slugs.size === 0
        ? "Could not find any LeetCode IDs, slugs, or URLs"
        : undefined,
  };
}
