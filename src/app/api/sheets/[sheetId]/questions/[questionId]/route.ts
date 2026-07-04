import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAccessToken, unauthorized, notFound } from "@/lib/auth-utils";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sheetId: string; questionId: string }> }) {
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

  const existing = await db.question.findFirst({ where: { id: questionId, sheetId, ownerId: user.id } });
  if (!existing) return notFound("Question not found");

  const data: { solved?: boolean; solvedAt?: Date | null } = {};
  if (typeof body.solved === "boolean") {
    data.solved = body.solved;
    data.solvedAt = body.solved ? new Date() : null;
  }

  const question = await db.question.update({
    where: { id: questionId },
    data,
  });

  return Response.json({
    question: {
      id: question.id,
      leetcode_id: question.leetcodeId,
      url: question.url,
      title: question.title,
      difficulty: question.difficulty,
      solved: question.solved,
      solved_at: question.solvedAt,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sheetId: string; questionId: string }> }) {
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
