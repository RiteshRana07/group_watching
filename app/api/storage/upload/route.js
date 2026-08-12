import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const {
  verifyToken,
  COOKIE_NAME,
  getTokenFromCookies,
} = require("../../../../lib/auth");

const {
  ensureFolder,
  storageRef,
  makeObjectName,
  validateVideo,
  MAX_VIDEO_BYTES,
} = require("../../../../lib/pcloud");

export const runtime = "nodejs";

/*
 * Get logged-in user
 */
function getCurrentUser(request) {
  try {
    let token = null;

    /*
     * Try Next.js cookies()
     */
    const cookieStore = cookies();

    const cookieToken =
      cookieStore.get(COOKIE_NAME)?.value;

    if (cookieToken) {
      token = cookieToken;
    }

    /*
     * Fallback to raw Cookie header
     */
    if (!token) {
      const cookieHeader =
        request.headers.get("cookie") || "";

      token =
        getTokenFromCookies(cookieHeader);
    }

    if (!token) {
      return null;
    }

    const payload = verifyToken(token);

    if (!payload?.userId) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error(
      "[storage upload] auth error:",
      error
    );

    return null;
  }
}

/*
 * Error response
 */
function jsonError(error, status = 400) {
  console.error(
    "[storage upload]",
    error
  );

  return NextResponse.json(
    {
      error:
        error?.message ||
        "Storage operation failed",
    },
    { status }
  );
}

/*
 * POST /api/storage/upload
 */
export async function POST(request) {
  const user =
    getCurrentUser(request);

  console.log(
    "[storage upload] user:",
    user?.userId ||
      "NOT SIGNED IN"
  );

  if (!user) {
    return NextResponse.json(
      {
        error: "Not signed in",
      },
      {
        status: 401,
      }
    );
  }

  try {
    /*
     * Read multipart/form-data
     */
    const formData =
      await request.formData();

    const file =
      formData.get("file");

    const title =
      String(
        formData.get("title") || ""
      ).trim();

    if (!file) {
      return NextResponse.json(
        {
          error:
            "Video file is required",
        },
        {
          status: 400,
        }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          error:
            "Movie title is required",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * File information
     */
    const filename =
      file.name || "video.mp4";

    const contentType =
      file.type ||
      "application/octet-stream";

    const size =
      Number(file.size);

    console.log(
      "[storage upload] filename:",
      filename
    );

    console.log(
      "[storage upload] contentType:",
      contentType
    );

    console.log(
      "[storage upload] size:",
      size
    );

    /*
     * Validate video
     */
    validateVideo({
      filename,
      contentType,
      size,
    });

    /*
     * Get /WatchTogether folder
     */
    const folderId =
      await ensureFolder();

    console.log(
      "[storage upload] folderId:",
      folderId
    );

    /*
     * Create unique filename
     */
    const objectName =
      makeObjectName(
        user.userId,
        filename
      );

    console.log(
      "[storage upload] objectName:",
      objectName
    );

    /*
     * pCloud configuration
     */
    const accessToken =
      process.env.PCLOUD_ACCESS_TOKEN;

    const apiHost = (
      process.env.PCLOUD_API_HOST ||
      "https://api.pcloud.com"
    ).replace(/\/$/, "");

    if (!accessToken) {
      throw new Error(
        "PCLOUD_ACCESS_TOKEN is missing"
      );
    }

    /*
     * Convert uploaded file
     * into Blob
     */
    const arrayBuffer =
      await file.arrayBuffer();

    const blob = new Blob(
      [arrayBuffer],
      {
        type: contentType,
      }
    );

    /*
     * Create pCloud multipart form
     */
    const pcloudForm =
      new FormData();

    pcloudForm.append(
      "folderid",
      String(folderId)
    );

    pcloudForm.append(
      "filename",
      objectName
    );

    pcloudForm.append(
      "file",
      blob,
      objectName
    );

    /*
     * pCloud uploadfile API
     */
    const uploadUrl =
      `${apiHost}/uploadfile?access_token=${encodeURIComponent(
        accessToken
      )}`;

    console.log(
      "[storage upload] sending file to pCloud..."
    );

    const response =
      await fetch(
        uploadUrl,
        {
          method: "POST",
          body: pcloudForm,
          cache: "no-store",
        }
      );

    const text =
      await response.text();

    let data;

    try {
      data =
        JSON.parse(text);
    } catch {
      throw new Error(
        `pCloud returned invalid JSON (HTTP ${response.status})`
      );
    }

    console.log(
      "[storage upload] pCloud response:",
      data
    );

    /*
     * pCloud result 0 = success
     */
    if (
      !response.ok ||
      Number(data.result) !== 0
    ) {
      throw new Error(
        data.error ||
          `pCloud upload failed (result ${data.result})`
      );
    }

    /*
     * Extract uploaded file
     */
    const metadata =
      Array.isArray(data.metadata)
        ? data.metadata[0]
        : null;

    const fileId =
      metadata?.fileid ||
      data.fileids?.[0];

    if (!fileId) {
      throw new Error(
        "pCloud upload succeeded but no file ID was returned"
      );
    }

    /*
     * Create storage reference
     */
    const ref =
      storageRef(fileId);

    console.log(
      "[storage upload] SUCCESS",
      {
        fileId,
        storageRef: ref,
        name:
          metadata?.name,
        size:
          metadata?.size,
      }
    );

    /*
     * Return result to browser
     */
    return NextResponse.json({
      ok: true,

      title,

      storageRef: ref,

      fileId,

      objectName,

      folderId,

      size:
        Number(
          metadata?.size ||
            size
        ),

      contentType:
        metadata?.contenttype ||
        contentType,

      name:
        metadata?.name ||
        objectName,

      maxBytes:
        MAX_VIDEO_BYTES,
    });
  } catch (error) {
    return jsonError(error);
  }
}

/*
 * GET /api/storage/upload
 */
export async function GET(request) {
  const user =
    getCurrentUser(request);

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Not signed in",
      },
      {
        status: 401,
      }
    );
  }

  return NextResponse.json({
    ok: true,
    message:
      "Storage upload API is working",
  });
}