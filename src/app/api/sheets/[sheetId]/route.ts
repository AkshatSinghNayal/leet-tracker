import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAccessToken, unauthorized, notFound } from "@/lib/auth-utils";

export const runtime = "nodejs";

async function getOwnedSheet(req: NextRequest, sheetId: string) {
  const user = await getUserFromAccessToken(req);
  if (!user) return { user: null, sheet: null, error: unauthorized() };
  const sheet = await db.sheet.findFirst({ where: { id: sheetId, ownerId: user.id } });
  if (!sheet) return { user, sheet: null, error: notFound("Sheet not found") };
  return { user, sheet, error: null };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const { user, sheet, error } = await getOwnedSheet(req, sheetId);
  if (error) return error;
  if (!user || !sheet) return notFound();

  const total = await db.question.count({ where: { sheetId } });
  const solved = await db.question.count({ where: { sheetId, solved: true } });
  const byDiff = await db.question.groupBy({
    by: ["difficulty"],
    where: { sheetId },
    _count: { _all: true },
  });
  const byDiffSolved = await db.question.groupBy({
    by: ["difficulty"],
    where: { sheetId, solved: true },
    _count: { _all: true },
  });
  const diffMap: Record<string, { total: number; solved: number }> = {
    Easy: { total: 0, solved: 0 },
    Medium: { total: 0, solved: 0 },
    Hard: { total: 0, solved: 0 },
  };
  for (const d of byDiff) diffMap[d.difficulty].total = d._count._all;
  for (const d of byDiffSolved) diffMap[d.difficulty].solved = d._count._all;

  return Response.json({
    sheet: {
      id: sheet.id,
      name: sheet.name,
      sync_with_global: sheet.syncWithGlobal,
      created_at: sheet.createdAt,
      updated_at: sheet.updatedAt,
    },
    stats: { total, solved, by_difficulty: diffMap },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const { user, sheet, error } = await getOwnedSheet(req, sheetId);
  if (error) return error;
  if (!user || !sheet) return notFound();

  let body: { name?: string; sync_with_global?: boolean; reset_revision?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  const hasName = typeof body.name === "string";
  const hasSyncToggle = typeof body.sync_with_global === "boolean";
  const hasReset = body.reset_revision === true;

  if (!hasName && !hasSyncToggle && !hasReset) {
    return Response.json({ detail: "No valid update fields provided" }, { status: 422 });
  }

  const updateData: { name?: string; syncWithGlobal?: boolean } = {};

  if (hasName) {
    const name = (body.name ?? "").trim();
    if (!name) return Response.json({ detail: "Sheet name is required" }, { status: 422 });
    if (name.length > 60) return Response.json({ detail: "Sheet name must be ≤ 60 characters" }, { status: 422 });

    const dup = await db.sheet.findFirst({ where: { ownerId: user.id, name, NOT: { id: sheetId } } });
    if (dup) return Response.json({ detail: "Sheet with that name already exists" }, { status: 409 });
    updateData.name = name;
  }

  if (hasSyncToggle) {
    updateData.syncWithGlobal = body.sync_with_global;
  }

  const effectiveSyncState = hasSyncToggle ? body.sync_with_global! : sheet.syncWithGlobal;
  if (hasReset && effectiveSyncState) {
    return Response.json({ detail: "Reset revision is only available in Revision Mode (desynced sheet)" }, { status: 400 });
  }

  if (hasSyncToggle && body.sync_with_global === false) {
    // Desync (Revision Mode): turn off global sync and reset ONLY this sheet's solved state
    await db.$transaction([
      db.sheet.update({
        where: { id: sheetId },
        data: updateData,
      }),
      db.question.updateMany({
        where: { sheetId, ownerId: user.id },
        data: { solved: false, solvedAt: null },
      }),
    ]);
  } else if (hasSyncToggle && body.sync_with_global === true) {
    // Re-sync with Global: turn on global sync and restore solved state from SolvedQuestion
    const sheetQuestions = await db.question.findMany({
      where: { sheetId, ownerId: user.id },
      select: { leetcodeId: true },
    });
    const leetcodeIds = sheetQuestions.map((q) => q.leetcodeId);
    const globallySolved = leetcodeIds.length > 0
      ? await db.solvedQuestion.findMany({
          where: { ownerId: user.id, leetcodeId: { in: leetcodeIds } },
          select: { leetcodeId: true },
        })
      : [];
    const solvedIds = globallySolved.map((q) => q.leetcodeId);
    const now = new Date();

    await db.$transaction([
      db.sheet.update({
        where: { id: sheetId },
        data: updateData,
      }),
      ...(solvedIds.length > 0
        ? [
            db.question.updateMany({
              where: { sheetId, ownerId: user.id, leetcodeId: { in: solvedIds } },
              data: { solved: true, solvedAt: now },
            }),
            db.question.updateMany({
              where: { sheetId, ownerId: user.id, leetcodeId: { notIn: solvedIds } },
              data: { solved: false, solvedAt: null },
            }),
          ]
        : [
            db.question.updateMany({
              where: { sheetId, ownerId: user.id },
              data: { solved: false, solvedAt: null },
            }),
          ]),
    ]);
  } else if (hasReset) {
    // Reset local revision progress within desynced sheet
    await db.$transaction([
      ...(Object.keys(updateData).length > 0
        ? [db.sheet.update({ where: { id: sheetId }, data: updateData })]
        : [db.sheet.update({ where: { id: sheetId }, data: { updatedAt: new Date() } })]),
      db.question.updateMany({
        where: { sheetId, ownerId: user.id },
        data: { solved: false, solvedAt: null },
      }),
    ]);
  } else {
    await db.sheet.update({
      where: { id: sheetId },
      data: updateData,
    });
  }

  const updated = await db.sheet.findUnique({
    where: { id: sheetId },
    select: {
      id: true,
      name: true,
      syncWithGlobal: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { questions: true } },
    },
  });
  if (!updated) return notFound("Sheet not found");

  const solvedCount = await db.question.count({ where: { sheetId, ownerId: user.id, solved: true } });

  return Response.json({
    sheet: {
      id: updated.id,
      name: updated.name,
      sync_with_global: updated.syncWithGlobal,
      question_count: updated._count.questions,
      solved_count: solvedCount,
      created_at: updated.createdAt,
      updated_at: updated.updatedAt,
    },
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const { error } = await getOwnedSheet(req, sheetId);
  if (error) return error;

  // Cascade delete will remove questions via Prisma relation
  await db.sheet.delete({ where: { id: sheetId } });
  return Response.json({ ok: true });
}
