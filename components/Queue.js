"use client";
import { useEffect, useState } from "react";

export default function Queue({ code, channel, isHost }) {
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);

  async function loadQueue() {
    try {
      const res = await fetch(`/api/rooms/${code}/queue`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setQueue(data.queue || []);
    } catch {}
  }

  useEffect(() => {
    loadQueue();
    if (!channel) return;
    const refresh = () => loadQueue();
    channel.bind("room:queue-changed", refresh);
    return () => channel.unbind("room:queue-changed", refresh);
  }, [code, channel]);

  async function playNext() {
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${code}/queue/next`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Couldn't play the next video");
      else await loadQueue();
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id) {
    await fetch(`/api/rooms/${code}/queue?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    loadQueue();
  }

  if (!queue.length && !isHost) return null;

  return (
    <div className="mt-4 rounded-xl bg-neutral-900 border border-neutral-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold">Up next</h2>
          <p className="text-xs text-neutral-500">The original room video stays fixed; queued videos play after it.</p>
        </div>
        {isHost && queue.length > 0 && (
          <button
            onClick={playNext}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg bg-accent font-medium disabled:opacity-50"
          >
            {busy ? "Starting..." : "▶ Play next"}
          </button>
        )}
      </div>

      {queue.length === 0 ? (
        <p className="text-xs text-neutral-600">No videos queued yet.</p>
      ) : (
        <div className="space-y-2">
          {queue.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-lg bg-neutral-950 px-3 py-2">
              <span className="text-xs text-neutral-600 w-4">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">{item.video_title || item.playable_video_url || item.video_url}</p>
                <p className="text-[11px] text-neutral-600">added by {item.added_by_username || "viewer"}</p>
              </div>
              <button onClick={() => removeItem(item.id)} className="text-xs text-neutral-600 hover:text-red-400">Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
