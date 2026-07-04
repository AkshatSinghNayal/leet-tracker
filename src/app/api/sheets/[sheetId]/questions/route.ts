import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAccessToken, unauthorized, notFound } from "@/lib/auth-utils";

export const runtime = "nodejs";

const DIFFICULTY_ORDER: Record<string, number> = { Easy: 0, Medium: 1, Hard: 2 };

interface QueryParams {
  search?: string;
  difficulty?: string[];
  solved?: "all" | "solved" | "unsolved";
  sort_by: "id" | "title" | "difficulty";
  sort_dir: "asc" | "desc";
  page: number;
  page_size: number;
}

function parseQuery(url: URL): QueryParams {
  const sp = url.searchParams;
  const search = sp.get("search")?.trim() || undefined;
  const diff = sp.get("difficulty");
  const difficulty = diff
    ? diff.split(",").map((d) => d.trim()).filter(Boolean)
    : undefined;
  const solvedRaw = sp.get("solved") || "all";
  const solved: QueryParams["solved"] =
    solvedRaw === "solved" || solvedRaw === "unsolved" ? solvedRaw : "all";
  const sortByRaw = sp.get("sort_by") || "id";
  const sort_by: QueryParams["sort_by"] =
    sortByRaw === "title" || sortByRaw === "difficulty" ? sortByRaw : "id";
  const sortDirRaw = sp.get("sort_dir") || "asc";
  const sort_dir: QueryParams["sort_dir"] = sortDirRaw === "desc" ? "desc" : "asc";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSizeRaw = parseInt(sp.get("page_size") || "50", 10) || 50;
  const page_size = [25, 50, 100].includes(pageSizeRaw) ? pageSizeRaw : 50;

  return { search, difficulty, solved, sort_by, sort_dir, page, page_size };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  const sheet = await db.sheet.findFirst({ where: { id: sheetId, ownerId: user.id } });
  if (!sheet) return notFound("Sheet not found");

  const q = parseQuery(new URL(req.url));

  const where: Record<string, unknown> = { sheetId, ownerId: user.id };
  if (q.search) {
    where.title = { contains: q.search };
  }
  if (q.difficulty && q.difficulty.length > 0) {
    where.difficulty = { in: q.difficulty };
  }
  if (q.solved === "solved") where.solved = true;
  else if (q.solved === "unsolved") where.solved = false;

  // Sort field mapping
  const sortField = q.sort_by;
  const orderBy: Record<string, "asc" | "desc"> = {};
  if (sortField === "difficulty") {
    orderBy.difficultyOrder = q.sort_dir;
  } else {
    orderBy[sortField === "id" ? "leetcodeId" : sortField] = q.sort_dir;
  }

  const total = await db.question.count({ where });
  const questions = await db.question.findMany({
    where,
    orderBy,
    skip: (q.page - 1) * q.page_size,
    take: q.page_size,
    select: {
      id: true,
      leetcodeId: true,
      url: true,
      title: true,
      difficulty: true,
      solved: true,
      solvedAt: true,
    },
  });

  // Stats are always for the full sheet, not the filtered subset
  const totalCount = await db.question.count({ where: { sheetId, ownerId: user.id } });
  const solvedCount = await db.question.count({ where: { sheetId, ownerId: user.id, solved: true } });
  const byDiff = await db.question.groupBy({
    by: ["difficulty"],
    where: { sheetId, ownerId: user.id },
    _count: { _all: true },
  });
  const byDiffSolved = await db.question.groupBy({
    by: ["difficulty"],
    where: { sheetId, ownerId: user.id, solved: true },
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
    questions: questions.map((q) => ({
      id: q.id,
      leetcode_id: q.leetcodeId,
      url: q.url,
      title: q.title,
      difficulty: q.difficulty,
      solved: q.solved,
      solved_at: q.solvedAt,
    })),
    total,
    page: q.page,
    page_size: q.page_size,
    total_pages: Math.max(1, Math.ceil(total / q.page_size)),
    stats: { total: totalCount, solved: solvedCount, by_difficulty: diffMap },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ sheetId: string }> }) {
  const { sheetId } = await params;
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  const sheet = await db.sheet.findFirst({ where: { id: sheetId, ownerId: user.id } });
  if (!sheet) return notFound("Sheet not found");

  let body: {
    leetcode_id?: number;
    url?: string;
    title?: string;
    difficulty?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  const leetcodeId = Number(body.leetcode_id);
  if (!Number.isFinite(leetcodeId) || leetcodeId <= 0) {
    return Response.json({ detail: "Valid leetcode_id required" }, { status: 422 });
  }
  const url = (body.url ?? "").trim();
  const title = (body.title ?? "").trim();
  const difficulty = (body.difficulty ?? "").trim();
  if (!url || !title) return Response.json({ detail: "url and title required" }, { status: 422 });
  if (!DIFFICULTY_ORDER.hasOwnProperty(difficulty)) {
    return Response.json({ detail: "Invalid difficulty" }, { status: 422 });
  }

  const existing = await db.question.findUnique({
    where: { sheetId_leetcodeId: { sheetId, leetcodeId } },
  });
  if (existing) return Response.json({ detail: "Question already exists in this sheet" }, { status: 409 });

  const question = await db.question.create({
    data: {
      sheetId,
      ownerId: user.id,
      leetcodeId,
      url,
      title,
      difficulty,
      difficultyOrder: DIFFICULTY_ORDER[difficulty],
    },
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
  }, { status: 201 });
}
