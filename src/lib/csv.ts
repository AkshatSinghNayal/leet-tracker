// CSV parsing — server-side.
// Format (from amazon_dp_questions.csv): ID, URL, Title, Difficulty (4 columns only)

const EXPECTED_HEADERS = ["ID", "URL", "Title", "Difficulty"] as const;
const VALID_DIFFICULTIES = new Set(["Easy", "Medium", "Hard"]);

export interface ParsedQuestion {
  leetcodeId: number;
  url: string;
  title: string;
  difficulty: string;
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

export function parseLeetcodeCsv(content: string): { questions: ParsedQuestion[]; skipped: number } {
  // Strip BOM, normalize line endings
  const text = content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) {
    throw new CsvValidationError("CSV file is empty");
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  // Check for required headers (case-insensitive)
  const headerMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerMap[h.toLowerCase()] = i;
  });
  const missing = EXPECTED_HEADERS.filter((h) => !(h.toLowerCase() in headerMap));
  if (missing.length > 0) {
    throw new CsvValidationError(`Missing required columns: ${missing.join(", ")}. Expected: ${EXPECTED_HEADERS.join(", ")}`);
  }

  const idx = {
    id: headerMap["id"],
    url: headerMap["url"],
    title: headerMap["title"],
    difficulty: headerMap["difficulty"],
  };

  const questions: ParsedQuestion[] = [];
  let skipped = 0;
  for (let i = 1; i < lines.length; i++) {
    try {
      const cols = splitCsvLine(lines[i]);
      const idStr = (cols[idx.id] ?? "").trim();
      const url = (cols[idx.url] ?? "").trim();
      const title = (cols[idx.title] ?? "").trim();
      const difficulty = (cols[idx.difficulty] ?? "").trim();

      const leetcodeId = parseInt(idStr, 10);
      if (!Number.isFinite(leetcodeId) || leetcodeId <= 0) throw new Error("bad id");
      if (!url || !title) throw new Error("empty required field");
      if (!VALID_DIFFICULTIES.has(difficulty)) throw new Error("bad difficulty");

      questions.push({ leetcodeId, url, title, difficulty });
    } catch {
      skipped++;
    }
  }

  return { questions, skipped };
}
