import { NextResponse } from "next/server";
const { clearCookie } = require("../../../../lib/auth");

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearCookie());
  return res;
}
