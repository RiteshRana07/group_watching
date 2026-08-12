import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return new NextResponse(
      `pCloud authorization failed: ${error}`,
      { status: 400 }
    );
  }

  if (!code) {
    return new NextResponse(
      "Missing pCloud authorization code.",
      { status: 400 }
    );
  }

  const clientId = process.env.PCLOUD_CLIENT_ID;
  const clientSecret = process.env.PCLOUD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new NextResponse(
      "Missing PCLOUD_CLIENT_ID or PCLOUD_CLIENT_SECRET in .env.local",
      { status: 500 }
    );
  }

  try {
    const tokenUrl = new URL(
      "https://api.pcloud.com/oauth2_token"
    );

    tokenUrl.searchParams.set("client_id", clientId);
    tokenUrl.searchParams.set("client_secret", clientSecret);
    tokenUrl.searchParams.set("code", code);

    const response = await fetch(tokenUrl.toString(), {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok || data.result !== 0) {
      return new NextResponse(
        `pCloud token exchange failed: ${
          data.error || JSON.stringify(data)
        }`,
        { status: 400 }
      );
    }

    /*
     * IMPORTANT:
     * Do not expose the access token in the browser.
     *
     * For this setup we display it once so you can copy it
     * into .env.local. Remove this route or change the response
     * after setup is complete.
     */

    return new NextResponse(
      `
      <html>
        <head>
          <title>pCloud Authorization Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              background: #111;
              color: white;
            }

            .box {
              max-width: 800px;
              margin: auto;
              padding: 30px;
              background: #222;
              border-radius: 12px;
            }

            code {
              display: block;
              padding: 15px;
              margin-top: 10px;
              background: #000;
              border-radius: 8px;
              word-break: break-all;
            }

            .success {
              color: #4ade80;
            }

            .warning {
              color: #fbbf24;
            }
          </style>
        </head>

        <body>
          <div class="box">
            <h1 class="success">
              ✓ pCloud Authorization Successful
            </h1>

            <p>Your pCloud application has been authorized.</p>

            <h3>Access Token</h3>

            <code>${data.access_token}</code>

            <p class="warning">
              Copy this token into your .env.local file.
              Do not share it with anyone.
            </p>

            <p>
              After saving the token, restart your Next.js server.
            </p>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      }
    );
  } catch (err) {
    console.error("pCloud OAuth error:", err);

    return new NextResponse(
      `Internal OAuth error: ${err.message}`,
      { status: 500 }
    );
  }
}