"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Nav from "../../../components/Nav";
import { useCurrentUser } from "../../../lib/use-current-user";

const PRESETS = [1, 2, 3, 5, 10];

function CreateRoomContent() {
  const user = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [movies, setMovies] = useState(undefined);
  const [source, setSource] = useState("library");
  const [movieId, setMovieId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("2");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    fetch("/api/movies")
      .then((r) => r.json())
      .then((d) => {
        const list = d.movies || [];
        setMovies(list);

        const requested = searchParams.get("movieId");

        if (requested && list.some((m) => m.id === requested)) {
          setMovieId(requested);
        }
      })
      .catch(() => {
        setMovies([]);
      });
  }, [user, searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const cap = Number(maxParticipants);

    if (!name.trim()) {
      return setError("Give your watch party a name");
    }

    if (source === "library" && !movieId) {
      return setError("Pick a movie from your library");
    }

    if (source === "url" && !videoUrl.trim()) {
      return setError("Paste a video URL");
    }

    if (!Number.isInteger(cap) || cap < 1 || cap > 500) {
      return setError("Room size must be between 1 and 500");
    }

    setBusy(true);

    try {
      const body =
        source === "library"
          ? {
              name,
              source: "library",
              movieId,
              maxParticipants: cap,
            }
          : {
              name,
              source: "url",
              videoUrl,
              maxParticipants: cap,
            };

      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create room");
      }

      router.push(`/room/${data.room.code}`);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return null;
  }

  return (
    <main>
      <Nav username={user.username} />

      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link
          href="/rooms"
          className="text-sm text-neutral-500 hover:text-white"
        >
          ← Back to rooms
        </Link>

        <p className="text-xs uppercase tracking-wide text-accent mt-6 mb-1">
          Private watch party
        </p>

        <h1 className="text-2xl font-bold mb-2">
          Create a watch room
        </h1>

        <p className="text-sm text-neutral-500 mb-8">
          Pick a movie from your library or paste a YouTube/direct video link.
          The first video permanently identifies the room; additional links
          can be queued after the room starts.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Video source */}
          <div>
            <label className="text-sm font-medium block mb-3">
              What do you want to watch?
            </label>

            <div className="grid sm:grid-cols-2 gap-3">

              <button
                type="button"
                onClick={() => setSource("library")}
                className={`text-left p-4 rounded-xl border ${
                  source === "library"
                    ? "border-accent bg-accent/10"
                    : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <p className="font-medium mb-1">
                  🎬 Movie from your library
                </p>

                <p className="text-xs text-neutral-500">
                  Pick an uploaded movie and watch it together.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSource("url")}
                className={`text-left p-4 rounded-xl border ${
                  source === "url"
                    ? "border-accent bg-accent/10"
                    : "border-neutral-800 bg-neutral-900"
                }`}
              >
                <p className="font-medium mb-1">
                  ▶️ YouTube or video link
                </p>

                <p className="text-xs text-neutral-500">
                  The first link becomes the permanent room video identity.
                </p>
              </button>

            </div>
          </div>

          {/* Room name */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Room name
            </label>

            <input
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2"
              placeholder="Friday movie night"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Room size */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Room size
            </label>

            <p className="text-xs text-neutral-500 mb-3">
              How many people, including you, can be in the room at once?
            </p>

            <div className="flex flex-wrap items-center gap-2">

              {PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMaxParticipants(String(n))}
                  className={`px-4 py-2 rounded-lg border ${
                    Number(maxParticipants) === n
                      ? "border-accent text-accent bg-accent/10"
                      : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white"
                  }`}
                >
                  {n}
                </button>
              ))}

              <input
                type="text"
                inputMode="numeric"
                value={
                  PRESETS.includes(Number(maxParticipants))
                    ? ""
                    : maxParticipants
                }
                onChange={(e) =>
                  setMaxParticipants(
                    e.target.value.replace(/\D/g, "").slice(0, 3)
                  )
                }
                placeholder="Custom"
                className="w-28 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2"
              />

            </div>

            <p className="text-[11px] text-neutral-600 mt-2">
              After 10, enter any size up to 500. Unlimited rooms are not
              supported.
            </p>
          </div>

          {/* Movie selection */}
          {source === "library" ? (

            movies && movies.length === 0 ? (

              <p className="text-sm text-neutral-500 p-4 rounded-lg bg-neutral-900 border border-neutral-800">
                No movies ready yet —{" "}
                <Link
                  href="/library"
                  className="text-accent"
                >
                  upload one to your library
                </Link>{" "}
                first.
              </p>

            ) : (

              <div>
                <label className="text-sm font-medium block mb-2">
                  Choose a movie
                </label>

                <select
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2"
                  value={movieId}
                  onChange={(e) => setMovieId(e.target.value)}
                >
                  <option value="">
                    Select a movie...
                  </option>

                  {(movies || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

            )

          ) : (

            <div>
              <label className="text-sm font-medium block mb-2">
                First video link
              </label>

              <input
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2"
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />

              <p className="text-[11px] text-neutral-600 mt-2">
                This first video cannot be replaced. Use the chat's
                "Add to queue" button for additional videos.
              </p>
            </div>

          )}

          {/* Error */}
          {error && (
            <p className="text-sm text-red-400">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            disabled={busy}
            className="bg-accent px-6 py-2.5 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Creating room..." : "Create room"}
          </button>

        </form>
      </div>
    </main>
  );
}

export default function CreateRoomPage() {
  return (
    <Suspense
      fallback={
        <main>
          <div className="max-w-2xl mx-auto px-6 py-10">
            <p className="text-sm text-neutral-500">
              Loading room creator...
            </p>
          </div>
        </main>
      }
    >
      <CreateRoomContent />
    </Suspense>
  );
}