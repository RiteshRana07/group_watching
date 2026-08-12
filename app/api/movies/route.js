import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const { verifyToken } = require("../../../lib/auth");

const {
  createMovie,
  listMoviesForUser,
} = require("../../../lib/db");

const {
  isPCloudRef,
  signDownload,
  getMetadataFromRef,
} = require("../../../lib/pcloud");

export const runtime = "nodejs";

/* ----------------------------------------
   Get logged-in user
---------------------------------------- */

function requireUser() {
  try {
    const token = cookies().get("wt_session")?.value;

    if (!token) {
      return null;
    }

    const payload = verifyToken(token);

    if (!payload?.userId) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error("[movies] auth error:", error);
    return null;
  }
}

/* ----------------------------------------
   Convert stored pCloud reference
   into playable URL
---------------------------------------- */

async function withPlayableUrl(movie) {
  if (!movie) {
    return movie;
  }

  try {
    const videoUrl = movie.video_url;

    if (isPCloudRef(videoUrl)) {
      const playableUrl = await signDownload(videoUrl);

      return {
        ...movie,
        video_url: playableUrl,
      };
    }

    return movie;
  } catch (error) {
    console.error(
      "[movies] failed to create playable URL:",
      error
    );

    return {
      ...movie,
      video_url: null,
    };
  }
}

/* ----------------------------------------
   GET /api/movies
---------------------------------------- */

export async function GET() {
  try {
    const payload = requireUser();

    console.log(
      "[movies GET] user:",
      payload?.userId || "NOT SIGNED IN"
    );

    if (!payload) {
      return NextResponse.json(
        { error: "Not signed in" },
        { status: 401 }
      );
    }

    const movies = await listMoviesForUser(
      payload.userId
    );

    const playableMovies = await Promise.all(
      movies.map(withPlayableUrl)
    );

    return NextResponse.json({
      ok: true,
      movies: playableMovies,
    });
  } catch (error) {
    console.error(
      "[movies GET] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to load movies",
      },
      {
        status: 500,
      }
    );
  }
}

/* ----------------------------------------
   POST /api/movies
---------------------------------------- */

export async function POST(request) {
  try {
    const payload = requireUser();

    console.log(
      "[movies POST] user:",
      payload?.userId || "NOT SIGNED IN"
    );

    if (!payload) {
      return NextResponse.json(
        {
          error: "Not signed in",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request.json();

    const title = String(
      body?.title || ""
    ).trim();

    const videoUrl = String(
      body?.videoUrl || ""
    ).trim();

    console.log("[movies POST] title:", title);
    console.log(
      "[movies POST] videoUrl:",
      videoUrl
    );

    if (!title) {
      return NextResponse.json(
        {
          error: "Movie title is required",
        },
        {
          status: 400,
        }
      );
    }

    if (!videoUrl) {
      return NextResponse.json(
        {
          error: "Video URL is required",
        },
        {
          status: 400,
        }
      );
    }

    /* ------------------------------------
       Validate pCloud reference
    ------------------------------------ */

    if (isPCloudRef(videoUrl)) {
      console.log(
        "[movies POST] validating pCloud reference"
      );

      const metadata =
        await getMetadataFromRef(videoUrl);

      console.log(
        "[movies POST] pCloud metadata:",
        metadata
      );

      if (!metadata?.fileid) {
        return NextResponse.json(
          {
            error:
              "Invalid pCloud video reference",
          },
          {
            status: 400,
          }
        );
      }

      if (metadata.ismine === false) {
        return NextResponse.json(
          {
            error:
              "This pCloud file does not belong to your account",
          },
          {
            status: 403,
          }
        );
      }
    }

    /* ------------------------------------
       Validate external URL
    ------------------------------------ */

    else {
      let parsedUrl;

      try {
        parsedUrl = new URL(videoUrl);
      } catch {
        return NextResponse.json(
          {
            error: "Invalid video URL",
          },
          {
            status: 400,
          }
        );
      }

      if (
        parsedUrl.protocol !== "http:" &&
        parsedUrl.protocol !== "https:"
      ) {
        return NextResponse.json(
          {
            error: "Invalid video URL",
          },
          {
            status: 400,
          }
        );
      }
    }

    /* ------------------------------------
       Save movie in PostgreSQL
    ------------------------------------ */

    console.log(
      "[movies POST] saving movie to database..."
    );

    const movie = await createMovie({
      title,
      videoUrl,
      ownerId: payload.userId,
    });

    console.log(
      "[movies POST] movie saved:",
      movie
    );

    if (!movie) {
      throw new Error(
        "Movie was not returned after database insert"
      );
    }

    /* ------------------------------------
       Return playable movie
    ------------------------------------ */

    const result =
      await withPlayableUrl(movie);

    return NextResponse.json(
      {
        ok: true,
        movie: result,
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    console.error(
      "================================"
    );

    console.error(
      "[movies POST] DATABASE/SAVE ERROR"
    );

    console.error(
      "message:",
      error?.message
    );

    console.error(
      "code:",
      error?.code
    );

    console.error(
      "detail:",
      error?.detail
    );

    console.error(
      "constraint:",
      error?.constraint
    );

    console.error(
      "stack:",
      error?.stack
    );

    console.error(
      "================================"
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Failed to save movie",
      },
      {
        status: 500,
      }
    );
  }
}