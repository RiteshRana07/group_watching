"use client";
import { useEffect, useRef, useState } from "react";

const DRIFT_TOLERANCE = 0.8;
const REMOTE_GUARD_MS = 1200;

export default function VideoPlayer({ videoUrl, channel, broadcast, canControl }) {
  const videoRef = useRef(null);
  const remoteGuardUntil = useRef(0);
  const buffering = useRef(false);
  const intendedPlaying = useRef(false);
  const [reactions, setReactions] = useState([]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.load();
  }, [videoUrl]);

  function markRemote() {
    remoteGuardUntil.current = Date.now() + REMOTE_GUARD_MS;
  }

  function emit(action) {
    if (!canControl || !broadcast || Date.now() < remoteGuardUntil.current) return;
    const video = videoRef.current;
    if (!video) return;
    intendedPlaying.current = action === "play";
    broadcast("player:action", { action, time: video.currentTime });
  }

  useEffect(() => {
    if (!channel) return;
    const video = videoRef.current;
    if (!video) return;

    function applySync({ time, playing }) {
      if (!video || !Number.isFinite(time)) return;
      markRemote();
      if (Math.abs(video.currentTime - time) > DRIFT_TOLERANCE) video.currentTime = time;
      intendedPlaying.current = !!playing;
      if (playing && video.paused && !buffering.current) video.play().catch(() => {});
      if (!playing && !video.paused) video.pause();
    }

    function onAction({ action, time }) {
      if (!video) return;
      markRemote();
      if (Number.isFinite(time) && Math.abs(video.currentTime - time) > DRIFT_TOLERANCE) {
        video.currentTime = time;
      }
      if (action === "play") video.play().catch(() => {});
      if (action === "pause") video.pause();
    }

    function onRequestSync() {
      if (!canControl || !broadcast || !video) return;
      broadcast("player:heartbeat", { time: video.currentTime, playing: intendedPlaying.current });
    }

    function onHeartbeat(data) {
      applySync(data);
    }

    function onReaction({ emoji }) {
      const id = Math.random().toString(36).slice(2);
      setReactions((r) => [...r, { id, emoji, left: 10 + Math.random() * 80 }]);
      setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2000);
    }

    channel.bind("player:action", onAction);
    channel.bind("player:heartbeat", onHeartbeat);
    channel.bind("player:request-sync", onRequestSync);
    channel.bind("reaction:show", onReaction);

    // A new joiner gets a state request immediately instead of waiting for the
    // next heartbeat interval.
    if (video.readyState >= 1) {
      broadcast?.("player:request-sync", {});
    } else {
      video.addEventListener("loadedmetadata", onRequestSync, { once: true });
    }

    return () => {
      channel.unbind("player:action", onAction);
      channel.unbind("player:heartbeat", onHeartbeat);
      channel.unbind("player:request-sync", onRequestSync);
      channel.unbind("reaction:show", onReaction);
      video.removeEventListener("loadedmetadata", onRequestSync);
    };
  }, [channel, broadcast, canControl, videoUrl]);

  useEffect(() => {
    if (!broadcast || !canControl) return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      if (!video || Date.now() < remoteGuardUntil.current) return;
      broadcast("player:heartbeat", { time: video.currentTime, playing: intendedPlaying.current });
    }, 2000);
    return () => clearInterval(interval);
  }, [broadcast, canControl]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-black shadow-2xl shadow-black/50">
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        preload="metadata"
        className="w-full aspect-video"
        onWaiting={() => { buffering.current = true; }}
        onPlaying={() => {
          buffering.current = false;
          if (Date.now() >= remoteGuardUntil.current) { intendedPlaying.current = true; emit("play"); }
        }}
        onPause={() => {
          if (buffering.current || Date.now() < remoteGuardUntil.current) return;
          intendedPlaying.current = false;
          emit("pause");
        }}
        onSeeked={() => {
          if (Date.now() < remoteGuardUntil.current) return;
          emit("seek");
        }}
      />
      {!canControl && (
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur text-xs text-neutral-300 pointer-events-none">
          🔒 Host controls playback
        </div>
      )}
      {reactions.map((r) => (
        <span key={r.id} className="absolute bottom-10 text-3xl animate-bounce pointer-events-none" style={{ left: `${r.left}%` }}>
          {r.emoji}
        </span>
      ))}
    </div>
  );
}
