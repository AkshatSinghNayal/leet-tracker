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

  // Use the GLOBAL SolvedQuestion table to determine solved state.
  // This means: if a user has solved leetcode_id=139 in ANY sheet, uploading
  // a new CSV containing leetcode_id=139 will mark it as solved in this sheet too.
  const globallySolved = await db.solvedQuestion.findMany({
    where: { ownerId: user.id, leetcodeId: { in: parsed.questions.map((q) => q.leetcodeId) } },
    select: { leetcodeId: true },
  });
  const solvedSet = new Set(globallySolved.map((q) => q.leetcodeId));

  // Atomic-ish replace: delete all, then insert all (transaction)
  await db.$transaction([
    db.question.deleteMany({ where: { sheetId } }),
    db.question.createMany({
      data: parsed.questions.map((q) => ({
        sheetId,
        ownerId: user.id,
        leetcodeId: q.leetcodeId,
        url: q.url,
        title: q.title,
        difficulty: q.difficulty,
        difficultyOrder: DIFFICULTY_ORDER[q.difficulty],
        primaryTopic: q.primaryTopic,
        solved: solvedSet.has(q.leetcodeId),
        solvedAt: solvedSet.has(q.leetcodeId) ? new Date() : null,
      })),
    }),
    db.sheet.update({ where: { id: sheetId }, data: { updatedAt: new Date() } }),
  ]);

  const preserved = parsed.questions.filter((q) => solvedSet.has(q.leetcodeId)).length;

  const updatedSheet = await db.sheet.findUnique({
    where: { id: sheetId },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return Response.json({
    sheet: updatedSheet,
    imported: parsed.questions.length,
    skipped: parsed.skipped,
    preserved_solved: preserved,
  });
}
