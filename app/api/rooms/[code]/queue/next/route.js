import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { verifyToken } = require("../../../../../../lib/auth");
const { playNextRoomQueueItem } = require("../../../../../../lib/db");
const { isPCloudRef, signDownload } = require("../../../../../../lib/pcloud");
const pusher = require("../../../../../../lib/pusher");

export async function POST(req, { params }) {
  const token = cookies().get("wt_session")?.value;
  const user = token && verifyToken(token);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const code = params.code.toUpperCase();
  const result = await playNextRoomQueueItem(code, user.userId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  const room = result.room;
  const rawVideoUrl = room.current_video_url || room.video_url;
  const rawOriginalUrl = room.original_video_url || room.video_url;
  const playableVideoUrl = isPCloudRef(rawVideoUrl) ? await signDownload(rawVideoUrl) : rawVideoUrl;
  const playableOriginalUrl = isPCloudRef(rawOriginalUrl) ? await signDownload(rawOriginalUrl) : rawOriginalUrl;
  await pusher.trigger(`presence-room-${code}`, "room:video-changed", {
    videoUrl: playableVideoUrl,
    videoTitle: room.current_video_title || room.video_title,
    videoSource: room.current_video_source || room.video_source,
    originalVideoUrl: playableOriginalUrl,
  });
  await pusher.trigger(`presence-room-${code}`, "room:queue-changed", {});

  return NextResponse.json({ room, item: result.item });
}
