import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json(null, { status: 200 });
  }

  const res = await fetch(
    `${BACKEND_URL}/settings?user_id=${encodeURIComponent(session.user.id)}`,
  );

  if (res.status === 404 || res.status === 204) {
    return NextResponse.json(null, { status: 200 });
  }

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await req.json();

  const res = await fetch(
    `${BACKEND_URL}/settings?user_id=${encodeURIComponent(session.user.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
