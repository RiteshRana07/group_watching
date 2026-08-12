require("dotenv").config({ path: ".env.local" });

const https = require("https");

const clientId = process.env.PCLOUD_CLIENT_ID;
const clientSecret = process.env.PCLOUD_CLIENT_SECRET;

const code = process.argv[2];

if (!clientId) {
  console.error("Missing PCLOUD_CLIENT_ID");
  process.exit(1);
}

if (!clientSecret) {
  console.error("Missing PCLOUD_CLIENT_SECRET");
  process.exit(1);
}

if (!code) {
  console.error("Usage: node scripts/pcloud-token.js YOUR_ACCESS_CODE");
  process.exit(1);
}

async function main() {
  const url = new URL("https://api.pcloud.com/oauth2_token");

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("code", code);

  console.log("Exchanging pCloud authorization code...");

  const response = await fetch(url);

  const data = await response.json();

  console.log(JSON.stringify(data, null, 2));

  if (Number(data.result) !== 0) {
    console.error("pCloud token exchange failed.");
    process.exit(1);
  }

  console.log("\nSUCCESS");
  console.log("pCloud user ID:", data.uid);
  console.log("Access token received:", Boolean(data.access_token));

  console.log("\nAdd this to .env.local:");
  console.log(`PCLOUD_ACCESS_TOKEN=${data.access_token}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});