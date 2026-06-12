# StreamYT Frontend Plan

Stack: **React 18 + Vite + React Router + TanStack Query + Axios + Tailwind CSS**

This plan is derived from a line-by-line scan of the backend (`src/app.js`, all routes, controllers, middlewares, validators, models, and cookie utilities). Every constraint below is something the backend actually enforces.

---

## 0. Backend Facts the Frontend Must Respect

### 0.1 Auth & cookies (critical)

- Login sets **httpOnly** `accessToken` and `refreshToken` cookies with `sameSite: "strict"` (`src/utils/cookieOptions.js`). JS can never read these tokens.
- `sameSite: "strict"` means **cookies are NOT sent on cross-origin requests at all** — even with `cors({ credentials: true })`. A frontend on `localhost:5173` calling `localhost:8000` directly will authenticate the login response but every later request will be anonymous.
  - **Solution (dev):** Vite proxy — frontend calls `/api/v1/...` on its own origin, Vite forwards to the backend. Requests are same-origin, cookies work.
  - **Solution (prod):** serve the built frontend from the same domain as the API (Express `app.use(express.static(...))` or a reverse proxy like Nginx).
- `verifyJWT` also accepts `Authorization: Bearer <token>` — irrelevant for us since tokens are httpOnly; **the cookie path is the only path**.
- **Register does NOT log the user in** — `registerUser` returns 201 with the user object but sets no cookies. After successful registration, redirect to the login page.
- **Refresh flow:** `POST /users/refresh-token` reads the `refreshToken` cookie, rotates it (old one is invalidated), and sets both cookies again. Response body contains no tokens.
- **Refresh-token reuse detection:** if the backend sees an old (already-rotated) refresh token, it **revokes the session entirely** (`user.refreshToken = undefined`). Consequence: if the frontend fires two refresh calls concurrently, the second one logs the user out. The Axios interceptor MUST single-flight refreshes (one shared in-flight promise).
- **Change password** (`POST /users/change-password`) revokes the refresh token server-side and clears only the `refreshToken` cookie. The access token cookie survives until expiry, after which refresh will fail. Frontend should treat password change as a forced logout: clear client auth state and redirect to login.
- Auth routes (`/register`, `/login`, `/refresh-token`) are rate-limited: **20 requests / 15 min / IP**, returning `429 { message: "Too many requests, please try again later" }`. Show this message verbatim and disable the submit button briefly.

### 0.2 Response envelope

Success:
```json
{ "statusCode": 200, "data": { ... }, "message": "...", "success": true }
```
Error (from the global handler in `app.js`):
```json
{ "success": false, "statusCode": 400, "message": "...", "errors": [] }
```
Validation failures come as a single `400` message: `"Validation Failed: <messages joined by comma>"`.

### 0.3 Pagination shape

All list endpoints use `mongoose-aggregate-paginate-v2`. `data` looks like:
```json
{
  "docs": [...], "totalDocs": 42, "limit": 10, "page": 1,
  "totalPages": 5, "hasNextPage": true, "hasPrevPage": false,
  "nextPage": 2, "prevPage": null, "pagingCounter": 1
}
```
Server clamps `limit` to **max 50** and `page` to **max 1000** (`src/utils/pagination.js`).

### 0.4 Upload constraints (validate client-side BEFORE submitting)

| Field | Types | Max size |
|---|---|---|
| `avatar`, `coverImage`, `thumbnail` (standalone update) | jpeg, png, webp, gif | 5 MB |
| `videoFile` + `thumbnail` (on publish) | mp4, webm, ogg, mov, mkv (video); image types for thumbnail | 100 MB (applies to both fields on publish) |

- The server verifies actual file signatures (magic bytes), so a renamed file is rejected with `400 File "<name>" does not match its declared type`.
- On multipart routes, files upload to the server **before** Zod validates text fields — a failed validation wastes the whole upload. Mirror all validation rules client-side first.
- JSON bodies are capped at **16 kb** — never send base64 images via JSON.

### 0.5 Field validation rules (mirror these in forms)

- `username`: 3–20 chars, `[a-zA-Z0-9_]` only, lowercased by server
- `fullname`: 3–50 chars (HTML stripped server-side)
- `email`: valid email, lowercased
- `password`: 8–64 chars, at least one digit AND one of `!@#$%^&*`
- video `title`: 3–100 chars; `description`: 1–5000 chars (required on publish)
- comment `content`: 1–1000 chars
- tweet `content`: 1–280 chars
- playlist `name`: 1–100 chars; `description`: optional, max 500
- login: password required + at least one of username/email

### 0.6 Behavioral details that affect UI

- `GET /videos/:videoId` **increments the view count and pushes to watch history on every non-owner fetch**. In dev, React StrictMode double-mounts will double-count views; TanStack Query's cache (`staleTime`) prevents refetch storms — set a generous `staleTime` on the video detail query and never refetch-on-window-focus for it.
- The video detail response contains **no like count and no `isLiked` flag**. Same for comments and tweets. The like toggle endpoints only return `{ liked: boolean }` *after* toggling. (See "Backend gaps" below.)
- `GET /videos` only ever returns **published** videos — even for the owner. The owner's full list (including unpublished/drafts) comes from `GET /dashboard/videos`.
- Channel profile `GET /users/channel/:username` returns `subscribersCount`, `channelsSubscribedToCount`, `isSubscribed` (correct when the viewer is logged in, thanks to `verifyJWTOptional`), and includes `email` only when viewing your own channel.
- Subscribing to your own channel returns `400 You cannot subscribe to your own channel` — hide the button on your own channel.
- Toggle endpoints (`like`, `subscription`) are idempotent-safe on the backend (duplicate-key handled), so optimistic UI with rollback is safe.
- Deleting a video cascades server-side (comments, likes, playlist entries, watch-history) — after delete, invalidate every video-related query.
- `GET /users/me` returns the user **including `watchHistory` as an array of raw video IDs** (only `password`/`refreshToken` are excluded).
- Healthcheck: `GET /api/v1/healthcheck` → 200 (db connected) or 503.

### 0.7 Backend gaps — RESOLVED (implemented + tested)

The gaps found during the original scan have been fixed in the backend:

1. ✅ **`GET /users/history`** (auth required) — paginated watch history, most-recently-watched first, owner populated, unpublished/deleted videos excluded. Standard pagination envelope.
2. ✅ **`likesCount` + `isLiked` on `GET /videos/:videoId`** — `isLiked` is `false` for anonymous viewers.
3. ✅ **`likesCount` + `isLiked` on every doc from `GET /comments/:videoId` and `GET /tweets/user/:userId`** — the tweets route now runs `verifyJWTOptional` so `isLiked` works when logged in.

Still intentionally missing (build UI without them):

- **No "remove from watch history" / "clear history"** endpoint — History page is read-only for now.
- **No aggregated subscriptions feed** — the Subscriptions page shows followed channels, not their combined videos.

---

## 1. Full API Inventory (base: `/api/v1`)

| Method & path | Auth | Body / notes |
|---|---|---|
| GET `/healthcheck` | — | |
| POST `/users/register` | — (rate-limited) | multipart: `avatar` (req), `coverImage` (opt), `fullname`, `email`, `username`, `password`. 201; **no cookies**. 409 if email/username taken |
| POST `/users/login` | — (rate-limited) | JSON `{ username? , email?, password }`. Sets both cookies. `data.user` |
| POST `/users/refresh-token` | refresh cookie (rate-limited) | Rotates cookies. Empty `data` |
| POST `/users/logout` | ✅ | Clears cookies |
| POST `/users/change-password` | ✅ | `{ oldPassword, newPassword, confirmPassword }`. Revokes refresh token |
| GET `/users/me` | ✅ | Current user |
| GET `/users/history` | ✅ | Paginated watch history, newest-watched first, owner populated |
| PATCH `/users/update-account` | ✅ | `{ fullname, email }` (both required). 409 on email conflict |
| PATCH `/users/avatar` | ✅ | multipart single `avatar` |
| PATCH `/users/cover-image` | ✅ | multipart single `coverImage` |
| GET `/users/channel/:username` | optional | Channel profile + counts + `isSubscribed` |
| GET `/videos` | — | `?query&sortBy(createdAt\|views\|duration\|title)&sortType(asc\|desc)&userId&page&limit`. Published only |
| POST `/videos` | ✅ | multipart `videoFile`+`thumbnail` + `title`, `description`. 201 |
| GET `/videos/:videoId` | optional | Increments views (non-owner). Owner can see own unpublished. Includes `likesCount` + `isLiked` |
| PATCH `/videos/:videoId` | ✅ owner | multipart: optional `thumbnail`, `title`, `description`. 403 if not owner |
| DELETE `/videos/:videoId` | ✅ owner | Cascades |
| PATCH `/videos/:videoId/toggle-publish` | ✅ owner | |
| GET `/comments/:videoId` | optional | Paginated, newest first, owner populated, `likesCount` + `isLiked` per doc |
| POST `/comments/:videoId` | ✅ | `{ content }`. 201. **Returned comment has un-populated owner** — invalidate list instead of appending raw |
| PATCH `/comments/c/:commentId` | ✅ owner | `{ content }` |
| DELETE `/comments/c/:commentId` | ✅ owner | |
| POST `/likes/toggle/v/:videoId` | ✅ | → `{ liked }` |
| POST `/likes/toggle/c/:commentId` | ✅ | → `{ liked }` |
| POST `/likes/toggle/t/:tweetId` | ✅ | → `{ liked }` |
| GET `/likes/videos` | ✅ | Paginated liked (published) videos |
| POST `/subscriptions/c/:channelId` | ✅ | → `{ subscribed }`. 400 on own channel |
| GET `/subscriptions/c/:channelId` | — | Channel's subscribers, paginated |
| GET `/subscriptions/u/:subscriberId` | — | Channels a user follows, paginated |
| POST `/playlists` | ✅ | `{ name, description? }`. 201 |
| GET `/playlists/user/:userId` | — | Paginated, includes `videoCount`; optional `?videoId=` adds a `hasVideo` membership flag per playlist |
| GET `/playlists/:playlistId` | optional | Videos populated; unpublished hidden from non-owners |
| PATCH `/playlists/:playlistId` | ✅ owner | `{ name?, description? }` |
| DELETE `/playlists/:playlistId` | ✅ owner | |
| PATCH `/playlists/:playlistId/videos/:videoId` | ✅ owner | Add video (`$addToSet` — no duplicates) |
| DELETE `/playlists/:playlistId/videos/:videoId` | ✅ owner | Remove video |
| POST `/tweets` | ✅ | `{ content }`. 201 |
| GET `/tweets/user/:userId` | optional | Paginated, owner populated, `likesCount` + `isLiked` per doc |
| PATCH `/tweets/:tweetId` | ✅ owner | `{ content }` |
| DELETE `/tweets/:tweetId` | ✅ owner | |
| GET `/dashboard/stats` | ✅ | `{ totalVideos, totalViews, totalSubscribers, totalLikes }` |
| GET `/dashboard/videos` | ✅ | Own videos incl. unpublished, paginated |

---

## Phase 1 — Project Setup & API Foundation

**Goal: a running app whose every future request authenticates correctly.**

1. Scaffold: `npm create vite@latest client -- --template react` (inside the repo, `client/` folder). Install: `react-router-dom`, `@tanstack/react-query`, `axios`, `tailwindcss`, `react-hook-form`, `zod`, `@hookform/resolvers`.
2. **Vite proxy** (the cookie linchpin):
   ```js
   // vite.config.js
   server: { proxy: { "/api": { target: "http://localhost:8000", changeOrigin: false } } }
   ```
   Backend `.env`: set `CORS_ORIGIN=http://localhost:5173` (belt-and-suspenders; with the proxy, requests are same-origin anyway).
3. **Axios instance** (`src/api/client.js`):
   - `baseURL: "/api/v1"`, `withCredentials: true`.
   - Response interceptor: unwrap `response.data.data`; normalize errors to `{ statusCode, message }`.
   - **401 handling:** on 401 (except for `/users/login`, `/users/refresh-token`, `/users/logout`), call refresh **through a single shared promise** (module-level `let refreshPromise = null`), then retry the original request once. If refresh fails: clear auth state, redirect to `/login`. Never loop.
4. **TanStack Query setup:** `QueryClientProvider`; defaults `retry: (count, err) => err.statusCode >= 500 && count < 2` (don't retry 4xx), `refetchOnWindowFocus: false`.
5. Folder structure:
   ```
   client/src/
     api/          client.js + one file per resource (auth.js, videos.js, ...)
     hooks/        useAuth, useVideos, useComments, ... (TanStack wrappers)
     components/   ui/ (Button, Input, Modal, Spinner, Toast), layout/, video/, ...
     pages/
     lib/          constants.js (file limits, validation regexes), format.js (duration, views, dates)
     context/      AuthContext.jsx
   ```
6. Shared validation constants in `lib/constants.js` mirroring §0.5 exactly (sizes, regexes, allowed MIME types) so forms reject before upload.
7. **Verify:** healthcheck call renders "API: connected" on a placeholder home page through the proxy.

## Phase 2 — Authentication (the core)

**Goal: register → login → session persistence → silent refresh → logout, airtight.**

1. **AuthContext**: holds `user | null` + `isLoading`. On mount, run `GET /users/me`:
   - 200 → set user.
   - 401 → interceptor auto-attempts refresh → retried `/me` succeeds (user had a valid refresh cookie) or fails (anonymous). Either way, `isLoading → false`. Render a full-page spinner until resolved so protected routes never flash.
2. **Register page** (`/register`): react-hook-form + zod schema mirroring §0.5. Avatar picker **required**, cover optional, with client-side type/size checks and image previews (`URL.createObjectURL`). Submit as `FormData`. Handle: `409` (duplicate — show on the username/email fields), `400` validation, `429` rate limit. On success: toast "Account created" → **redirect to `/login`** (backend does not auto-login).
3. **Login page** (`/login`): one identifier field — if it contains `@` send as `email`, else `username` — plus password. On success: put `data.user` into AuthContext, redirect to intended page (`location.state.from`) or `/`. 401 → "Invalid credentials" (backend never says which field was wrong; don't pretend otherwise).
4. **Logout**: `POST /users/logout`, clear AuthContext, `queryClient.clear()`, redirect `/`. Even if the request fails (expired session), still clear local state.
5. **Route guards**: `<ProtectedRoute>` (redirects to `/login` with `state.from`) and `<GuestRoute>` (login/register redirect to `/` when already authed).
6. **Verify the nasty paths:** (a) login → wait past access-token expiry → click anything → silent refresh + retry works; (b) two simultaneous requests both hitting 401 → only ONE refresh fired (check Network tab — this is the reuse-detection trap); (c) refresh cookie expired → clean redirect to login, no infinite loop; (d) register with taken username → 409 surfaced on the field.

## Phase 3 — Video Browsing & Watch Page (public core)

**Goal: anonymous users can browse, search, and watch.**

1. **Layout shell**: header (logo, search bar, login button / user avatar menu), collapsible sidebar (Home, Liked, History, Subscriptions, My channel — auth-only items hidden when anonymous).
2. **Home page** (`/`): video grid via `useInfiniteQuery` on `GET /videos` (`getNextPageParam: last => last.hasNextPage ? last.nextPage : undefined`), IntersectionObserver sentinel for infinite scroll. Card: thumbnail, duration badge (format seconds → `mm:ss`), title, owner avatar+name, views, relative date. Skeleton loaders; empty state.
3. **Search & sort** (`/results?query=...`): search bar navigates with `query` param; sort dropdown maps ONLY to backend-allowed fields: `createdAt | views | duration | title` + `asc|desc`.
4. **Watch page** (`/watch/:videoId`):
   - `useQuery` with `staleTime: Infinity` for the session and `refetchOnWindowFocus: false` (every fetch is a view count increment — see §0.6).
   - HTML5 `<video controls>` with Cloudinary URL, poster = thumbnail.
   - Owner info row → link to `/channel/:username`; subscribe button (Phase 5).
   - Description box (collapsible), views, date.
   - 404 → friendly "Video not found" page (also covers unpublished videos).
5. **Channel page** (`/channel/:username`): cover image, avatar, name, `@username`, subscriber/subscribed counts from `GET /users/channel/:username`; tabs: **Videos** (`GET /videos?userId=<channel._id>`), **Playlists**, **Tweets** (both Phase 6). 404 page for unknown channel.

## Phase 4 — Comments & Likes

1. **Comments section** on watch page: `useInfiniteQuery` on `GET /comments/:videoId`. Add form (auth-gated — show "Sign in to comment" otherwise), 1000-char counter. On create, **invalidate the comments query** (the POST response owner is not populated — don't append it raw). Edit/delete only on own comments (compare `comment.owner._id === user._id`), inline edit, delete confirm.
2. **Like buttons** (video + comment): initial state comes from `likesCount`/`isLiked` on the video detail and comment list responses. Render count + filled/unfilled state and use optimistic updates (`onMutate` cache patch, rollback in `onError`); reconcile with the `{ liked }` the toggle endpoint returns.
3. **Liked videos page** (`/liked`, protected): infinite grid on `GET /likes/videos`, reusing the home grid components.

## Phase 5 — Subscriptions

1. **Subscribe button** on channel page and watch page: initial state from channel profile's `isSubscribed`; optimistic toggle on `POST /subscriptions/c/:channelId` with rollback; also optimistically bump `subscribersCount`. Hidden on your own channel (§0.6). Anonymous click → redirect to login.
2. **Subscriptions feed** (`/subscriptions`, protected): `GET /subscriptions/u/<me._id>` → channel list; clicking a channel goes to its page. (No aggregated "videos from all subscriptions" endpoint exists — show the channel list, don't fake a feed.)
3. Channel page "Subscribers" tab (optional): `GET /subscriptions/c/:channelId`.

## Phase 6 — Playlists & Tweets

1. **Playlists**: "Save" button on video cards/watch page → modal listing my playlists (`GET /playlists/user/<me._id>`) with checkboxes → add/remove via the two playlist-video endpoints; "create new playlist" inline form. Playlist page (`/playlist/:playlistId`): video list, owner-only edit (name/description), remove video, delete playlist with confirm. Channel page Playlists tab shows cards with `videoCount`.
2. **Tweets** (community posts): channel page Tweets tab via `GET /tweets/user/:userId`; composer (280-char counter) on own channel; edit/delete own tweets; tweet like button (same caveat as §Phase 4-2).

## Phase 7 — Creator Studio (Dashboard)

1. **Upload page** (`/studio/upload`, protected): drag-and-drop video (type/size from §0.4) + thumbnail + title/description form, validated client-side before submit. Use Axios `onUploadProgress` for a real progress bar — 100MB uploads need it. Disable submit while uploading; warn on tab close (`beforeunload`). Handle 400 (signature mismatch), 413-style multer errors (file too large → 400 with multer message).
2. **Studio dashboard** (`/studio`, protected): stats cards from `GET /dashboard/stats`; videos table from `GET /dashboard/videos` (paginated, page-number style rather than infinite scroll) showing thumbnail, title, **publish status toggle** (`PATCH /videos/:id/toggle-publish`, optimistic), views, date, edit/delete actions.
3. **Edit video modal/page**: title, description, optional new thumbnail (FormData only when a file is attached, plain JSON otherwise is NOT supported — route always runs multer, so always send FormData; text-only FormData is fine). Delete with type-the-title confirm; on success invalidate videos, dashboard, playlists, liked queries.

## Phase 8 — Settings, History & Polish

1. **Settings page** (`/settings`, protected): three sections —
   - Profile: fullname + email (`PATCH /users/update-account`, both fields required; 409 → email field error).
   - Images: avatar / cover upload with preview + crop-less 5MB validation.
   - Security: change-password form (old, new, confirm; mirror §0.5 rules). **On success: clear auth state and redirect to login** with toast "Password changed — please sign in again" (§0.1 change-password semantics).
2. **Watch history** (`/history`, protected): infinite list on `GET /users/history` (newest-watched first), reusing the home grid/list components. Read-only — there is no remove/clear endpoint.
3. **Polish pass**: error boundary + route-level 404; toast system for all mutations; loading skeletons everywhere; responsive audit (sidebar → bottom nav on mobile); a11y pass (focus traps in modals, alt text, keyboard nav); format helpers (1.2K views, 3:05, "2 weeks ago"); document title per page.

## Phase 9 — Production Readiness

1. Backend `.env` for prod: `NODE_ENV=production` (secure cookies → HTTPS only), real `CORS_ORIGIN`, `TRUST_PROXY=true` if behind Nginx.
2. Serve `client/dist` from the same origin as the API (Express static or Nginx) — **mandatory** because of `sameSite: strict`.
3. SPA fallback: any non-`/api` route → `index.html` (careful: the backend's current 404 handler would catch deep links if Express serves the SPA — add the fallback BEFORE the 404 handler).
4. Smoke-test checklist: full auth lifecycle including refresh expiry, upload over a slow connection, rate-limit error surfaces, mobile viewport, anonymous vs authed views of the same channel/video.

---

## Backend additions — DONE

All three pre-frontend backend additions are implemented and covered by integration tests (`tests/integration/watch-history.test.js`, `tests/integration/like-metadata.test.js`):

1. ✅ `GET /users/history` — populated, paginated watch history
2. ✅ `likesCount` + `isLiked` on `getVideoById`
3. ✅ `likesCount` + `isLiked` on `getVideoComments` and `getUserTweets`