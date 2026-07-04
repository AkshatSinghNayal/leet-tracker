// Client-side CSV preview parser — for the upload dialog.
// Supports TWO CSV formats (auto-detected by headers):
//   Format A (legacy):  ID, URL, Title, Difficulty
//   Format B (new):     ID, title, url, level, primary_topic

const VALID_DIFF = new Set(["Easy", "Medium", "Hard"]);

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { fields.push(current); current = ""; }
      else current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export interface ParsedPreview {
  valid: number;
  skipped: number;
  error?: string;
  sample: { leetcodeId: number; title: string; difficulty: string; primaryTopic: string }[];
  hasPrimaryTopic: boolean;
}

export function parseLeetcodeCsvClient(content: string): ParsedPreview {
  const text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { valid: 0, skipped: 0, error: "File is empty", sample: [], hasPrimaryTopic: false };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => { idx[h] = i; });

  if (!("id" in idx)) return { valid: 0, skipped: 0, error: "Missing column: ID. Required: ID, URL, Title, Difficulty (or level)", sample: [], hasPrimaryTopic: false };
  if (!("url" in idx)) return { valid: 0, skipped: 0, error: "Missing column: URL", sample: [], hasPrimaryTopic: false };
  if (!("title" in idx)) return { valid: 0, skipped: 0, error: "Missing column: Title", sample: [], hasPrimaryTopic: false };
  const diffIdx = "difficulty" in idx ? idx.difficulty : ("level" in idx ? idx.level : -1);
  if (diffIdx === -1) return { valid: 0, skipped: 0, error: "Missing column: Difficulty (or level)", sample: [], hasPrimaryTopic: false };

  const topicIdx = "primary_topic" in idx ? idx.primary_topic : ("primarytopic" in idx ? idx.primarytopic : -1);
  const hasPrimaryTopic = topicIdx !== -1;

  let valid = 0, skipped = 0;
  const sample: ParsedPreview["sample"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const idStr = (cols[idx.id] ?? "").trim();
    const url = (cols[idx.url] ?? "").trim();
    const title = (cols[idx.title] ?? "").trim();
    let difficulty = (cols[diffIdx] ?? "").trim();
    const primaryTopic = topicIdx !== -1 ? (cols[topicIdx] ?? "").trim() : "";
    const leetcodeId = parseInt(idStr, 10);
    if (!Number.isFinite(leetcodeId) || leetcodeId <= 0 || !url || !title) {
      skipped++;
      continue;
    }
    difficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
    if (!VALID_DIFF.has(difficulty)) { skipped++; continue; }
    valid++;
    if (sample.length < 3) sample.push({ leetcodeId, title, difficulty, primaryTopic: primaryTopic || "Uncategorized" });
  }
  return { valid, skipped, sample, hasPrimaryTopic };
}
