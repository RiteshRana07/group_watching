"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "../../components/Nav";
import { useCurrentUser } from "../../lib/use-current-user";

function mb(bytes) {
  return bytes / (1024 * 1024);
}

function formatMB(bytes) {
  const value = mb(bytes);
  return value >= 10
    ? value.toFixed(0)
    : value.toFixed(1);
}

/*
=========================================================
UPLOAD VIDEO
=========================================================

Browser
   ↓
Next.js /api/storage/upload
   ↓
pCloud uploadfile
   ↓
fileId + storageRef
=========================================================
*/

async function uploadToPCloud(
  file,
  title,
  onProgress
) {
  const formData =
    new FormData();

  formData.append(
    "file",
    file
  );

  formData.append(
    "title",
    title
  );

  /*
   * IMPORTANT:
   *
   * Do NOT manually set Content-Type here.
   *
   * Browser automatically creates:
   *
   * multipart/form-data;
   * boundary=...
   */

  const response =
    await fetch(
      "/api/storage/upload",
      {
        method: "POST",
        credentials: "include",
        body: formData,
      }
    );

  /*
   * Read response as text first.
   * This prevents JSON.parse errors when
   * the server returns an HTML/error response.
   */

  const text =
    await response.text();

  let data = {};

  try {
    data = JSON.parse(
      text || "{}"
    );
  } catch {
    throw new Error(
      `Server returned invalid JSON (HTTP ${response.status}): ${text.slice(
        0,
        300
      )}`
    );
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        `Upload failed (HTTP ${response.status})`
    );
  }

  if (!data.ok) {
    throw new Error(
      data.error ||
        "Upload failed."
    );
  }

  /*
   * The current route uploads the complete
   * file before returning the response.
   *
   * Therefore we can mark progress as complete.
   */

  onProgress?.(
    file.size
  );

  console.log(
    "[library] pCloud upload completed:",
    data
  );

  return data;
}

/*
=========================================================
LIBRARY PAGE
=========================================================
*/

export default function LibraryPage() {
  const user =
    useCurrentUser();

  const [movies, setMovies] =
    useState(undefined);

  const [showForm, setShowForm] =
    useState(false);

  const [title, setTitle] =
    useState("");

  const [file, setFile] =
    useState(null);

  const [busy, setBusy] =
    useState(false);

  const [progressBytes, setProgressBytes] =
    useState(0);

  const [error, setError] =
    useState("");

  /*
  ========================================================
  PROGRESS
  ========================================================
  */

  const progressPercent =
    useMemo(() => {
      if (!file?.size) {
        return 0;
      }

      return Math.min(
        100,
        (progressBytes / file.size) * 100
      );
    }, [
      file,
      progressBytes,
    ]);

  /*
  ========================================================
  LOAD MOVIES
  ========================================================
  */

  async function loadMovies() {
    try {
      const res =
        await fetch(
          "/api/movies",
          {
            cache: "no-store",
            credentials: "include",
          }
        );

      const data =
        await res.json();

      if (res.ok) {
        setMovies(
          data.movies || []
        );
      } else {
        console.error(
          "Failed to load movies:",
          data.error
        );
      }
    } catch (error) {
      console.error(
        "Failed to load movies:",
        error
      );
    }
  }

  /*
  ========================================================
  SAVE MOVIE IN DATABASE
  ========================================================
  */

  async function saveMovie(
    titleValue,
    storageRefValue
  ) {
    const res =
      await fetch(
        "/api/movies",
        {
          method: "POST",
          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title:
              titleValue,

            videoUrl:
              storageRefValue,
          }),
        }
      );

    const text =
      await res.text();

    let data = {};

    try {
      data = JSON.parse(
        text || "{}"
      );
    } catch {
      throw new Error(
        `Movie API returned invalid JSON (HTTP ${res.status})`
      );
    }

    if (!res.ok) {
      throw new Error(
        data.error ||
          "Couldn't save the video to your library"
      );
    }

    return data.movie;
  }

  /*
  ========================================================
  INITIAL LOAD
  ========================================================
  */

  useEffect(() => {
    if (!user) {
      return;
    }

    loadMovies();

    /*
     * Recover pending movie if browser
     * was interrupted after pCloud upload.
     */

    try {
      const pending =
        JSON.parse(
          localStorage.getItem(
            "wt_pending_movie"
          ) || "null"
        );

      if (
        pending?.title &&
        pending?.storageRef
      ) {
        saveMovie(
          pending.title,
          pending.storageRef
        )
          .then(() => {
            localStorage.removeItem(
              "wt_pending_movie"
            );
          })
          .then(loadMovies)
          .catch(console.error);
      }
    } catch (error) {
      console.error(
        "Pending movie recovery failed:",
        error
      );
    }
  }, [user]);

  /*
  ========================================================
  RESET FORM
  ========================================================
  */

  function resetUpload() {
    setTitle("");
    setFile(null);
    setProgressBytes(0);
    setError("");
    setShowForm(false);
  }

  /*
  ========================================================
  UPLOAD
  ========================================================
  */

  async function handleUpload(
    event
  ) {
    event.preventDefault();

    setError("");

    /*
     * Validate title
     */

    if (!title.trim()) {
      setError(
        "Give the movie a title"
      );
      return;
    }

    /*
     * Validate file
     */

    if (!file) {
      setError(
        "Choose a video file"
      );
      return;
    }

    setBusy(true);
    setProgressBytes(0);

    try {
      /*
       * ====================================================
       * STEP 1
       * Upload video to pCloud
       * ====================================================
       */

      console.log(
        "[library] starting upload:",
        {
          name: file.name,
          size: file.size,
          type: file.type,
        }
      );

      const result =
        await uploadToPCloud(
          file,
          title.trim(),
          (uploaded) => {
            setProgressBytes(
              uploaded
            );
          }
        );

      console.log(
        "[library] upload result:",
        result
      );

      /*
       * ====================================================
       * STEP 2
       * Get storage reference
       * ====================================================
       */

      const storageRef =
        result.storageRef;

      if (!storageRef) {
        throw new Error(
          "pCloud upload completed but no storage reference was returned."
        );
      }

      /*
       * ====================================================
       * STEP 3
       * Save pending state
       * ====================================================
       */

      localStorage.setItem(
        "wt_pending_movie",
        JSON.stringify({
          title:
            title.trim(),

          storageRef,
        })
      );

      /*
       * ====================================================
       * STEP 4
       * Save movie in database
       * ====================================================
       */

      await saveMovie(
        title.trim(),
        storageRef
      );

      /*
       * ====================================================
       * STEP 5
       * Database succeeded
       * ====================================================
       */

      localStorage.removeItem(
        "wt_pending_movie"
      );

      setProgressBytes(
        file.size
      );

      /*
       * Refresh library
       */

      await loadMovies();

      /*
       * Reset form
       */

      resetUpload();

    } catch (err) {
      console.error(
        "[library] upload error:",
        err
      );

      setError(
        err?.message ||
          "Something went wrong while uploading"
      );
    } finally {
      setBusy(false);
    }
  }

  /*
  ========================================================
  DELETE MOVIE
  ========================================================
  */

  async function handleDelete(
    id
  ) {
    if (
      !confirm(
        "Remove this movie from your library?"
      )
    ) {
      return;
    }

    try {
      const res =
        await fetch(
          `/api/movies/${id}`,
          {
            method: "DELETE",
            credentials: "include",
          }
        );

      if (!res.ok) {
        const data =
          await res
            .json()
            .catch(
              () => ({})
            );

        alert(
          data.error ||
            "Couldn't remove the movie"
        );

        return;
      }

      await loadMovies();

    } catch (error) {
      alert(
        error?.message ||
          "Couldn't remove the movie"
      );
    }
  }

  /*
  ========================================================
  NOT LOGGED IN
  ========================================================
  */

  if (!user) {
    return null;
  }

  /*
  ========================================================
  UI
  ========================================================
  */

  return (
    <main>
      <Nav
        username={
          user.username
        }
      />

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* HEADER */}

        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-accent mb-1">
              Your collection
            </p>

            <h1 className="text-2xl font-bold mb-1">
              Movie library
            </h1>

            <p className="text-sm text-neutral-500">
              Everything you've uploaded —
              ready for a private watch room.
            </p>
          </div>

          <button
            onClick={() =>
              setShowForm(
                (value) =>
                  !value
              )
            }
            className="px-5 py-2.5 bg-accent rounded-lg font-medium hover:opacity-90 whitespace-nowrap"
          >
            + Upload movie
          </button>
        </div>

        {/* UPLOAD FORM */}

        {showForm && (
          <form
            onSubmit={
              handleUpload
            }
            className="mb-8 p-6 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4"
          >

            {/* TITLE */}

            <input
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-2"
              placeholder="Movie title"
              value={title}
              disabled={busy}
              onChange={(e) =>
                setTitle(
                  e.target.value
                )
              }
            />

            {/* FILE */}

            <input
              type="file"
              accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-matroska"
              disabled={busy}
              onChange={(e) =>
                setFile(
                  e.target.files?.[0] ||
                    null
                )
              }
              className="w-full text-sm text-neutral-400"
            />

            {/* SELECTED FILE */}

            {file && (
              <p className="text-xs text-neutral-500">
                Selected:{" "}
                {file.name} ·{" "}
                {formatMB(
                  file.size
                )}{" "}
                MB
              </p>
            )}

            {/* ERROR */}

            {error && (
              <p className="text-sm text-red-400">
                {error}
              </p>
            )}

            {/* PROGRESS */}

            {busy && file && (
              <div className="space-y-2">

                <div className="flex justify-between text-xs text-neutral-400">

                  <span>
                    Uploading video to pCloud
                  </span>

                  <span>
                    {formatMB(
                      progressBytes
                    )}{" "}
                    MB /{" "}
                    {formatMB(
                      file.size
                    )}{" "}
                    MB (
                    {Math.round(
                      progressPercent
                    )}
                    %)
                  </span>

                </div>

                <div className="h-2 rounded-full bg-neutral-800 overflow-hidden">

                  <div
                    className="h-full bg-accent transition-all"
                    style={{
                      width: `${progressPercent}%`,
                    }}
                  />

                </div>

              </div>
            )}

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={busy}
              className="bg-accent px-5 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? `Uploading ${formatMB(
                    progressBytes
                  )} MB / ${formatMB(
                    file?.size ||
                      0
                  )} MB`
                : "Add to library"}
            </button>

          </form>
        )}

        {/* EMPTY LIBRARY */}

        {movies &&
          movies.length === 0 && (
            <div className="text-center py-20 border border-dashed border-neutral-800 rounded-xl">

              <p className="text-lg font-semibold mb-2">
                Your library is empty
              </p>

              <p className="text-sm text-neutral-500 mb-6">
                Upload a legally owned movie
                file to start your first
                private watch party.
              </p>

              <button
                onClick={() =>
                  setShowForm(true)
                }
                className="px-5 py-2.5 bg-accent rounded-lg font-medium hover:opacity-90"
              >
                + Upload movie
              </button>

            </div>
          )}

        {/* MOVIE LIBRARY */}

        {movies &&
          movies.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {movies.map(
                (movie) => (
                  <div
                    key={
                      movie.id
                    }
                    className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3"
                  >

                    <div className="aspect-video rounded-lg bg-neutral-950 flex items-center justify-center text-neutral-700 text-3xl">
                      🎬
                    </div>

                    <p className="font-medium truncate">
                      {
                        movie.title
                      }
                    </p>

                    <a
                      href={`/rooms/create?movieId=${encodeURIComponent(
                        movie.id
                      )}`}
                      className="text-xs text-accent hover:underline"
                    >
                      Use in room
                    </a>

                    <button
                      onClick={() =>
                        handleDelete(
                          movie.id
                        )
                      }
                      className="text-xs text-neutral-500 hover:text-red-400 text-left"
                    >
                      Remove
                    </button>

                  </div>
                )
              )}

            </div>
          )}

      </div>
    </main>
  );
}