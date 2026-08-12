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
 * ---------------------------------------------------------
 * Upload file to our Next.js API
 * ---------------------------------------------------------
 */

function uploadToServer(file, title, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    const form = new FormData();

    form.append("title", title);

    form.append(
      "file",
      file,
      file.name
    );

    let finished = false;

    function fail(message) {
      if (finished) return;

      finished = true;

      reject(
        new Error(
          message || "Upload failed"
        )
      );
    }

    /*
     * Browser -> Next.js progress.
     */
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(
          Math.min(
            file.size,
            event.loaded
          )
        );
      }
    };

    xhr.onerror = () => {
      fail(
        "Could not connect to the WatchTogether server."
      );
    };

    xhr.onabort = () => {
      fail(
        "Upload was cancelled."
      );
    };

    xhr.ontimeout = () => {
      fail(
        "Upload timed out. Please try again."
      );
    };

    xhr.onload = () => {
      if (finished) return;

      let data = {};

      try {
        data = JSON.parse(
          xhr.responseText || "{}"
        );
      } catch {
        fail(
          `Server returned invalid JSON (HTTP ${xhr.status}).`
        );

        return;
      }

      if (
        xhr.status < 200 ||
        xhr.status >= 300
      ) {
        fail(
          data.error ||
          `Upload failed (HTTP ${xhr.status}).`
        );

        return;
      }

      if (!data.ok) {
        fail(
          data.error ||
          "pCloud upload failed."
        );

        return;
      }

      finished = true;

      onProgress?.(file.size);

      resolve(data);
    };

    /*
     * Give large video uploads plenty of time.
     */
    xhr.timeout =
      2 * 60 * 60 * 1000;

    /*
     * Send cookies so Next.js can identify
     * the logged-in user.
     */
    xhr.open(
      "POST",
      "/api/storage/upload",
      true
    );

    xhr.withCredentials = true;

    try {
      xhr.send(form);
    } catch (error) {
      fail(
        error?.message ||
        "Could not start upload."
      );
    }
  });
}

/*
 * ---------------------------------------------------------
 * Library page
 * ---------------------------------------------------------
 */

export default function LibraryPage() {
  const user = useCurrentUser();

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
   * -------------------------------------------------------
   * Progress
   * -------------------------------------------------------
   */

  const progressPercent =
    useMemo(() => {
      if (!file?.size) {
        return 0;
      }

      return Math.min(
        100,
        (progressBytes / file.size) *
          100
      );
    }, [
      file,
      progressBytes,
    ]);

  /*
   * -------------------------------------------------------
   * Load movies
   * -------------------------------------------------------
   */

  async function loadMovies() {
    try {
      const res = await fetch(
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
      }
    } catch (error) {
      console.error(
        "Failed to load movies:",
        error
      );
    }
  }

  /*
   * -------------------------------------------------------
   * Save movie in database
   * -------------------------------------------------------
   */

  async function saveMovie(
    titleValue,
    storageRefValue
  ) {
    const res = await fetch(
      "/api/movies",
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          title: titleValue,
          videoUrl:
            storageRefValue,
        }),
      }
    );

    const data =
      await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
        "Couldn't save the video to your library"
      );
    }

    return data.movie;
  }

  /*
   * -------------------------------------------------------
   * Initial load
   * -------------------------------------------------------
   */

  useEffect(() => {
    if (!user) {
      return;
    }

    loadMovies();

    /*
     * Recover movie if browser was interrupted
     * after pCloud upload.
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
          .catch(
            console.error
          );
      }
    } catch (error) {
      console.error(
        "Pending movie recovery failed:",
        error
      );
    }
  }, [user]);

  /*
   * -------------------------------------------------------
   * Reset form
   * -------------------------------------------------------
   */

  function resetUpload() {
    setTitle("");
    setFile(null);
    setProgressBytes(0);
    setError("");
    setShowForm(false);
  }

  /*
   * -------------------------------------------------------
   * Upload
   * -------------------------------------------------------
   */

  async function handleUpload(event) {
    event.preventDefault();

    setError("");

    if (!title.trim()) {
      setError(
        "Give the movie a title"
      );

      return;
    }

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
       * ---------------------------------------------------
       * One upload request.
       *
       * Browser
       *    ↓
       * Next.js
       *    ↓
       * pCloud uploadfile
       * ---------------------------------------------------
       */

      const result =
        await uploadToServer(
          file,
          title.trim(),
          (uploaded) => {
            setProgressBytes(
              uploaded
            );
          }
        );

      console.log(
        "[library] pCloud upload result:",
        result
      );

      const storageRef =
        result.storageRef;

      if (!storageRef) {
        throw new Error(
          "pCloud upload completed but no storage reference was returned."
        );
      }

      /*
       * Save pending state before database operation.
       */
      localStorage.setItem(
        "wt_pending_movie",
        JSON.stringify({
          title: title.trim(),
          storageRef,
        })
      );

      /*
       * Save movie in database.
       */
      await saveMovie(
        title.trim(),
        storageRef
      );

      /*
       * Database succeeded.
       */
      localStorage.removeItem(
        "wt_pending_movie"
      );

      setProgressBytes(
        file.size
      );

      await loadMovies();

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
   * -------------------------------------------------------
   * Delete movie
   * -------------------------------------------------------
   */

  async function handleDelete(id) {
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
            .catch(() => ({}));

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
   * -------------------------------------------------------
   * Not logged in
   * -------------------------------------------------------
   */

  if (!user) {
    return null;
  }

  /*
   * -------------------------------------------------------
   * UI
   * -------------------------------------------------------
   */

  return (
    <main>
      <Nav username={user.username} />

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}

        <div className="flex items-start justify-between mb-8">

          <div>
            <p className="text-xs uppercase tracking-wide text-accent mb-1">
              Your collection
            </p>

            <h1 className="text-2xl font-bold mb-1">
              Movie library
            </h1>

            <p className="text-sm text-neutral-500">
              Everything you've uploaded — ready for a private watch room.
            </p>
          </div>

          <button
            onClick={() =>
              setShowForm(
                (value) => !value
              )
            }
            className="px-5 py-2.5 bg-accent rounded-lg font-medium hover:opacity-90 whitespace-nowrap"
          >
            + Upload movie
          </button>

        </div>

        {/* Upload form */}

        {showForm && (
          <form
            onSubmit={handleUpload}
            className="mb-8 p-6 rounded-xl bg-neutral-900 border border-neutral-800 space-y-4"
          >

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

            {error && (
              <p className="text-sm text-red-400">
                {error}
              </p>
            )}

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

            <button
              type="submit"
              disabled={busy}
              className="bg-accent px-5 py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {busy
                ? `Uploading ${formatMB(
                    progressBytes
                  )} MB / ${formatMB(
                    file?.size || 0
                  )} MB`
                : "Add to library"}
            </button>

          </form>
        )}

        {/* Empty library */}

        {movies &&
          movies.length === 0 && (
            <div className="text-center py-20 border border-dashed border-neutral-800 rounded-xl">

              <p className="text-lg font-semibold mb-2">
                Your library is empty
              </p>

              <p className="text-sm text-neutral-500 mb-6">
                Upload a legally owned movie file to start your first private watch party.
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

        {/* Movie library */}

        {movies &&
          movies.length > 0 && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {movies.map((movie) => (
                <div
                  key={movie.id}
                  className="p-5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col gap-3"
                >

                  <div className="aspect-video rounded-lg bg-neutral-950 flex items-center justify-center text-neutral-700 text-3xl">
                    🎬
                  </div>

                  <p className="font-medium truncate">
                    {movie.title}
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
              ))}

            </div>
          )}

      </div>
    </main>
  );
}