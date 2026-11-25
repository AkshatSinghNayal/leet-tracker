import { NextRequest } from "next/server";
import { db, ensureSchemaReady } from "@/lib/db";
import { getUserFromAccessToken, unauthorized, notFound } from "@/lib/auth-utils";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sheetId: string; questionId: string }> }) {
  await ensureSchemaReady();
  const { sheetId, questionId } = await params;
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  const sheet = await db.sheet.findFirst({ where: { id: sheetId, ownerId: user.id } });
  if (!sheet) return notFound("Sheet not found");

  let body: { solved?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  const target = await db.question.findFirst({ where: { id: questionId, sheetId, ownerId: user.id } });
  if (!target) return notFound("Question not found");

  let propagated = false;
  if (typeof body.solved === "boolean") {
    const now = new Date();
    if (sheet.syncWithGlobal) {
      propagated = true;
      if (body.solved) {
        // 1. Upsert into global SolvedQuestion
        await db.solvedQuestion.upsert({
          where: { ownerId_leetcodeId: { ownerId: user.id, leetcodeId: target.leetcodeId } },
          update: { solvedAt: now },
          create: { ownerId: user.id, leetcodeId: target.leetcodeId, solvedAt: now },
        });
        // 2. Propagate ONLY to Question rows in synced sheets for this user
        await db.question.updateMany({
          where: {
            ownerId: user.id,
            leetcodeId: target.leetcodeId,
            sheet: { syncWithGlobal: true },
          },
          data: { solved: true, solvedAt: now },
        });
      } else {
        // 1. Delete from global SolvedQuestion
        await db.solvedQuestion.deleteMany({
          where: { ownerId: user.id, leetcodeId: target.leetcodeId },
        });
        // 2. Propagate ONLY to Question rows in synced sheets
        await db.question.updateMany({
          where: {
            ownerId: user.id,
            leetcodeId: target.leetcodeId,
            sheet: { syncWithGlobal: true },
          },
          data: { solved: false, solvedAt: null },
        });
      }
    } else {
      // Sheet is desynced (Revision Mode): update ONLY this sheet's Question row
      await db.question.update({
        where: { id: questionId },
        data: { solved: body.solved, solvedAt: body.solved ? now : null },
      });
    }
  }

  // Re-fetch the target question (with updated solved state)
  const question = await db.question.findUnique({ where: { id: questionId } });
  if (!question) return notFound("Question not found");

  return Response.json({
    question: {
      id: question.id,
      leetcode_id: question.leetcodeId,
      url: question.url,
      title: question.title,
      difficulty: question.difficulty,
      primary_topic: question.primaryTopic,
      solved: question.solved,
      solved_at: question.solvedAt,
    },
    // Hint to the client whether other synced sheets were updated
    propagated,
    leetcode_id: question.leetcodeId,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sheetId: string; questionId: string }> }) {
  await ensureSchemaReady();
  const { sheetId, questionId } = await params;
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  const sheet = await db.sheet.findFirst({ where: { id: sheetId, ownerId: user.id } });
  if (!sheet) return notFound("Sheet not found");

  const existing = await db.question.findFirst({ where: { id: questionId, sheetId, ownerId: user.id } });
  if (!existing) return notFound("Question not found");

  await db.question.delete({ where: { id: questionId } });
  return Response.json({ ok: true });
}
