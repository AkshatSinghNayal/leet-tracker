// Client-side CSV preview parser — for the upload dialog.
// Same format as the server: ID, URL, Title, Difficulty (4 columns only).

const EXPECTED = ["id", "url", "title", "difficulty"];
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
  sample: { leetcodeId: number; title: string; difficulty: string }[];
}

export function parseLeetcodeCsvClient(content: string): ParsedPreview {
  const text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { valid: 0, skipped: 0, error: "File is empty", sample: [] };

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  headers.forEach((h, i) => { idx[h] = i; });
  const missing = EXPECTED.filter((h) => !(h in idx));
  if (missing.length > 0) {
    return { valid: 0, skipped: 0, error: `Missing columns: ${missing.join(", ")}. Required: ID, URL, Title, Difficulty`, sample: [] };
  }

  let valid = 0, skipped = 0;
  const sample: ParsedPreview["sample"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const idStr = (cols[idx.id] ?? "").trim();
    const url = (cols[idx.url] ?? "").trim();
    const title = (cols[idx.title] ?? "").trim();
    const difficulty = (cols[idx.difficulty] ?? "").trim();
    const leetcodeId = parseInt(idStr, 10);
    if (!Number.isFinite(leetcodeId) || leetcodeId <= 0 || !url || !title || !VALID_DIFF.has(difficulty)) {
      skipped++;
      continue;
    }
    valid++;
    if (sample.length < 3) sample.push({ leetcodeId, title, difficulty });
  }
  return { valid, skipped, sample };
}
