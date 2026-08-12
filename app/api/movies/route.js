import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { verifyToken } = require("../../../lib/auth");
const { createMovie, listMoviesForUser } = require("../../../lib/db");
const { isPCloudRef, signDownload, getMetadataFromRef } = require("../../../lib/pcloud");

function requireUser() {
  const token = cookies().get("wt_session")?.value;
  return token && verifyToken(token);
}

async function withPlayableUrl(movie) {
  return {
    ...movie,
    video_url: isPCloudRef(movie.video_url) ? await signDownload(movie.video_url) : movie.video_url,
  };
}

export async function GET() {
  const payload = requireUser();
  if (!payload) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const movies = await listMoviesForUser(payload.userId);
  return NextResponse.json({ movies: await Promise.all(movies.map(withPlayableUrl)) });
}

export async function POST(req) {
  const payload = requireUser();
  if (!payload) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { title, videoUrl } = await req.json();
  if (!title?.trim() || !videoUrl) return NextResponse.json({ error: "Title and video are required" }, { status: 400 });

  if (isPCloudRef(videoUrl)) {
    const meta = await getMetadataFromRef(videoUrl);
    if (!meta?.fileid || meta.ismine === false) return NextResponse.json({ error: "Invalid pCloud video" }, { status: 400 });
  } else if (!/^https?:\/\//i.test(videoUrl)) {
    return NextResponse.json({ error: "Invalid video URL" }, { status: 400 });
  }

  const movie = await createMovie({ title: title.trim(), videoUrl, ownerId: payload.userId });
  return NextResponse.json({ movie: await withPlayableUrl(movie) });
}
