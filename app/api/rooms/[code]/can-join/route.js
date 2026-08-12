import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { verifyToken } = require("../../../../../lib/auth");
const { getRoomByCode, getRoomOccupancy, isActiveRoomMember } = require("../../../../../lib/db");

export async function GET(req, { params }) {
  const token = cookies().get("wt_session")?.value;
  const payload = token && verifyToken(token);
  if (!payload) return NextResponse.json({ allowed: false, error: "Not signed in" }, { status: 401 });

  const code = params.code.toUpperCase();
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ allowed: false, error: "Room not found" }, { status: 404 });
  if (room.host_id === payload.userId || await isActiveRoomMember(code, payload.userId)) return NextResponse.json({ allowed: true, count: 1, maxParticipants: room.max_participants });

  const occupancy = await getRoomOccupancy(code);
  const count = occupancy?.count || 0;
  const allowed = !room.max_participants || count < room.max_participants;
  return NextResponse.json({ allowed, count, maxParticipants: room.max_participants, error: allowed ? null : "This room is full" });
}
