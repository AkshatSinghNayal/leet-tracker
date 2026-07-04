import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Simple DB ping — count users (cheap query)
    await db.user.count();
    return Response.json({ status: "ok", db: "ok" });
  } catch (e) {
    return Response.json(
      { status: "degraded", db: "error", error: (e as Error).message },
      { status: 503 }
    );
  }
}
