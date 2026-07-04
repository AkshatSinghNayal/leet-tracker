import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAccessToken, unauthorized } from "@/lib/auth-utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  const sheets = await db.sheet.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { questions: true } },
    },
  });

  // For solved counts, do a grouped query
  const solvedCounts = await db.question.groupBy({
    by: ["sheetId"],
    where: { ownerId: user.id, solved: true },
    _count: { _all: true },
  });
  const solvedMap = new Map(solvedCounts.map((s) => [s.sheetId, s._count._all]));

  return Response.json({
    sheets: sheets.map((s) => ({
      id: s.id,
      name: s.name,
      question_count: s._count.questions,
      solved_count: solvedMap.get(s.id) ?? 0,
      created_at: s.createdAt,
      updated_at: s.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  const name = (body.name ?? "").trim();
  if (!name) return Response.json({ detail: "Sheet name is required" }, { status: 422 });
  if (name.length > 60) return Response.json({ detail: "Sheet name must be ≤ 60 characters" }, { status: 422 });

  const existing = await db.sheet.findFirst({ where: { ownerId: user.id, name } });
  if (existing) return Response.json({ detail: "Sheet with that name already exists" }, { status: 409 });

  const sheet = await db.sheet.create({
    data: { ownerId: user.id, name },
    select: { id: true, name: true, createdAt: true, updatedAt: true },
  });

  return Response.json({
    sheet: {
      id: sheet.id,
      name: sheet.name,
      question_count: 0,
      solved_count: 0,
      created_at: sheet.createdAt,
      updated_at: sheet.updatedAt,
    },
  }, { status: 201 });
}
