import { db } from "@/lib/db";
import { decodeToken } from "@/lib/auth";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function getUserFromAccessToken(req: NextRequest): Promise<{ id: string; email: string; name: string } | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return null;
  const token = authHeader.slice(7).trim();
  const payload = await decodeToken(token);
  if (!payload || payload.type !== "access") return null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export async function getUserFromRefreshCookie(): Promise<{ id: string; email: string; name: string } | null> {
  const store = await cookies();
  const cookie = store.get("lt_refresh");
  if (!cookie?.value) return null;
  const payload = await decodeToken(cookie.value);
  if (!payload || payload.type !== "refresh") return null;

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export function unauthorized(message = "Not authenticated") {
  return Response.json({ detail: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return Response.json({ detail: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return Response.json({ detail: message }, { status: 404 });
}
