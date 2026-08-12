import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { getRoomByCode, deleteRoom, updateRoomCapacity } = require("../../../../lib/db");
const { verifyToken } = require("../../../../lib/auth");
const { isPCloudRef, signDownload } = require("../../../../lib/pcloud");
const pusher = require("../../../../lib/pusher");

function requireUser() {
  const token = cookies().get("wt_session")?.value;
  return token && verifyToken(token);
}

function parseCapacity(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : null;
}

async function playable(value) {
  return isPCloudRef(value) ? signDownload(value) : value;
}

async function serializeRoom(room, canPlay) {
  if (!room || !canPlay) return room;
  return {
    ...room,
    playable_video_url: await playable(room.video_url),
    playable_current_video_url: await playable(room.current_video_url || room.video_url),
    playable_original_video_url: await playable(room.original_video_url || room.video_url),
  };
}

export async function GET(req, { params }) {
  const room = await getRoomByCode(params.code.toUpperCase());
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const user = requireUser();
  return NextResponse.json({ room: await serializeRoom(room, !!user) });
}

export async function DELETE(req, { params }) {
  const payload = requireUser();
  if (!payload) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const code = params.code.toUpperCase();
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  if (room.host_id !== payload.userId) return NextResponse.json({ error: "Only the host can delete this room" }, { status: 403 });
  await deleteRoom(code, payload.userId);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req, { params }) {
  const payload = requireUser();
  if (!payload) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const code = params.code.toUpperCase();
  const { maxParticipants } = await req.json();
  const cap = parseCapacity(maxParticipants);
  if (!cap) return NextResponse.json({ error: "Room size must be between 1 and 500" }, { status: 400 });

  const room = await updateRoomCapacity(code, payload.userId, cap);
  if (!room) return NextResponse.json({ error: "Room not found, or you're not the host" }, { status: 403 });

  await pusher.trigger(`presence-room-${code}`, "room:capacity-changed", {
    maxParticipants: room.max_participants,
  });
  return NextResponse.json({ room: await serializeRoom(room, true) });
}
