import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

export const ACCESS_TOKEN_EXPIRES_MINUTES = 15;
export const REFRESH_TOKEN_EXPIRES_DAYS = 7;
export const REFRESH_COOKIE_NAME = "lt_refresh";

const secretKey = process.env.JWT_SECRET_KEY || "dev-secret-change-me-to-a-64-char-hex-string";
const encoder = new TextEncoder();
const secret = encoder.encode(secretKey);
const algorithm = "HS256";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(plain: string, hashed: string): boolean {
  try {
    return bcrypt.compareSync(plain, hashed);
  } catch {
    return false;
  }
}

export async function createAccessToken(userId: string): Promise<string> {
  const expireSeconds = ACCESS_TOKEN_EXPIRES_MINUTES * 60;
  return await new SignJWT({ sub: userId, type: "access" })
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(`${expireSeconds}s`)
    .sign(secret);
}

export async function createRefreshToken(userId: string): Promise<string> {
  const expireSeconds = REFRESH_TOKEN_EXPIRES_DAYS * 86400;
  return await new SignJWT({ sub: userId, type: "refresh" })
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(`${expireSeconds}s`)
    .sign(secret);
}

export async function decodeToken(token: string): Promise<{ sub: string; type: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [algorithm] });
    if (typeof payload.sub !== "string" || typeof payload.type !== "string") return null;
    return { sub: payload.sub, type: payload.type };
  } catch {
    return null;
  }
}

export async function getCurrentUserFromRequest(): Promise<{ id: string; email: string; name: string } | null> {
  // Try access token from Authorization header first
  const headerCookie = await cookies();
  // We need access token from a separate cookie or header
  const authHeader = null; // Server components can't read headers directly; client passes via API
  void authHeader;

  const refreshCookie = headerCookie.get(REFRESH_COOKIE_NAME);
  if (!refreshCookie?.value) return null;

  const payload = await decodeToken(refreshCookie.value);
  if (!payload || payload.type !== "refresh") return null;

  // Lazy-load db to avoid circular import
  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true },
  });
  return user;
}

export async function setRefreshCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set({
    name: REFRESH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: (process.env.COOKIE_SAMESITE as "lax" | "none" | "strict") || "lax",
    maxAge: REFRESH_TOKEN_EXPIRES_DAYS * 86400,
    path: "/",
  });
}

export async function clearRefreshCookie(): Promise<void> {
  const store = await cookies();
  store.set({
    name: REFRESH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: (process.env.COOKIE_SAMESITE as "lax" | "none" | "strict") || "lax",
    maxAge: 0,
    path: "/",
  });
}
