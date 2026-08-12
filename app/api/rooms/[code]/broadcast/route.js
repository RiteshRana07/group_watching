import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const pusher = require("../../../../../lib/pusher");
const { verifyToken } = require("../../../../../lib/auth");
const { getRoomByCode } = require("../../../../../lib/db");

const ALLOWED_EVENTS = [
  "player:action",
  "player:heartbeat",
  "chat:message",
  "reaction:show",
  "room:grant-control",
  "player:request-sync",
];

// Player sync + control-granting events should skip the sender (they
// already applied their own change locally) to avoid a feedback loop.
// Chat and reactions should reach everyone, including the sender, so
// their own message/reaction shows up too.
const EXCLUDE_SENDER_EVENTS = ["player:action", "player:heartbeat", "room:grant-control"];

export async function POST(req, { params }) {
  const code = params.code.toUpperCase();
  const { event, data, socketId } = await req.json();

  if (!ALLOWED_EVENTS.includes(event)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  if (event === "room:grant-control") {
    // Only the room's host may grant or revoke another viewer's control.
    const token = cookies().get("wt_session")?.value;
    const payload = token && verifyToken(token);
    const room = await getRoomByCode(code);
    if (!payload || !room || payload.userId !== room.host_id) {
      return NextResponse.json({ error: "Only the host can do that" }, { status: 403 });
    }
  }

  const payload =
    event === "chat:message"
      ? { ...data, message: String(data.message || "").slice(0, 500) }
      : data;

  const options =
    EXCLUDE_SENDER_EVENTS.includes(event) && socketId ? { socket_id: socketId } : undefined;

  await pusher.trigger(`presence-room-${code}`, event, payload, options);

  return NextResponse.json({ ok: true });
}


