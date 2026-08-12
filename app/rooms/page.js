"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Nav from "../../components/Nav";
import { useCurrentUser } from "../../lib/use-current-user";

export default function RoomsPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const [rooms, setRooms] = useState(undefined);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (!user) return;
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(d.rooms || []));
  }, [user]);

  async function handleJoin(e) {
    e.preventDefault();
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    if (!code) return setJoinError("Enter a room code");

    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) return setJoinError("No room found with that code");
    router.push(`/room/${code}`);
  }

  async function handleDelete(code) {
    if (!confirm("Delete this room? This can't be undone.")) return;
    await fetch(`/api/rooms/${code}`, { method: "DELETE" });
    setRooms((prev) => prev.filter((r) => r.code !== code));
  }

  if (!user) return null;

  return (
    <main>
      <Nav username={user.username} />
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent mb-1">Watch together</p>
            <h1 className="text-2xl font-bold mb-1">Private rooms</h1>
            <p className="text-sm text-neutral-500">
              Create a room from your library, invite friends, and watch together in perfect sync.
            </p>
          </div>
          <Link
            href="/rooms/create"
            className="px-5 py-2.5 bg-accent rounded-lg font-medium hover:opacity-90 whitespace-nowrap"
          >
            + Create room
          </Link>
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-8">
          <section>
            <h2 className="text-sm font-semibold text-neutral-300 mb-1">Your active rooms</h2>
            <p className="text-xs text-neutral-500 mb-4">Rooms you host or have already joined.</p>

            {rooms && rooms.length === 0 && (
              <div className="text-center py-16 border border-dashed border-neutral-800 rounded-xl">
                <p className="font-semibold mb-1">No active rooms</p>
                <p className="text-sm text-neutral-500">
                  Create a watch room from one of your ready movies, or join using an invitation code.
                </p>
              </div>
            )}

            {rooms && rooms.length > 0 && (
              <div className="space-y-2">
                {rooms.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-neutral-700"
                  >
                    <Link href={`/room/${r.code}`} className="flex-1">
                      <p className="font-medium">{r.name}</p>
                      {(r.original_video_title || r.video_title) && (
                        <p className="text-xs text-neutral-500">{r.original_video_title || r.video_title}</p>
                      )}
                    </Link>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500">Code: {r.code}</span>
                      <button
                        onClick={() => handleDelete(r.code)}
                        className="text-xs text-neutral-600 hover:text-red-400"
                        title="Delete room"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="p-6 rounded-xl bg-neutral-900 border border-neutral-800 h-fit">
            <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Have an invitation?</p>
            <h3 className="font-semibold mb-4">Join a private room</h3>
            <form onSubmit={handleJoin} className="space-y-3">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Private room code</label>
                <input
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2 tracking-widest uppercase"
                  placeholder="AB12CD"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </div>
              {joinError && <p className="text-sm text-red-400">{joinError}</p>}
              <button className="w-full bg-neutral-100 text-neutral-900 rounded-lg py-2 font-medium hover:opacity-90">
                Join private room
              </button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
