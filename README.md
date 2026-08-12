# WatchTogether

A Next.js watch-party application with authentication, PostgreSQL persistence, Pusher realtime sync, YouTube/direct video support, room capacity controls, and a multi-video queue.

## Storage

This version uses **pCloud S3-compatible object storage** instead of pCloud.

See `PCLOUD_SETUP.md` for:

- pCloud bucket setup
- Access keys
- Vercel environment variables
- CORS configuration
- Upload limits and multipart behavior

### Upload behavior

- `< 100 MB`: direct pre-signed PUT with browser progress.
- `100 MB–3 GB`: 16 MB multipart parts, up to 3 concurrent uploads, retrying failed parts.
- The browser never receives the pCloud secret key.
- PostgreSQL stores a stable `pcloud:<file-id>` reference.
- Private bucket playback uses fresh pre-signed GET URLs.

## Database

Set `DATABASE_URL` to a PostgreSQL database. The app creates/migrates its tables on first use.

## Realtime

Set the Pusher variables in `.env.local`/Vercel environment variables.

## Local development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Only upload or share content you own or have permission to share.
