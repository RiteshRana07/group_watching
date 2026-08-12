import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { verifyToken } = require("../../../../lib/auth");
const { getUserById } = require("../../../../lib/db");

export async function GET() {
  const token = cookies().get("wt_session")?.value;
  const payload = token && verifyToken(token);
  if (!payload) return NextResponse.json({ user: null });

  const user = await getUserById(payload.userId);
  return NextResponse.json({ user: user || null });
}
