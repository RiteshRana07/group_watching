const crypto = require("crypto");

const PCLOUD_FOLDER_ID =
  process.env.PCLOUD_FOLDER_ID || "";
const API_HOST = (process.env.PCLOUD_API_HOST || "https://api.pcloud.com").replace(/\/$/, "");
function getAccessToken() {
  return process.env.PCLOUD_ACCESS_TOKEN || "";
}
const ROOT_FOLDER = process.env.PCLOUD_FOLDER || "/WatchTogether";
const MAX_VIDEO_BYTES = 3 * 1024 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
]);

function isConfigured() {
  return Boolean(getAccessToken());
}

function requireConfigured() {
  if (!isConfigured()) {
    throw new Error("pCloud is not configured. Set PCLOUD_ACCESS_TOKEN and PCLOUD_API_HOST in your environment.");
  }
}

async function api(method, params = {}, { signal } = {}) {
  requireConfigured();
  const accessToken = getAccessToken();
  const url = new URL(`${API_HOST}/${method}`);
  url.searchParams.set("access_token", accessToken);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  });

  const res = await fetch(url, { cache: "no-store", signal });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`pCloud returned a non-JSON response (${res.status})`);
  }

  if (!res.ok || Number(data.result) !== 0) {
    const error = new Error(
      data.error || `pCloud API error ${data.result || res.status}`
    );
    error.code = data.result;
    error.status = res.status;
    throw error;
  }

  return data;
}

function safeFilename(name) {
  const base = String(name || "video.mp4")
    .normalize("NFKC")
    .replace(/[\\/\0]+/g, "-")
    .replace(/[^a-zA-Z0-9._ -]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .trim()
    .replace(/^[. -]+|[. -]+$/g, "")
    .slice(0, 180);
  return base || "video.mp4";
}

function makeObjectName(userId, filename) {
  return `${userId}-${Date.now()}-${crypto.randomUUID()}-${safeFilename(filename)}`;
}

function storageRef(fileId) {
  return `pcloud:${String(fileId)}`;
}

function isPCloudRef(value) {
  return typeof value === "string" && value.startsWith("pcloud:");
}

function fileIdFromRef(value) {
  if (!isPCloudRef(value)) return null;
  const id = value.slice("pcloud:".length);
  return /^\d+$/.test(id) ? id : null;
}

function validateVideo({ filename, contentType, size }) {
  if (!ALLOWED_TYPES.has(contentType)) {
    throw new Error("Unsupported video type. Use MP4, WebM, OGG, MOV or MKV.");
  }
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) throw new Error("Invalid video size");
  if (bytes > MAX_VIDEO_BYTES) throw new Error("Video is too large. Maximum size is 3 GB.");
  if (!String(filename || "").trim()) throw new Error("Filename is required");
  return bytes;
}

async function ensureFolder() {
  if (PCLOUD_FOLDER_ID) {
    return Number(PCLOUD_FOLDER_ID);
  }

  const data = await api("createfolderifnotexists", {
    path: ROOT_FOLDER,
  });

  const folderId =
    data.metadata?.folderid ??
    data.metadata?.id;

  if (!folderId) {
    throw new Error(
      "pCloud did not return the WatchTogether folder ID"
    );
  }

  return Number(folderId);
}

function getUploadLinkCode() {
  const configured = String(process.env.PCLOUD_UPLOAD_LINK_CODE || "").trim();
  if (!configured) {
    throw new Error(
      "pCloud File Request is not configured. Create a File Request for /WatchTogether and set PCLOUD_UPLOAD_LINK_CODE to its code or full request URL."
    );
  }

  // Accept either the raw code or the complete pCloud request URL.
  // Typical pCloud URLs contain #page=puplink&code=... .
  if (/^https?:\/\//i.test(configured)) {
    try {
      const url = new URL(configured);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const queryCode = url.searchParams.get("code");
      const hashCode = hash.get("code");
      const code = String(queryCode || hashCode || "").trim();
      if (code) return code;
    } catch {}
  }

  return configured;
}

function buildUploadLinkUrl(code) {
  const host = API_HOST || "https://api.pcloud.com";
  const url = new URL(`${host}/uploadtolink`);
  url.searchParams.set("code", code);
  return url.toString();
}

async function listFolder(folderId) {
  const data = await api("listfolder", { folderid: folderId });
  return data.metadata || {};
}

async function findFile(folderId, objectName) {
  const metadata = await listFolder(folderId);
  const files = Array.isArray(metadata.contents) ? metadata.contents : [];
  return files.find((item) => !item.isfolder && item.name === objectName) || null;
}

async function getFileMetadata(fileId) {
  const data = await api("stat", { fileid: fileId });
  return data.metadata;
}

function buildContentUrl(result) {
  if (!result?.hosts?.length || !result.path) throw new Error("pCloud did not return a playable content URL");
  return `https://${result.hosts[0]}${result.path}`;
}

async function getFileLink(fileId) {
  const data = await api("getfilelink", { fileid: fileId, skipfilename: 1 });
  return buildContentUrl(data);
}

async function deleteFile(fileId) {
  await api("deletefile", { fileid: fileId });
}

async function signDownload(storedValue) {
  if (!isPCloudRef(storedValue)) return storedValue;
  const fileId = fileIdFromRef(storedValue);
  if (!fileId) throw new Error("Invalid pCloud storage reference");
  return getFileLink(fileId);
}

async function getMetadataFromRef(storedValue) {
  const fileId = fileIdFromRef(storedValue);
  if (!fileId) return null;
  return getFileMetadata(fileId);
}

async function deleteStoredObject(storedValue) {
  if (!isPCloudRef(storedValue)) return;
  const fileId = fileIdFromRef(storedValue);
  if (fileId) await deleteFile(fileId);
}

module.exports = {
  API_HOST,
  ROOT_FOLDER,
  MAX_VIDEO_BYTES,
  ALLOWED_TYPES,
  isConfigured,
  requireConfigured,
  safeFilename,
  makeObjectName,
  storageRef,
  isPCloudRef,
  fileIdFromRef,
  validateVideo,
  ensureFolder,
  getUploadLinkCode,
  buildUploadLinkUrl,
  findFile,
  getFileMetadata,
  signDownload,
  getMetadataFromRef,
  deleteStoredObject,
};
