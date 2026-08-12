const readline = require("readline");
const crypto = require("crypto");

const host = process.env.PCLOUD_API_HOST || "https://api.pcloud.com";

function ask(question, hidden = false) {
  if (!hidden) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); }));
  }
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    const onData = (char) => {
      char = char.toString();
      if (char === "\n" || char === "\r") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(answer);
      } else if (char === "\u0003") {
        process.exit(1);
      } else if (char === "\u007f") {
        answer = answer.slice(0, -1);
      } else {
        answer += char;
      }
    };
    let answer = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

(async () => {
  const username = await ask("pCloud email: ");
  const password = await ask("pCloud password: ", true);
  const url = new URL(`${host.replace(/\/$/, "")}/userinfo`);
  url.searchParams.set("username", username);
  url.searchParams.set("password", password);
  url.searchParams.set("getauth", "1");
  url.searchParams.set("logout", "1");
  url.searchParams.set("device", `WatchTogether-${crypto.randomUUID()}`);
  url.searchParams.set("authexpire", "63072000");
  url.searchParams.set("authinactiveexpire", "5356800");

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || Number(data.result) !== 0 || !data.auth) {
    console.error(`pCloud authentication failed: ${data.error || data.result || response.status}`);
    process.exit(1);
  }
  console.log("\nPCLOUD_API_HOST=" + host);
  console.log("PCLOUD_ACCESS_TOKEN=" + data.auth);
  console.log("\nPut the token in .env.local or Vercel Environment Variables. Do not commit it.\n");
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
