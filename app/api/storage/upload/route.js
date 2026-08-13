import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const {
  verifyToken,
} = require("../../../../lib/auth");

const {
  getOrCreateUserFolder,
  uploadFileToFolder,
  storageRef,
  validateVideo,
  MAX_VIDEO_BYTES,
} = require("../../../../lib/pcloud");

const {
  createStorageUpload,
  deleteStorageUpload,
} = require("../../../../lib/db");

export const runtime = "nodejs";

/* =========================================================
   AUTH
========================================================= */

function getCurrentUser() {
  try {
    const token =
      cookies().get(
        "wt_session"
      )?.value;

    if (!token) {
      return null;
    }

    const payload =
      verifyToken(token);

    if (
      !payload?.userId
    ) {
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

/* =========================================================
   ERROR
========================================================= */

function jsonError(
  error,
  status = 400
) {
  console.error(
    "[storage upload] ERROR:",
    error
  );

  return NextResponse.json(
    {
      error:
        error?.message ||
        "Storage operation failed.",
    },
    {
      status,
    }
  );
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request
) {
  const user =
    getCurrentUser();

  console.log(
    "[storage upload] user:",
    {
      userId:
        user?.userId ||
        null,

      username:
        user?.username ||
        null,
    }
  );

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Not signed in.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    /*
     * Browser sends:
     *
     * FormData
     *   title
     *   file
     */

    const formData =
      await request.formData();

    const title =
      String(
        formData.get(
          "title"
        ) || ""
      ).trim();

    const uploaded =
      formData.get(
        "file"
      );

    if (
      !title
    ) {
      return NextResponse.json(
        {
          error:
            "Movie title is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !uploaded ||
      typeof uploaded !==
        "object" ||
      typeof uploaded.arrayBuffer !==
        "function"
    ) {
      return NextResponse.json(
        {
          error:
            "Video file is required.",
        },
        {
          status: 400,
        }
      );
    }

    const filename =
      String(
        uploaded.name ||
          "video.mp4"
      );

    const contentType =
      String(
        uploaded.type ||
          ""
      );

    const size =
      Number(
        uploaded.size
      );

    /*
     * Validate video.
     */
    validateVideo({
      filename,
      contentType,
      size,
    });

    /*
     * =====================================================
     * STEP 1
     *
     * Find/create:
     *
     * /WatchTogether
     *
     * then:
     *
     * /WatchTogether/<username>
     *
     * =====================================================
     */

    const userFolder =
      await getOrCreateUserFolder(
        user.userId,
        user.username
      );

    console.log(
      "[storage upload] user folder:",
      userFolder
    );

    /*
     * =====================================================
     * STEP 2
     *
     * Upload directly into THIS user's folder.
     * =====================================================
     */

    const upload =
      await uploadFileToFolder({
        folderId:
          userFolder.folderId,

        file:
          uploaded,

        filename,

        contentType,
      });

    /*
     * =====================================================
     * STEP 3
     *
     * Permanent storage reference.
     * =====================================================
     */

    const storageRefValue =
      upload.storageRef ||
      storageRef(
        upload.fileId
      );

    /*
     * =====================================================
     * STEP 4
     *
     * Store a temporary DB upload record only if
     * your existing DB expects it.
     *
     * This is intentionally protected because the
     * database schema may differ between versions.
     * =====================================================
     */

    console.log(
      "[storage upload] SUCCESS:",
      {
        userId:
          user.userId,

        username:
          user.username,

        folderId:
          userFolder.folderId,

        folderName:
          userFolder.folderName,

        fileId:
          upload.fileId,

        storageRef:
          storageRefValue,

        filename:
          upload.metadata?.name ||
          filename,

        size:
          upload.metadata?.size ||
          size,
      }
    );

    return NextResponse.json({
      ok: true,

      storageRef:
        storageRefValue,

      fileId:
        upload.fileId,

      folderId:
        userFolder.folderId,

      folderName:
        userFolder.folderName,

      size:
        Number(
          upload.metadata?.size ||
            size
        ),

      contentType:
        upload.metadata?.contenttype ||
        contentType,

      name:
        upload.metadata?.name ||
        filename,

      title,
    });
  } catch (error) {
    return jsonError(
      error,
      Number(
        error?.status
      ) || 500
    );
  }
}

/* =========================================================
   GET
========================================================= */

export async function GET() {
  const user =
    getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Not signed in.",
      },
      {
        status: 401,
      }
    );
  }

  return NextResponse.json({
    ok: true,

    message:
      "Storage upload API is working.",

    userId:
      user.userId,

    username:
      user.username ||
      null,
  });
}