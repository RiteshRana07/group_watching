// Pulls the 11-character video ID out of any common YouTube URL shape.
// Returns null if the URL isn't a recognizable YouTube link.
function extractYouTubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/live/")) return u.pathname.split("/")[2] || null;
    }

    return null;
  } catch {
    return null;
  }
}

module.exports = { extractYouTubeId };
