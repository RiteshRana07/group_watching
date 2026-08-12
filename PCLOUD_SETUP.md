# WatchTogether + pCloud setup

This version removes Vercel Blob/Filebase/Backblaze storage and uses pCloud's API. The browser uploads directly to a short-lived pCloud upload link so the video bytes do not pass through a Vercel Function. pCloud documents upload links (`createuploadlink`, `uploadtolink`, `uploadlinkprogress`) and server-side streaming links (`getfilelink`).

## Environment

```env
PCLOUD_API_HOST=https://api.pcloud.com
PCLOUD_ACCESS_TOKEN=YOUR_TOKEN
PCLOUD_FOLDER=/WatchTogether
```

Use `https://eapi.pcloud.com` if your pCloud account is hosted in Europe. pCloud documents two API hosts, US and Europe.

## Access token

OAuth 2.0 is the recommended approach for a server application. pCloud's docs say OAuth bearer tokens can be passed as `access_token` and currently do not expire. If you already have an OAuth access token, put it in `PCLOUD_ACCESS_TOKEN`.

For a personal/college demo, you can also generate a pCloud auth token locally using the included helper:

```bash
node scripts/get-pcloud-token.js
```

The helper asks for your pCloud email/password locally and prints a token. Do not commit the password or token. Put only the generated token into `.env.local` / Vercel environment variables.

## Folder

The server automatically creates `/WatchTogether` if it does not exist.

## Upload flow

1. Next.js creates a one-file, one-hour pCloud upload link.
2. Browser submits the MP4 directly to pCloud in a hidden iframe.
3. Browser polls `/api/storage/upload?uploadId=...`; the server reads pCloud's `uploadlinkprogress`.
4. When complete, the server finds the uploaded file, stores `pcloud:<fileid>` in PostgreSQL, and deletes the temporary upload link.
5. My Library generates a fresh pCloud content URL when needed.

This avoids the Vercel Function request-body limit.

## Video playback

The app stores only the pCloud file ID reference in PostgreSQL. For playback, the server calls pCloud `getfilelink` and returns the short-lived content URL. Room records therefore remain stable after refresh while the playback URL can expire safely.

## Notes

- pCloud's API docs describe `getfilelink`/`getvideolink` as server-side API methods; this project calls them from Next.js, not directly from browser JavaScript.
- pCloud free-account storage/traffic limits still apply.
- The app caps individual videos at 3 GB.
