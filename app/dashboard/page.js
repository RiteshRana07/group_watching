"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../../components/Nav";
import { useCurrentUser } from "../../lib/use-current-user";

export default function Dashboard() {
  const user = useCurrentUser();
  const [movieCount, setMovieCount] = useState(null);
  const [roomCount, setRoomCount] = useState(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/movies")
      .then((r) => r.json())
      .then((d) => setMovieCount((d.movies || []).length));
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => setRoomCount((d.rooms || []).length));
  }, [user]);

  if (!user) return null;

  const stats = [
    { label: "In library", value: movieCount ?? "–", note: "Movies you own" },
    { label: "Rooms created", value: roomCount ?? "–", note: "Hosted by you" },
  ];

  return (
    <main>
      <Nav username={user.username} />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <section className="rounded-xl bg-gradient-to-br from-accent/20 to-neutral-900 border border-neutral-800 p-8 mb-8">
          <p className="text-xs uppercase tracking-wide text-accent mb-2">Your cinema</p>
          <h1 className="text-3xl font-bold mb-3">Welcome back, {user.username}.</h1>
          <p className="text-neutral-400 mb-6 max-w-xl">
            Upload a movie you own, invite your friends into a private room, and
            experience every scene together.
          </p>
          <div className="flex gap-3">
            <Link
              href="/library"
              className="px-5 py-2.5 bg-accent rounded-lg font-medium hover:opacity-90"
            >
              Upload movie
            </Link>
            <Link
              href="/rooms"
              className="px-5 py-2.5 bg-neutral-800 rounded-lg font-medium hover:bg-neutral-700"
            >
              View rooms
            </Link>
          </div>
        </section>

        <div className="grid sm:grid-cols-2 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="p-5 rounded-xl bg-neutral-900 border border-neutral-800">
              <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2">{s.label}</p>
              <p className="text-3xl font-bold mb-1">{s.value}</p>
              <p className="text-xs text-neutral-500">{s.note}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
