"use client";
import { useEffect, useRef, useState } from "react";
const { extractYouTubeId } = require("../lib/youtube");

const EMOJIS = ["❤️", "😂", "😮", "👏", "🔥"];
const URL_PATTERN = /(https?:\/\/[^\s]+)/i;

export default function Chat({
  channel,
  broadcast,
  username,
  userId,
  participants,
  isHost,
  controllers,
  onGrantControl,
  onAddToQueue,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [showParticipants, setShowParticipants] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!channel) return;

    function onMessage(m) {
      setMessages((prev) => {
        // If this is our own message coming back over the wire, we've
        // already shown it optimistically — skip the duplicate.
        if (m.clientId && prev.some((x) => x.clientId === m.clientId)) return prev;
        return [...prev, { type: "message", ...m }];
      });
    }
    function onMemberAdded(member) {
      setMessages((prev) => [
        ...prev,
        { type: "system", text: `${member.info.username} joined the room`, at: Date.now() },
      ]);
    }
    function onMemberRemoved(member) {
      setMessages((prev) => [
        ...prev,
        { type: "system", text: `${member.info.username} left the room`, at: Date.now() },
      ]);
    }

    channel.bind("chat:message", onMessage);
    channel.bind("pusher:member_added", onMemberAdded);
    channel.bind("pusher:member_removed", onMemberRemoved);

    return () => {
      channel.unbind("chat:message", onMessage);
      channel.unbind("pusher:member_added", onMemberAdded);
      channel.unbind("pusher:member_removed", onMemberRemoved);
    };
  }, [channel]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !broadcast) return;

    const clientId = Math.random().toString(36).slice(2);
    const payload = { message: text, username, clientId };

    // Show it immediately for the sender rather than waiting on a round
    // trip through Pusher — the channel echo (if it arrives) is deduped above.
    setMessages((prev) => [...prev, { type: "message", ...payload }]);
    broadcast("chat:message", payload);
    setInput("");
  }

  return (
    <div className="flex flex-col h-full bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setShowParticipants((s) => !s)}
        className="px-4 py-3 border-b border-neutral-800 text-sm text-neutral-400 text-left hover:bg-neutral-850"
      >
        {participants.length} watching
        {participants.length > 0 && (
          <span className="text-neutral-600"> · {showParticipants ? "hide" : "show"} list</span>
        )}
      </button>

      {showParticipants && (
        <div className="px-4 py-2 border-b border-neutral-800 space-y-1.5 max-h-40 overflow-y-auto">
          {participants.map((p) => {
            const canControl = p.isHost || controllers?.has(p.id);
            return (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5">
                  {p.username}
                  {p.isHost && (
                    <span className="text-[9px] uppercase bg-accent/20 text-accent px-1.5 py-0.5 rounded-full">
                      Host
                    </span>
                  )}
                  {!p.isHost && canControl && (
                    <span className="text-[9px] uppercase bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded-full">
                      Co-host
                    </span>
                  )}
                </span>
                {isHost && !p.isHost && p.id !== userId && (
                  <button
                    onClick={() => onGrantControl?.(p.id, !canControl)}
                    className="text-accent hover:underline"
                  >
                    {canControl ? "Remove co-host" : "Make co-host"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 text-sm">
        {messages.map((m, i) => {
          if (m.type === "system") {
            return (
              <p key={i} className="text-xs text-neutral-500 italic">
                {m.text}
              </p>
            );
          }

          const urlMatch = m.message.match(URL_PATTERN);
          const youtubeId = urlMatch ? extractYouTubeId(urlMatch[1]) : null;

          return (
            <div key={i}>
              <p>
                <span className="text-accent font-medium">{m.username}: </span>
                <span className="text-neutral-200">{m.message}</span>
              </p>
              {youtubeId && (
                <button
                  onClick={() => onAddToQueue?.(urlMatch[1])}
                  className="mt-1 text-xs px-2.5 py-1 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
                >
                  ➕ Add to queue
                </button>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="px-4 py-2 flex gap-2 border-t border-neutral-800">
        {EMOJIS.map((e) => (
          <button
            key={e}
            onClick={() => broadcast?.("reaction:show", { emoji: e })}
            className="text-lg hover:scale-125 transition-transform"
          >
            {e}
          </button>
        ))}
      </div>

      <form onSubmit={sendMessage} className="p-3 border-t border-neutral-800 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something..."
          className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm"
        />
        <button className="px-3 py-1.5 bg-accent rounded-lg text-sm">Send</button>
      </form>
    </div>
  );
}
