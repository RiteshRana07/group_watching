import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { verifyToken } = require("../../../../../lib/auth");
const { getRoomByCode, addRoomQueueItem, listRoomQueue, removeRoomQueueItem } = require("../../../../../lib/db");
const { extractYouTubeId } = require("../../../../../lib/youtube");
const { isPCloudRef, signDownload } = require("../../../../../lib/pcloud");
const pusher = require("../../../../../lib/pusher");

function requireUser() {
  const token = cookies().get("wt_session")?.value;
  return token && verifyToken(token);
}

async function resolveVideo(videoUrl) {
  const url = String(videoUrl || "").trim();
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) {
    let title = null;
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json`);
      if (response.ok) title = (await response.json()).title || null;
    } catch {}
    return { videoUrl: youtubeId, videoTitle: title, videoSource: "youtube", movieId: null };
  }
  try {
    new URL(url);
  } catch {
    return null;
  }
  return { videoUrl: url, videoTitle: null, videoSource: "url", movieId: null };
}

export async function GET(req, { params }) {
  const user = requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const code = params.code.toUpperCase();
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const queue = await listRoomQueue(code);
  const playableQueue = await Promise.all(queue.map(async (item) => ({
    ...item,
    playable_video_url: isPCloudRef(item.video_url) ? await signDownload(item.video_url) : item.video_url,
  })));
  return NextResponse.json({ queue: playableQueue });
}

export async function POST(req, { params }) {
  const user = requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const code = params.code.toUpperCase();
  const room = await getRoomByCode(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const { videoUrl } = await req.json();
  const resolved = await resolveVideo(videoUrl);
  if (!resolved) return NextResponse.json({ error: "Enter a valid YouTube or video URL" }, { status: 400 });

  const item = await addRoomQueueItem({ code, addedBy: user.userId, ...resolved });
  await pusher.trigger(`presence-room-${code}`, "room:queue-changed", {});
  return NextResponse.json({ item });
}

export async function DELETE(req, { params }) {
  const user = requireUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing queue item id" }, { status: 400 });
  const item = await removeRoomQueueItem(id, user.userId);
  if (!item) return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
  await pusher.trigger(`presence-room-${params.code.toUpperCase()}`, "room:queue-changed", {});
  return NextResponse.json({ ok: true });
}
