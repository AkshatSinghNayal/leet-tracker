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

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON" }, { status: 422 });
  }
  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ detail: "Sheet name is required" }, { status: 422 });
  if (name.length > 60) return Response.json({ detail: "Sheet name must be ≤ 60 characters" }, { status: 422 });

  const dup = await db.sheet.findFirst({ where: { ownerId: user.id, name, NOT: { id: sheetId } } });
  if (dup) return Response.json({ detail: "Sheet with that name already exists" }, { status: 409 });

  const updated = await db.sheet.update({
    where: { id: sheetId },
    data: { name },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return Response.json({
    sheet: {
      id: updated.id,
      name: updated.name,
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
