import { NextResponse } from "next/server";
const { createUser, getUserByEmail } = require("../../../../lib/db");
const { hashPassword, signToken, sessionCookie } = require("../../../../lib/auth");

export async function POST(req) {
  const { username, email, password } = await req.json();

  if (!username || !email || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await createUser({ username, email, passwordHash });
  const token = signToken({ userId: user.id, username: user.username });

  const res = NextResponse.json({ user });
  res.headers.set("Set-Cookie", sessionCookie(token));
  return res;
}
