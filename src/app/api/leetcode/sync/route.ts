import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getUserFromAccessToken, unauthorized } from "@/lib/auth-utils";

export const runtime = "nodejs";

const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";
const LEETCODE_SYNC_QUERY = `
  query getUserProfileAndRecentAc($username: String!, $limit: Int!) {
    matchedUser(username: $username) {
      username
      submitStatsGlobal {
        acSubmissionNum {
          difficulty
          count
        }
      }
    }
    recentAcSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      timestamp
    }
  }
`;

interface GraphQLSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
}

interface GraphQLResponse {
  data?: {
    matchedUser: {
      username: string;
      submitStatsGlobal?: {
        acSubmissionNum?: Array<{ difficulty: string; count: number }>;
      };
    } | null;
    recentAcSubmissionList?: GraphQLSubmission[] | null;
  };
  errors?: Array<{ message?: string }>;
}

function extractLeetcodeSlug(url: string): string | null {
  const match = url.match(/leetcode\.com\/problems\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : null;
}

async function applySolvedIds(userId: string, ids: number[], now: Date) {
  if (ids.length === 0) {
    return { newlyAddedGlobal: 0, newlyMarkedInSheets: 0 };
  }

  const existingGlobal = await db.solvedQuestion.findMany({
    where: { ownerId: userId, leetcodeId: { in: ids } },
    select: { leetcodeId: true },
  });
  const existingSet = new Set(existingGlobal.map((r) => r.leetcodeId));
  const newGlobalIds = ids.filter((id) => !existingSet.has(id));

  if (newGlobalIds.length > 0) {
    await db.solvedQuestion.createMany({
      data: newGlobalIds.map((leetcodeId) => ({
        ownerId: userId,
        leetcodeId,
        solvedAt: now,
      })),
      skipDuplicates: true,
    });
  }

  const updatedQuestions = await db.question.updateMany({
    where: {
      ownerId: userId,
      leetcodeId: { in: ids },
      solved: false,
      sheet: { syncWithGlobal: true },
    },
    data: {
      solved: true,
      solvedAt: now,
    },
  });

  return {
    newlyAddedGlobal: newGlobalIds.length,
    newlyMarkedInSheets: updatedQuestions.count,
  };
}

export async function POST(req: NextRequest) {
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  let body: {
    mode?: "username" | "import";
    username?: string;
    solvedIds?: unknown[];
    solvedSlugs?: unknown[];
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON" }, { status: 422 });
  }

  const isImportMode =
    body.mode === "import" ||
    Array.isArray(body.solvedIds) ||
    Array.isArray(body.solvedSlugs);

  const now = new Date();

  if (isImportMode) {
    const directIds = new Set<number>();
    if (Array.isArray(body.solvedIds)) {
      for (const raw of body.solvedIds) {
        const n = typeof raw === "number" ? raw : Number(raw);
        if (Number.isInteger(n) && n > 0) {
          directIds.add(n);
        }
      }
    }

    const slugSet = new Set<string>();
    if (Array.isArray(body.solvedSlugs)) {
      for (const raw of body.solvedSlugs) {
        if (typeof raw !== "string") continue;
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const extracted = extractLeetcodeSlug(trimmed);
        slugSet.add((extracted ?? trimmed).toLowerCase());
      }
    }

    if (directIds.size === 0 && slugSet.size === 0) {
      return Response.json(
        { detail: "Provide at least one solved question ID or title slug" },
        { status: 400 }
      );
    }

    let resolvedFromSlugs = 0;
    if (slugSet.size > 0) {
      const userQuestions = await db.question.findMany({
        where: { ownerId: user.id },
        select: { leetcodeId: true, url: true },
      });
      for (const q of userQuestions) {
        const slug = extractLeetcodeSlug(q.url);
        if (slug && slugSet.has(slug) && !directIds.has(q.leetcodeId)) {
          directIds.add(q.leetcodeId);
          resolvedFromSlugs++;
        }
      }
    }

    const allIds = Array.from(directIds);
    const { newlyAddedGlobal, newlyMarkedInSheets } = await applySolvedIds(
      user.id,
      allIds,
      now
    );

    const optionalUsername =
      typeof body.username === "string" && body.username.trim()
        ? body.username.trim().slice(0, 64)
        : undefined;

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        leetcodeLastSyncedAt: now,
        ...(optionalUsername !== undefined ? { leetcodeUsername: optionalUsername } : {}),
      },
      select: { leetcodeUsername: true, leetcodeLastSyncedAt: true },
    });

    return Response.json({
      mode: "import",
      leetcode_username: updatedUser.leetcodeUsername,
      leetcode_last_synced_at: updatedUser.leetcodeLastSyncedAt,
      total_submitted_ids: allIds.length,
      resolved_from_slugs: resolvedFromSlugs,
      newly_added_global: newlyAddedGlobal,
      newly_marked_in_sheets: newlyMarkedInSheets,
    });
  }

  // Public username mode (cookie-free GraphQL query)
  const username = (body.username ?? "").trim();
  if (!username || !/^[a-zA-Z0-9_-]{1,64}$/.test(username)) {
    return Response.json(
      { detail: "Enter a valid LeetCode username" },
      { status: 422 }
    );
  }

  let gqlPayload: GraphQLResponse;
  try {
    const res = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Referer: "https://leetcode.com",
        Origin: "https://leetcode.com",
        "User-Agent": "Mozilla/5.0 (compatible; LeetCodeTracker/1.0)",
      },
      body: JSON.stringify({
        query: LEETCODE_SYNC_QUERY,
        variables: { username, limit: 20 },
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return Response.json(
        { detail: `LeetCode GraphQL returned HTTP ${res.status}` },
        { status: 502 }
      );
    }

    gqlPayload = (await res.json()) as GraphQLResponse;
  } catch (err) {
    return Response.json(
      {
        detail:
          err instanceof Error && err.name === "TimeoutError"
            ? "LeetCode GraphQL request timed out"
            : "Failed to reach LeetCode GraphQL API",
      },
      { status: 502 }
    );
  }

  const matchedUser = gqlPayload.data?.matchedUser;
  if (!matchedUser) {
    return Response.json(
      { detail: `LeetCode user "${username}" not found` },
      { status: 404 }
    );
  }

  const statsMap: Record<string, number> = { all: 0, easy: 0, medium: 0, hard: 0 };
  for (const item of matchedUser.submitStatsGlobal?.acSubmissionNum ?? []) {
    const key = item.difficulty.toLowerCase();
    if (key in statsMap) statsMap[key] = item.count;
  }

  const recentList = gqlPayload.data?.recentAcSubmissionList ?? [];
  const recentSlugs = new Set(
    recentList
      .map((s) => s.titleSlug?.trim().toLowerCase())
      .filter((s): s is string => Boolean(s))
  );

  const userQuestions = await db.question.findMany({
    where: { ownerId: user.id },
    select: { leetcodeId: true, url: true },
  });

  const matchedIdsSet = new Set<number>();
  for (const q of userQuestions) {
    const slug = extractLeetcodeSlug(q.url);
    if (slug && recentSlugs.has(slug)) {
      matchedIdsSet.add(q.leetcodeId);
    }
  }
  const matchedIds = Array.from(matchedIdsSet);

  const { newlyAddedGlobal, newlyMarkedInSheets } = await applySolvedIds(
    user.id,
    matchedIds,
    now
  );

  const updatedUser = await db.user.update({
    where: { id: user.id },
    data: {
      leetcodeUsername: matchedUser.username,
      leetcodeLastSyncedAt: now,
    },
    select: { leetcodeUsername: true, leetcodeLastSyncedAt: true },
  });

  return Response.json({
    mode: "username",
    leetcode_username: updatedUser.leetcodeUsername,
    leetcode_last_synced_at: updatedUser.leetcodeLastSyncedAt,
    stats: statsMap,
    recent_ac_count: recentList.length,
    matched_questions: matchedIds.length,
    newly_added_global: newlyAddedGlobal,
    newly_marked_in_sheets: newlyMarkedInSheets,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromAccessToken(req);
  if (!user) return unauthorized();

  await db.user.update({
    where: { id: user.id },
    data: { leetcodeUsername: null },
  });

  return Response.json({
    ok: true,
    leetcode_username: null,
  });
}
