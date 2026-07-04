// CSV parsing — server-side.
// Supports TWO CSV formats (auto-detected by headers):
//
//   Format A (legacy):  ID, URL, Title, Difficulty
//   Format B (new):     ID, title, url, level, primary_topic
//
// Both formats populate the same Question shape. Format B also fills `primaryTopic`.

const VALID_DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);

export interface ParsedQuestion {
  leetcodeId: number;
  url: string;
  title: string;
  difficulty: string;     // "Easy" | "Medium" | "Hard"
  primaryTopic: string;   // empty string if not provided
}

export class CsvValidationError extends Error {}

// Robust CSV line splitter — handles quoted fields with commas, doubled quotes, etc.
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
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

interface ColumnIndices {
  id: number;
  url: number;
  title: number;
  difficulty: number;       // maps "Difficulty" or "level"
  primaryTopic: number | null;
}

function detectColumns(headers: string[]): ColumnIndices | { error: string } {
  const lower = headers.map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  lower.forEach((h, i) => { idx[h] = i; });

  // ID required (case-insensitive)
  if (!("id" in idx)) {
    return { error: "Missing required column: ID" };
  }
  if (!("url" in idx)) {
    return { error: "Missing required column: URL (or url)" };
  }
  if (!("title" in idx)) {
    return { error: "Missing required column: Title (or title)" };
  }
  // Difficulty OR level — at least one is required
  const diffIdx = "difficulty" in idx ? idx.difficulty : ("level" in idx ? idx.level : -1);
  if (diffIdx === -1) {
    return { error: "Missing required column: Difficulty (or level)" };
  }

  return {
    id: idx.id,
    url: idx.url,
    title: idx.title,
    difficulty: diffIdx,
    primaryTopic: "primary_topic" in idx ? idx.primary_topic : ("primarytopic" in idx ? idx.primarytopic : null),
  };
}

export function parseLeetcodeCsv(content: string): { questions: ParsedQuestion[]; skipped: number } {
  // Strip BOM, normalize line endings
  const text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new CsvValidationError("CSV file is empty");
  }

  const headers = splitCsvLine(lines[0]);
  const cols = detectColumns(headers);
  if ("error" in cols) {
    throw new CsvValidationError(
      `${cols.error}. Supported formats:\n` +
      `  Format A: ID, URL, Title, Difficulty\n` +
      `  Format B: ID, title, url, level, primary_topic`
    );
  }

  const questions: ParsedQuestion[] = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    try {
      const c = splitCsvLine(lines[i]);
      const idStr = (c[cols.id] ?? "").trim();
      const url = (c[cols.url] ?? "").trim();
      const title = (c[cols.title] ?? "").trim();
      let difficulty = (c[cols.difficulty] ?? "").trim();
      const primaryTopic = cols.primaryTopic !== null ? (c[cols.primaryTopic] ?? "").trim() : "";

      const leetcodeId = parseInt(idStr, 10);
      if (!Number.isFinite(leetcodeId) || leetcodeId <= 0) throw new Error("bad id");
      if (!url || !title) throw new Error("empty required field");

      // Normalize difficulty: accept "Easy/Medium/Hard" or "easy/medium/hard" → title-case
      difficulty = difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase();
      if (!VALID_DIFFICULTIES.has(difficulty)) throw new Error("bad difficulty");

      questions.push({ leetcodeId, url, title, difficulty, primaryTopic: primaryTopic || "Uncategorized" });
    } catch {
      skipped++;
    }
  }

  return { questions, skipped };
}
