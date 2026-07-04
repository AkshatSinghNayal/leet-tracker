import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  setRefreshCookie,
  decodeToken,
  clearRefreshCookie,
} from "@/lib/auth";
import { getUserFromRefreshCookie } from "@/lib/auth-utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action === "register") return handleRegister(req);
  if (action === "login") return handleLogin(req);
  if (action === "refresh") return handleRefresh();
  if (action === "logout") return handleLogout();
  return Response.json({ detail: "Not found" }, { status: 404 });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action === "me") return handleMe(_req);
  return Response.json({ detail: "Not found" }, { status: 404 });
}

async function handleRegister(req: NextRequest) {
  let body: { email?: string; password?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON" }, { status: 422 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ detail: "Valid email is required" }, { status: 422 });
  }
  if (password.length < 8) {
    return Response.json({ detail: "Password must be at least 8 characters" }, { status: 422 });
  }
  if (!name) {
    return Response.json({ detail: "Name is required" }, { status: 422 });
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ detail: "Email already registered" }, { status: 409 });
  }

  const user = await db.user.create({
    data: { email, name, hashedPassword: hashPassword(password) },
    select: { id: true, email: true, name: true },
  });

  const accessToken = await createAccessToken(user.id);
  const refreshToken = await createRefreshToken(user.id);
  await setRefreshCookie(refreshToken);

  return Response.json({ user, access_token: accessToken }, { status: 201 });
}

async function handleLogin(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ detail: "Invalid JSON" }, { status: 422 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return Response.json({ detail: "Email and password required" }, { status: 422 });
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.hashedPassword)) {
    return Response.json({ detail: "Invalid credentials" }, { status: 401 });
  }

  const accessToken = await createAccessToken(user.id);
  const refreshToken = await createRefreshToken(user.id);
  await setRefreshCookie(refreshToken);

  return Response.json({
    user: { id: user.id, email: user.email, name: user.name },
    access_token: accessToken,
  });
}

async function handleRefresh() {
  const user = await getUserFromRefreshCookie();
  if (!user) {
    return Response.json({ detail: "Invalid or expired refresh token" }, { status: 401 });
  }
  const accessToken = await createAccessToken(user.id);
  const refreshToken = await createRefreshToken(user.id);
  await setRefreshCookie(refreshToken);
  return Response.json({ access_token: accessToken });
}

async function handleLogout() {
  await clearRefreshCookie();
  return Response.json({ ok: true });
}

async function handleMe(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    return Response.json({ detail: "Not authenticated" }, { status: 401 });
  }
  const token = authHeader.slice(7).trim();
  const payload = await decodeToken(token);
  if (!payload || payload.type !== "access") {
    return Response.json({ detail: "Invalid token" }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  if (!user) {
    return Response.json({ detail: "User not found" }, { status: 401 });
  }
  return Response.json(user);
}
