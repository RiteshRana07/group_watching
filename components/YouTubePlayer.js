"use client";
import { useEffect, useRef, useState } from "react";

const DRIFT_TOLERANCE = 1.5;
const REMOTE_GUARD_MS = 1200;
let apiLoadPromise;

function loadYouTubeAPI() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(); };
  });
  return apiLoadPromise;
}

export default function YouTubePlayer({ videoId, channel, broadcast, canControl }) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const ready = useRef(false);
  const remoteGuardUntil = useRef(0);
  const lastState = useRef(null);
  const [reactions, setReactions] = useState([]);
  const canControlRef = useRef(canControl);

  useEffect(() => { canControlRef.current = canControl; }, [canControl]);

  function markRemote() { remoteGuardUntil.current = Date.now() + REMOTE_GUARD_MS; }

  useEffect(() => {
    let destroyed = false;
    loadYouTubeAPI().then(() => {
      if (destroyed || !containerRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1, iv_load_policy: 3 },
        events: {
          onReady: () => {
            ready.current = true;
            lastState.current = null;
            broadcast?.("player:request-sync", {});
          },
          onStateChange: (e) => {
            if (!ready.current || !broadcast || !canControlRef.current || Date.now() < remoteGuardUntil.current) return;
            const p = playerRef.current;
            if (!p) return;
            const state = e.data;
            if (state === window.YT.PlayerState.PLAYING) {
              if (lastState.current !== "playing") broadcast("player:action", { action: "play", time: p.getCurrentTime() });
              lastState.current = "playing";
            } else if (state === window.YT.PlayerState.PAUSED) {
              if (lastState.current !== "paused") broadcast("player:action", { action: "pause", time: p.getCurrentTime() });
              lastState.current = "paused";
            }
          },
        },
      });
    });
    return () => {
      destroyed = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
      ready.current = false;
    };
    // Mount the iframe once. Video changes are handled by loadVideoById below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !ready.current || !videoId || typeof p.loadVideoById !== "function") return;
    markRemote();
    lastState.current = null;
    p.loadVideoById(videoId);
  }, [videoId]);

  useEffect(() => {
    if (!channel) return;

    function applySync({ time, playing }) {
      const p = playerRef.current;
      if (!p || !ready.current || !Number.isFinite(time)) return;
      markRemote();
      const current = p.getCurrentTime();
      if (Math.abs(current - time) > DRIFT_TOLERANCE) p.seekTo(time, true);
      const state = p.getPlayerState();
      lastState.current = playing ? "playing" : "paused";
      if (playing && state !== window.YT.PlayerState.PLAYING) p.playVideo();
      if (!playing && state === window.YT.PlayerState.PLAYING) p.pauseVideo();
    }

    function onAction({ action, time }) {
      const p = playerRef.current;
      if (!p || !ready.current) return;
      markRemote();
      if (Number.isFinite(time) && Math.abs(p.getCurrentTime() - time) > DRIFT_TOLERANCE) p.seekTo(time, true);
      if (action === "play") p.playVideo();
      if (action === "pause") p.pauseVideo();
    }

    function onRequestSync() {
      const p = playerRef.current;
      if (!p || !ready.current || !canControlRef.current || !broadcast) return;
      broadcast("player:heartbeat", {
        time: p.getCurrentTime(),
        playing: lastState.current === "playing",
      });
    }

    function onReaction({ emoji }) {
      const id = Math.random().toString(36).slice(2);
      setReactions((r) => [...r, { id, emoji, left: 10 + Math.random() * 80 }]);
      setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2000);
    }

    channel.bind("player:action", onAction);
    channel.bind("player:heartbeat", applySync);
    channel.bind("player:request-sync", onRequestSync);
    channel.bind("reaction:show", onReaction);
    if (ready.current) broadcast?.("player:request-sync", {});

    return () => {
      channel.unbind("player:action", onAction);
      channel.unbind("player:heartbeat", applySync);
      channel.unbind("player:request-sync", onRequestSync);
      channel.unbind("reaction:show", onReaction);
    };
  }, [channel, broadcast, videoId]);

  useEffect(() => {
    if (!broadcast || !canControl) return;
    const interval = setInterval(() => {
      const p = playerRef.current;
      if (!p || !ready.current || Date.now() < remoteGuardUntil.current) return;
      broadcast("player:heartbeat", {
        time: p.getCurrentTime(),
        playing: lastState.current === "playing",
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [broadcast, canControl]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-2xl shadow-black/50">
      <div ref={containerRef} className="w-full h-full" />
      {!canControl && (
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-xs text-neutral-300 pointer-events-none">
          🔒 Host controls playback
        </div>
      )}
      {reactions.map((r) => (
        <span key={r.id} className="absolute bottom-10 text-3xl animate-bounce pointer-events-none" style={{ left: `${r.left}%` }}>{r.emoji}</span>
      ))}
    </div>
  );
}
