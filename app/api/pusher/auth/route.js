import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const pusher = require("../../../../lib/pusher");
const { verifyToken } = require("../../../../lib/auth");
const { getRoomByCode, reserveRoomSeat } = require("../../../../lib/db");

export async function POST(req) {
  const formData = await req.formData();
  const socketId = formData.get("socket_id");
  const channelName = formData.get("channel_name");
  if (!socketId || !channelName) return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });

  const token = cookies().get("wt_session")?.value;
  const payload = token && verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Sign in required to join this room" }, { status: 403 });

  const code = channelName.replace(/^presence-room-/, "").toUpperCase();
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const reservation = await reserveRoomSeat(code, payload.userId);
  if (!reservation.ok) {
    if (reservation.reason === "full") return NextResponse.json({ error: "This room is full" }, { status: 403 });
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const isHost = payload.userId === room.host_id;
  return NextResponse.json(
    pusher.authorizeChannel(socketId, channelName, {
      user_id: payload.userId,
      user_info: { username: payload.username, isHost },
    })
  );
}
