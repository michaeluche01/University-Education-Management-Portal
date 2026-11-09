import { NextResponse, connection } from "next/server";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  await connection();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[GET /api/health] Database health check failed:", error);
    return NextResponse.json(
      { ok: false, error: "Database connection failed" },
      { status: 503 }
    );
  }
}
