import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { verifyToken } = require("../../../../lib/auth");
const { signDownload, isPCloudRef } = require("../../../../lib/pcloud");
const { getMovieById } = require("../../../../lib/db");

export const runtime = "nodejs";

export async function POST(request) {
  const token = cookies().get("wt_session")?.value;
  const user = token && verifyToken(token);
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const { movieId } = await request.json();
    if (!movieId) return NextResponse.json({ error: "Movie ID is required" }, { status: 400 });
    const movie = await getMovieById(movieId, user.userId);
    if (!movie) return NextResponse.json({ error: "Movie not found" }, { status: 404 });
    return NextResponse.json({ url: isPCloudRef(movie.video_url) ? await signDownload(movie.video_url) : movie.video_url });
  } catch (error) {
    console.error("[pcloud download-url]", error);
    return NextResponse.json({ error: error?.message || "Couldn't create video URL" }, { status: 500 });
  }
}
