"use client";
import Pusher from "pusher-js";

let client;

// One Pusher connection per browser tab, reused across components.
export function getPusherClient() {
  if (!client) {
    client = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      channelAuthorization: {
        endpoint: "/api/pusher/auth",
        transport: "ajax",
      },
    });
  }
  return client;
}
