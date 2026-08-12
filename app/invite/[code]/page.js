"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function InvitePage({ params }) {
  const code = params.code.toUpperCase();
  const router = useRouter();
  const [room, setRoom] = useState(undefined);
  const [user, setUser] = useState(undefined);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    fetch(`/api/rooms/${code}`)
      .then((r) => r.json())
      .then((d) => setRoom(d.room || null));

    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null));

    fetch(`/api/rooms/${code}/presence`)
      .then((r) => r.json())
      .then((d) => setViewerCount(d.count || 0));
  }, [code]);

  if (room === undefined || user === undefined) return null;

  if (room === null) {
    return (
      <main className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="text-xl font-semibold mb-2">Invitation not found</h1>
        <p className="text-neutral-500 text-sm mb-6">
          This room code doesn't exist, or the link is incorrect.
        </p>
        <Link href="/" className="text-accent text-sm hover:underline">
          ← Back to WatchTogether
        </Link>
      </main>
    );
  }

  const redirectTarget = `/room/${code}`;
  const thumbnail =
    room.video_source === "youtube"
      ? `https://img.youtube.com/vi/${room.video_url}/hqdefault.jpg`
      : null;

  return (
    <main className="max-w-lg mx-auto px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:text-white">
        ← WatchTogether
      </Link>

      <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-accent/20 to-neutral-900 border border-neutral-800 mt-6">
        <div className="aspect-video bg-neutral-950 flex items-center justify-center relative">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover opacity-70" />
          ) : (
            <span className="text-5xl">🎬</span>
          )}
        </div>
        <div className="p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-accent mb-2">
            WatchTogether invitation
          </p>
          <h1 className="text-2xl font-bold mb-1">{room.name}</h1>
          {(room.original_video_title || room.video_title) && (
            <p className="text-sm text-neutral-400 mb-4">{room.original_video_title || room.video_title}</p>
          )}

          <div className="flex items-center justify-center gap-3 text-xs text-neutral-500 mb-6">
            <span>
              👥 {viewerCount}
              {room.max_participants ? `/${room.max_participants}` : ""}
            </span>
            <span>·</span>
            <span>{viewerCount > 0 ? "🟢 Live now" : "⚪ Waiting to start"}</span>
          </div>

          {user ? (
            <button
              onClick={() => router.push(redirectTarget)}
              className="w-full bg-accent rounded-lg py-2.5 font-medium hover:opacity-90"
            >
              Join room
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-400 mb-3">
                Sign in to join this watch party.
              </p>
              <Link
                href={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
                className="block w-full bg-accent rounded-lg py-2.5 font-medium hover:opacity-90"
              >
                Sign in to join
              </Link>
              <Link
                href={`/signup?redirect=${encodeURIComponent(redirectTarget)}`}
                className="block w-full bg-neutral-800 rounded-lg py-2.5 font-medium hover:bg-neutral-700"
              >
                Create an account
              </Link>
            </div>
          )}

          <p className="text-xs text-neutral-600 mt-6 tracking-widest">{room.code}</p>
        </div>
      </div>
    </main>
  );
}
