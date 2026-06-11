# StreamYT Backend

A YouTube-style backend built with Express 5, MongoDB/Mongoose, JWT auth (httpOnly cookies),
Cloudinary for media storage, and Zod for request validation.

## Tech stack

- **Runtime**: Node.js (ESM), Express 5
- **Database**: MongoDB via Mongoose, with `mongoose-aggregate-paginate-v2` for paginated lists
- **Auth**: JWT access/refresh tokens stored in httpOnly cookies (rotation + reuse detection)
- **Uploads**: Multer (local temp storage) -> Cloudinary, with magic-byte file signature verification
- **Validation**: Zod schemas via a shared `validateMiddleware`
- **Security**: Helmet, rate limiting on auth routes, CORS with credentials, input sanitization
- **Tests**: Vitest + Supertest + mongodb-memory-server (203 tests)

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in the values (see below).
3. `npm run dev` — starts the server with nodemon.
4. `npm test` — runs the full test suite (uses an in-memory MongoDB, no real DB needed).

### Environment variables

| Variable | Description |
| --- | --- |
| `PORT` | Port to listen on (default 3000) |
| `NODE_ENV` | `development` / `production` / `test` |
| `MONGODB_URI` | MongoDB connection string |
| `CORS_ORIGIN` | Allowed frontend origin (credentials are enabled, so this must be an exact origin, not `*`) |
| `ACCESS_TOKEN_SECRET` / `ACCESS_TOKEN_EXPIRY` | JWT access token secret + expiry (e.g. `15m`) |
| `REFRESH_TOKEN_SECRET` / `REFRESH_TOKEN_EXPIRY` | JWT refresh token secret + expiry (e.g. `7d`) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary credentials |
| `TRUST_PROXY` | Set `true` only when running behind a reverse proxy/load balancer |
| `AUTH_RATE_LIMIT_MAX` | Max requests per 15 min per IP on `/register`, `/login`, `/refresh-token` (default 20) |

## Auth model (important for frontend integration)

- On register/login, the server sets two **httpOnly cookies**: `accessToken` (short-lived) and
  `refreshToken` (long-lived). They are **not** returned in the JSON body.
- All authenticated requests must be made with `credentials: "include"` (fetch) or
  `withCredentials: true` (axios) so the browser sends these cookies.
- Cookies use `sameSite: "strict"` and `secure` (in production), so the frontend must run on
  the same site/origin configuration as `CORS_ORIGIN`.
- When the access token expires, call `POST /api/v1/users/refresh-token` (cookie-based) to get a
  new pair of tokens. On reuse of an old/rotated-out refresh token, **both** tokens are revoked
  and the user must log in again.

## API reference

Base URL: `/api/v1`

All list endpoints (marked **paginated**) accept `?page=` and `?limit=` (max 50) query params and
return `{ docs, totalDocs, limit, page, totalPages, hasPrevPage, hasNextPage, ... }`.

### Health

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/healthcheck` | — | Service + DB status |

### Users / Auth (`/users`)

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| POST | `/users/register` | — | multipart/form-data: `fullname`, `username`, `email`, `password`, `avatar` (file, required), `coverImage` (file, optional) |
| POST | `/users/login` | — | JSON: `username` or `email`, `password` |
| POST | `/users/refresh-token` | — (cookie) | Refreshes access/refresh token cookies |
| POST | `/users/logout` | required | Clears auth cookies |
| POST | `/users/change-password` | required | JSON: `oldPassword`, `newPassword`, `confirmPassword` |
| GET | `/users/me` | required | Current user profile |
| PATCH | `/users/update-account` | required | JSON: `fullname`, `email` |
| PATCH | `/users/avatar` | required | multipart: `avatar` (file) |
| PATCH | `/users/cover-image` | required | multipart: `coverImage` (file) |
| GET | `/users/channel/:username` | optional | Channel profile + subscriber counts + `isSubscribed` (if logged in) |

### Videos (`/videos`)

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET | `/videos` | — | **paginated**. Query: `query` (search title/description), `sortBy` (`createdAt`\|`views`\|`duration`\|`title`), `sortType` (`asc`\|`desc`), `userId` |
| POST | `/videos` | required | multipart: `title`, `description`, `videoFile` (required), `thumbnail` (required) |
| GET | `/videos/:videoId` | optional | Video details (unpublished only visible to owner); increments view count |
| PATCH | `/videos/:videoId` | required (owner) | multipart: `title?`, `description?`, `thumbnail?` (file) |
| DELETE | `/videos/:videoId` | required (owner) | Deletes video + cleans up Cloudinary assets |
| PATCH | `/videos/:videoId/toggle-publish` | required (owner) | Toggles `isPublished` |

### Comments (`/comments`)

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET | `/comments/:videoId` | optional | **paginated** comments for a video |
| POST | `/comments/:videoId` | required | JSON: `content` |
| PATCH | `/comments/c/:commentId` | required (owner) | JSON: `content` |
| DELETE | `/comments/c/:commentId` | required (owner) | — |

### Likes (`/likes`) — all routes require auth

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/likes/toggle/v/:videoId` | Like/unlike a video |
| POST | `/likes/toggle/c/:commentId` | Like/unlike a comment |
| POST | `/likes/toggle/t/:tweetId` | Like/unlike a tweet |
| GET | `/likes/videos` | **paginated** list of videos the current user liked |

### Playlists (`/playlists`)

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET | `/playlists/user/:userId` | — | **paginated** playlists for a user, each with `videoCount` |
| POST | `/playlists` | required | JSON: `name`, `description?` |
| GET | `/playlists/:playlistId` | optional | Playlist with populated videos (unpublished videos hidden from non-owners) |
| PATCH | `/playlists/:playlistId` | required (owner) | JSON: `name?`, `description?` |
| DELETE | `/playlists/:playlistId` | required (owner) | — |
| PATCH | `/playlists/:playlistId/videos/:videoId` | required (owner) | Add video to playlist |
| DELETE | `/playlists/:playlistId/videos/:videoId` | required (owner) | Remove video from playlist |

### Subscriptions (`/subscriptions`)

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/subscriptions/c/:channelId` | required | Toggle subscribe/unsubscribe to a channel |
| GET | `/subscriptions/c/:channelId` | — | **paginated** list of a channel's subscribers |
| GET | `/subscriptions/u/:subscriberId` | — | **paginated** list of channels a user is subscribed to |

### Tweets (`/tweets`)

| Method | Path | Auth | Body / Notes |
| --- | --- | --- | --- |
| GET | `/tweets/user/:userId` | — | **paginated** tweets for a user |
| POST | `/tweets` | required | JSON: `content` |
| PATCH | `/tweets/:tweetId` | required (owner) | JSON: `content` |
| DELETE | `/tweets/:tweetId` | required (owner) | — |

### Dashboard (`/dashboard`) — all routes require auth (current user's channel)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/dashboard/stats` | `{ totalVideos, totalViews, totalSubscribers, totalLikes }` |
| GET | `/dashboard/videos` | **paginated** list of the current user's videos (including unpublished) |

## Response shape

All responses follow:

```json
{ "success": true, "statusCode": 200, "data": { ... }, "message": "..." }
```

Errors:

```json
{ "success": false, "statusCode": 400, "message": "...", "errors": [] }
```
