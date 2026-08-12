import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { verifyToken } = require("../../../../../lib/auth");
const { touchRoomMember, releaseRoomMember } = require("../../../../../lib/db");
const pusher = require("../../../../../lib/pusher");

function getUser() {
  const token = cookies().get("wt_session")?.value;
  return token && verifyToken(token);
}

export async function GET(req, { params }) {
  const code = params.code.toUpperCase();
  try {
    const result = await pusher.get({ path: `/channels/presence-room-${code}`, params: { info: "user_count" } });
    const data = await result.json();
    return NextResponse.json({ count: data.user_count || 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

export async function POST(req, { params }) {
  const user = getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const code = params.code.toUpperCase();
  if (body.action === "leave") await releaseRoomMember(code, user.userId);
  else await touchRoomMember(code, user.userId);
  return NextResponse.json({ ok: true });
}
