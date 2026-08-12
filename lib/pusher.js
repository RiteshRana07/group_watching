// Replaces the old Socket.io custom server. Vercel (and serverless hosts
// generally) can't hold a long-lived WebSocket connection open inside a
// function, so instead: clients POST an action to our API, we relay it
// through Pusher, and every other client in the room receives it over a
// Pusher WebSocket connection (Pusher hosts that persistent connection for us).
const Pusher = require("pusher");

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.PUSHER_CLUSTER,
  useTLS: true,
});

module.exports = pusher;
