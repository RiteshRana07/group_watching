# pCloud upload setup for WatchTogether

This version no longer calls pCloud's `createuploadlink` API. Your account was returning pCloud error `1000` from that API even though normal authenticated pCloud APIs and `uploadfile` work.

Instead, the app uses a **pCloud File Request** created once in the pCloud web UI. The browser uploads directly to pCloud through that request, so large videos do not pass through the Next.js/Vercel server.

## 1. Create the destination folder

In pCloud, create/use:

`/WatchTogether`

You already have this folder.

## 2. Create a File Request

1. Open pCloud web.
2. Open the `/WatchTogether` folder.
3. Open the folder's three-dot menu.
4. Choose **Request files**.
5. Create the request.
6. Keep the request active.
7. If pCloud lets you set an upload limit or file limit, set it high enough for your intended use and storage quota.

pCloud calls these **File Requests**. They are designed for receiving files directly into a selected folder and do not require the uploader to have a pCloud account.

## 3. Copy the request URL or code

The generated link normally looks like a pCloud request URL containing a `code` value. You can paste either:

- the raw request code, or
- the complete File Request URL

into `PCLOUD_UPLOAD_LINK_CODE`.

## 4. Configure `.env.local`

Copy `.env.example` to `.env.local` if needed and set:

```env
PCLOUD_API_HOST=https://api.pcloud.com
PCLOUD_ACCESS_TOKEN=your_existing_pcloud_access_token
PCLOUD_FOLDER=/WatchTogether
PCLOUD_FOLDER_ID=your_watchtogether_folder_id
PCLOUD_UPLOAD_LINK_CODE=paste_the_file_request_code_or_full_url_here
```

Do not commit `.env.local` or expose `PCLOUD_ACCESS_TOKEN` to the browser.

## 5. Database

On the next application request, the app automatically migrates `storage_uploads.uploadlink_id` to allow NULL. No manual SQL migration command is required.

## 6. Start the application

```powershell
npm install
npm run dev
```

Then open the Library page, choose a video, enter its title, and click **Add to library**.

## 7. Upload flow

```text
Browser
  |
  | POST /api/storage/upload (init metadata only)
  v
Next.js
  |
  | returns the pCloud File Request upload URL
  v
Browser --------------------> pCloud File Request
        direct video upload
                 |
                 v
          /WatchTogether
                 |
                 v
        browser upload progress
                 |
                 v
          finalize + fileid
                 |
                 v
           PostgreSQL movie
```

The video itself is not sent through the Next.js API route. This is important for Vercel deployments because Vercel Functions have a 4.5 MB request-body limit; direct client-to-storage uploads avoid that serverless request path.

## 8. Progress display

The Library page uses the browser's `XMLHttpRequest.upload.onprogress` event while the video is being sent directly to pCloud. It displays:

`X.X MB / Y.Y MB (percent%)`

The app does **not** call pCloud's `uploadlinkprogress` endpoint for File Request uploads, avoiding the `1900 Upload not found` error seen with that endpoint in this setup.


## 9. Important limitation

The File Request is shared infrastructure for this application. Every upload is placed into `/WatchTogether`, and the app uses a unique generated object name for each upload so concurrent users do not overwrite each other's files.

If you delete or expire the File Request in pCloud, uploads will stop until you create another request and update `PCLOUD_UPLOAD_LINK_CODE`.


## Important: File Request progress
The app uses the browser's XMLHttpRequest upload progress events for MB/MB progress. It does not call pCloud's `uploadlinkprogress` endpoint, because that endpoint can return error 1900 for File Request uploads. The File Request URL/code is used only for `uploadtolink`.
