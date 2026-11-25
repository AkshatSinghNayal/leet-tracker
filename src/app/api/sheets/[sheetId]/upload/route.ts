import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAccessToken, unauthorized, notFound } from "@/lib/auth-utils";
import { parseLeetcodeCsv, CsvValidationError } from "@/lib/csv";

export const runtime = "nodejs";

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DIFFICULTY_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };

export async function POST(req: NextRequest, { params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  const sheet = await db.sheet.findFirst({ where: { id: sheetId, ownerId: user.id } });
  if (!sheet) return notFound("Sheet not found");

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ detail: "Expected multipart/form-data" }, { status: 400 });
  }

  let file: File | null = null;
  try {
    const formData = await req.formData();
    file = formData.get("file") as File | null;
  } catch {
    return Response.json({ detail: "Failed to parse form data" }, { status: 400 });
  }
  if (!file) {
    return Response.json({ detail: "No file uploaded (field name must be 'file')" }, { status: 400 });
  }
  if (file.size > MAX_CSV_SIZE_BYTES) {
    return Response.json({ detail: "File too large (max 5 MB)" }, { status: 413 });
  }

  const content = await file.text();
  let parsed;
  try {
    parsed = parseLeetcodeCsv(content);
  } catch (e) {
    if (e instanceof CsvValidationError) {
      return Response.json({ detail: e.message }, { status: 400 });
    }
    return Response.json({ detail: "Failed to parse CSV" }, { status: 400 });
  }

  if (parsed.questions.length === 0) {
    return Response.json({ detail: "No valid rows in CSV" }, { status: 400 });
  }

  // Deduplicate questions by leetcodeId (keep first occurrence)
  const dedupedMap = new Map<number, (typeof parsed.questions)[number]>();
  for (const q of parsed.questions) {
    if (!dedupedMap.has(q.leetcodeId)) dedupedMap.set(q.leetcodeId, q);
  }
  const uniqueQuestions = Array.from(dedupedMap.values());

  // Use the GLOBAL SolvedQuestion table to determine solved state when sheet sync is enabled.
  const solvedSet = new Set<number>();
  if (sheet.syncWithGlobal) {
    const globallySolved = await db.solvedQuestion.findMany({
      where: { ownerId: user.id, leetcodeId: { in: uniqueQuestions.map((q) => q.leetcodeId) } },
      select: { leetcodeId: true },
    });
    for (const q of globallySolved) solvedSet.add(q.leetcodeId);
  }

  const now = new Date();
  // Atomic-ish replace: delete all, then insert all (transaction)
  await db.$transaction([
    db.question.deleteMany({ where: { sheetId } }),
    db.question.createMany({
      data: uniqueQuestions.map((q) => ({
        sheetId,
        ownerId: user.id,
        leetcodeId: q.leetcodeId,
        url: q.url,
        title: q.title,
        difficulty: q.difficulty,
        difficultyOrder: DIFFICULTY_ORDER[q.difficulty],
        primaryTopic: q.primaryTopic,
        solved: solvedSet.has(q.leetcodeId),
        solvedAt: solvedSet.has(q.leetcodeId) ? now : null,
      })),
    }),
    db.sheet.update({ where: { id: sheetId }, data: { updatedAt: now } }),
  ]);

  const preserved = uniqueQuestions.filter((q) => solvedSet.has(q.leetcodeId)).length;

  const updatedSheet = await db.sheet.findUnique({
    where: { id: sheetId },
    select: { id: true, name: true, syncWithGlobal: true, createdAt: true, updatedAt: true },
  });

  return Response.json({
    sheet: updatedSheet
      ? {
          id: updatedSheet.id,
          name: updatedSheet.name,
          sync_with_global: updatedSheet.syncWithGlobal,
          created_at: updatedSheet.createdAt,
          updated_at: updatedSheet.updatedAt,
        }
      : null,
    imported: uniqueQuestions.length,
    skipped: parsed.skipped + (parsed.questions.length - uniqueQuestions.length),
    preserved_solved: preserved,
  });
}
