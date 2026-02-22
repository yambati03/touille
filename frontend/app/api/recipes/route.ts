import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json([], { status: 200 });
  }

  const res = await fetch(
    `${BACKEND_URL}/recipes?user_id=${encodeURIComponent(session.user.id)}`,
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
