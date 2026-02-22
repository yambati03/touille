import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const res = await fetch(
    `${BACKEND_URL}/recipes/${id}?user_id=${encodeURIComponent(session.user.id)}`,
  );

  if (res.status === 404) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
