import { NextResponse } from "next/server";
import { cookies } from "next/headers";
const { verifyToken } = require("../../../../lib/auth");
const { getMovieById, deleteMovie } = require("../../../../lib/db");
const { deleteStoredObject } = require("../../../../lib/pcloud");

export const runtime = "nodejs";

export async function DELETE(req, { params }) {
  const token = cookies().get("wt_session")?.value;
  const payload = token && verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const movie = await getMovieById(params.id, payload.userId);
  if (!movie) return NextResponse.json({ error: "Movie not found" }, { status: 404 });
  try {
    await deleteStoredObject(movie.video_url);
  } catch (error) {
    console.error("[movies] pCloud delete failed", error);
    return NextResponse.json({ error: "The storage file could not be removed. Nothing was deleted from your library." }, { status: 502 });
  }
  await deleteMovie(params.id, payload.userId);
  return NextResponse.json({ ok: true });
}
