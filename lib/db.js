// Postgres persistence layer for WatchTogether.
// The schema is created/migrated lazily so the app can be deployed without
// a separate migration command. This is compatible with Neon/Vercel Postgres,
// Supabase, Railway and other PostgreSQL providers.
const { Pool } = require("pg");
const crypto = require("crypto");

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL is not set. Set it in your environment (see .env.example).");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? false : { rejectUnauthorized: false },
});

let schemaReady;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS movies (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id),
        title TEXT NOT NULL,
        video_url TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        video_url TEXT NOT NULL,
        video_title TEXT,
        video_source TEXT NOT NULL,
        movie_id TEXT REFERENCES movies(id),
        host_id TEXT NOT NULL REFERENCES users(id),
        max_participants INTEGER,
        created_at BIGINT NOT NULL
      );

      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS video_title TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS movie_id TEXT REFERENCES movies(id);
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS max_participants INTEGER;

      -- Immutable room identity and mutable playback state.
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS original_video_url TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS original_video_title TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS original_video_source TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS original_movie_id TEXT REFERENCES movies(id);
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_url TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_title TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_source TEXT;
      ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_movie_id TEXT REFERENCES movies(id);

      UPDATE rooms
      SET
        original_video_url = COALESCE(original_video_url, video_url),
        original_video_title = COALESCE(original_video_title, video_title),
        original_video_source = COALESCE(original_video_source, video_source),
        original_movie_id = COALESCE(original_movie_id, movie_id),
        current_video_url = COALESCE(current_video_url, video_url),
        current_video_title = COALESCE(current_video_title, video_title),
        current_video_source = COALESCE(current_video_source, video_source),
        current_movie_id = COALESCE(current_movie_id, movie_id)
      WHERE original_video_url IS NULL
         OR original_video_title IS NULL
         OR original_video_source IS NULL
         OR current_video_url IS NULL
         OR current_video_source IS NULL;

      -- Active room membership reservations. Pusher presence is the realtime
      -- source of truth for UI, while this table makes the capacity check
      -- atomic and resistant to simultaneous join races.
      CREATE TABLE IF NOT EXISTS room_members (
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at BIGINT NOT NULL,
        last_seen BIGINT NOT NULL,
        PRIMARY KEY (room_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_room_members_room_seen
        ON room_members(room_id, last_seen);

      CREATE TABLE IF NOT EXISTS room_queue (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        added_by TEXT NOT NULL REFERENCES users(id),
        video_url TEXT NOT NULL,
        video_title TEXT,
        video_source TEXT NOT NULL,
        movie_id TEXT REFERENCES movies(id),
        status TEXT NOT NULL DEFAULT 'queued',
        created_at BIGINT NOT NULL,
        played_at BIGINT
      );
      CREATE INDEX IF NOT EXISTS idx_room_queue_order
        ON room_queue(room_id, status, created_at);

      CREATE TABLE IF NOT EXISTS storage_uploads (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        folder_id BIGINT NOT NULL,
        uploadlink_id BIGINT NOT NULL,
        code TEXT NOT NULL,
        object_name TEXT NOT NULL,
        size BIGINT NOT NULL,
        progress_hash TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
      ALTER TABLE storage_uploads ALTER COLUMN uploadlink_id DROP NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_storage_uploads_owner
        ON storage_uploads(owner_id, created_at);
    `);
  }
  return schemaReady;
}

function id() {
  return crypto.randomUUID();
}

function shortCode(length = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function createUser({ username, email, passwordHash }) {
  await ensureSchema();
  const userId = id();
  await pool.query(
    `INSERT INTO users (id, username, email, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [userId, username, email, passwordHash, Date.now()]
  );
  return { id: userId, username, email };
}

async function getUserByEmail(email) {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  return rows[0] || null;
}

async function getUserById(userId) {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT id, username, email FROM users WHERE id = $1`, [userId]);
  return rows[0] || null;
}

async function createRoom({ name, videoUrl, videoTitle, videoSource, movieId, maxParticipants, hostId }) {
  await ensureSchema();
  const roomId = id();
  let code;
  do {
    code = shortCode(6);
  } while (await getRoomByCode(code));

  await pool.query(
    `INSERT INTO rooms (
      id, code, name, video_url, video_title, video_source, movie_id,
      original_video_url, original_video_title, original_video_source, original_movie_id,
      current_video_url, current_video_title, current_video_source, current_movie_id,
      max_participants, host_id, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$4,$5,$6,$7,$4,$5,$6,$7,$8,$9,$10)`,
    [
      roomId,
      code,
      name,
      videoUrl,
      videoTitle || null,
      videoSource,
      movieId || null,
      maxParticipants,
      hostId,
      Date.now(),
    ]
  );

  return getRoomByCode(code);
}

async function getRoomByCode(code) {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT * FROM rooms WHERE code = $1`, [code]);
  return rows[0] || null;
}

async function listRoomsForUser(hostId) {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT * FROM rooms WHERE host_id = $1 ORDER BY created_at DESC`, [hostId]);
  return rows;
}

async function createMovie({ title, videoUrl, ownerId }) {
  await ensureSchema();
  const movieId = id();
  await pool.query(
    `INSERT INTO movies (id, owner_id, title, video_url, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [movieId, ownerId, title, videoUrl, Date.now()]
  );
  return getMovieById(movieId, ownerId);
}

async function createMovieIfMissing({ title, videoUrl, ownerId }) {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`movie:${ownerId}:${videoUrl}`]);
    const existing = await client.query(`SELECT * FROM movies WHERE owner_id = $1 AND video_url = $2 LIMIT 1`, [ownerId, videoUrl]);
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return existing.rows[0];
    }
    const movieId = id();
    await client.query(
      `INSERT INTO movies (id, owner_id, title, video_url, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [movieId, ownerId, title, videoUrl, Date.now()]
    );
    await client.query("COMMIT");
    return getMovieById(movieId, ownerId);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function listMoviesForUser(ownerId) {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT * FROM movies WHERE owner_id = $1 ORDER BY created_at DESC`, [ownerId]);
  return rows;
}

async function getMovieById(movieId, ownerId) {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT * FROM movies WHERE id = $1 AND owner_id = $2`, [movieId, ownerId]);
  return rows[0] || null;
}

async function deleteMovie(movieId, ownerId) {
  await ensureSchema();
  await pool.query(`DELETE FROM movies WHERE id = $1 AND owner_id = $2`, [movieId, ownerId]);
}

async function deleteRoom(code, hostId) {
  await ensureSchema();
  await pool.query(`DELETE FROM rooms WHERE code = $1 AND host_id = $2`, [code, hostId]);
}

async function updateRoomCapacity(code, hostId, maxParticipants) {
  await ensureSchema();
  const { rows } = await pool.query(
    `UPDATE rooms SET max_participants = $1 WHERE code = $2 AND host_id = $3 RETURNING *`,
    [maxParticipants, code, hostId]
  );
  return rows[0] || null;
}

async function reserveRoomSeat(code, userId) {
  await ensureSchema();
  const client = await pool.connect();
  const now = Date.now();
  const staleBefore = now - 45_000;
  try {
    await client.query("BEGIN");
    // Serialize seat allocation per room. This closes the simultaneous-join race
    // where two Pusher auth requests both observe the same free seat.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [String(code)]);

    const roomRes = await client.query(`SELECT * FROM rooms WHERE code = $1 FOR UPDATE`, [code]);
    const room = roomRes.rows[0];
    if (!room) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "not_found" };
    }

    await client.query(`DELETE FROM room_members WHERE room_id = $1 AND last_seen < $2`, [room.id, staleBefore]);

    const existing = await client.query(
      `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [room.id, userId]
    );
    if (existing.rowCount) {
      await client.query(`UPDATE room_members SET last_seen = $3 WHERE room_id = $1 AND user_id = $2`, [room.id, userId, now]);
      await client.query("COMMIT");
      return { ok: true, room, alreadyMember: true };
    }

    const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM room_members WHERE room_id = $1`, [room.id]);
    const count = countRes.rows[0].count;
    const isHost = room.host_id === userId;
    if (!isHost && room.max_participants && count >= room.max_participants) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "full", count, maxParticipants: room.max_participants };
    }

    await client.query(
      `INSERT INTO room_members (room_id, user_id, joined_at, last_seen) VALUES ($1,$2,$3,$3)
       ON CONFLICT (room_id,user_id) DO UPDATE SET last_seen = EXCLUDED.last_seen`,
      [room.id, userId, now]
    );
    await client.query("COMMIT");
    return { ok: true, room, alreadyMember: false };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function touchRoomMember(code, userId) {
  await ensureSchema();
  await pool.query(
    `UPDATE room_members rm
     SET last_seen = $3
     FROM rooms r
     WHERE rm.room_id = r.id AND r.code = $1 AND rm.user_id = $2`,
    [code, userId, Date.now()]
  );
}

async function releaseRoomMember(code, userId) {
  await ensureSchema();
  await pool.query(
    `DELETE FROM room_members rm USING rooms r WHERE rm.room_id = r.id AND r.code = $1 AND rm.user_id = $2`,
    [code, userId]
  );
}

async function isActiveRoomMember(code, userId) {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT 1
     FROM room_members rm
     JOIN rooms r ON r.id = rm.room_id
     WHERE r.code = $1 AND rm.user_id = $2 AND rm.last_seen >= $3
     LIMIT 1`,
    [code, userId, Date.now() - 45_000]
  );
  return !!rows[0];
}

async function getRoomOccupancy(code) {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT r.max_participants, COUNT(rm.user_id)::int AS count
     FROM rooms r
     LEFT JOIN room_members rm ON rm.room_id = r.id AND rm.last_seen >= $2
     WHERE r.code = $1
     GROUP BY r.id`,
    [code, Date.now() - 45_000]
  );
  return rows[0] || null;
}

async function addRoomQueueItem({ code, addedBy, videoUrl, videoTitle, videoSource, movieId }) {
  await ensureSchema();
  const room = await getRoomByCode(code);
  if (!room) return null;
  const queueId = id();
  await pool.query(
    `INSERT INTO room_queue (id, room_id, added_by, video_url, video_title, video_source, movie_id, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'queued',$8)`,
    [queueId, room.id, addedBy, videoUrl, videoTitle || null, videoSource, movieId || null, Date.now()]
  );
  const item = await pool.query(`SELECT * FROM room_queue WHERE id = $1`, [queueId]);
  return item.rows[0] || null;
}

async function listRoomQueue(code) {
  await ensureSchema();
  const { rows } = await pool.query(
    `SELECT q.*, u.username AS added_by_username
     FROM room_queue q
     LEFT JOIN users u ON u.id = q.added_by
     JOIN rooms r ON r.id = q.room_id
     WHERE r.code = $1 AND q.status = 'queued'
     ORDER BY q.created_at ASC`,
    [code]
  );
  return rows;
}

async function playNextRoomQueueItem(code, hostId) {
  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const roomRes = await client.query(`SELECT * FROM rooms WHERE code = $1 FOR UPDATE`, [code]);
    const room = roomRes.rows[0];
    if (!room || room.host_id !== hostId) {
      await client.query("ROLLBACK");
      return { error: "Only the host can play the next video" };
    }

    const nextRes = await client.query(
      `SELECT * FROM room_queue WHERE room_id = $1 AND status = 'queued' ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [room.id]
    );
    const next = nextRes.rows[0];
    if (!next) {
      await client.query("ROLLBACK");
      return { error: "The queue is empty" };
    }

    const now = Date.now();
    await client.query(
      `UPDATE room_queue SET status = 'played', played_at = $2 WHERE id = $1`,
      [next.id, now]
    );
    const updatedRes = await client.query(
      `UPDATE rooms SET
        video_url = $1, video_title = $2, video_source = $3, movie_id = $4,
        current_video_url = $1, current_video_title = $2, current_video_source = $3, current_movie_id = $4
       WHERE id = $5 RETURNING *`,
      [next.video_url, next.video_title, next.video_source, next.movie_id, room.id]
    );
    await client.query("COMMIT");
    return { room: updatedRes.rows[0], item: next };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

async function removeRoomQueueItem(idValue, userId) {
  await ensureSchema();
  const { rows } = await pool.query(
    `DELETE FROM room_queue WHERE id = $1 AND added_by = $2 AND status = 'queued' RETURNING *`,
    [idValue, userId]
  );
  return rows[0] || null;
}

async function createStorageUpload({ id, ownerId, folderId, uploadLinkId = null, code, objectName, size, progressHash }) {
  await ensureSchema();
  await pool.query(
    `INSERT INTO storage_uploads (id, owner_id, folder_id, uploadlink_id, code, object_name, size, progress_hash, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, ownerId, folderId, uploadLinkId, code, objectName, size, progressHash, Date.now()]
  );
  return getStorageUpload(id, ownerId);
}

async function getStorageUpload(idValue, ownerId) {
  await ensureSchema();
  const { rows } = await pool.query(`SELECT * FROM storage_uploads WHERE id = $1 AND owner_id = $2`, [idValue, ownerId]);
  return rows[0] || null;
}

async function deleteStorageUpload(idValue, ownerId) {
  await ensureSchema();
  await pool.query(`DELETE FROM storage_uploads WHERE id = $1 AND owner_id = $2`, [idValue, ownerId]);
}

module.exports = {
  pool,
  createUser,
  getUserByEmail,
  getUserById,
  createRoom,
  getRoomByCode,
  listRoomsForUser,
  deleteRoom,
  updateRoomCapacity,
  createMovie,
  createMovieIfMissing,
  listMoviesForUser,
  getMovieById,
  deleteMovie,
  reserveRoomSeat,
  touchRoomMember,
  releaseRoomMember,
  getRoomOccupancy,
  isActiveRoomMember,
  addRoomQueueItem,
  listRoomQueue,
  playNextRoomQueueItem,
  removeRoomQueueItem,
  createStorageUpload,
  getStorageUpload,
  deleteStorageUpload,
};
