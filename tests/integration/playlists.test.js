import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin } from "../helpers/auth.js";
import { publishVideo } from "../helpers/video.js";

const NON_EXISTENT_ID = "64b1f0c2e1d2f3a4b5c6d7e8";

describe("POST /api/v1/playlists", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/v1/playlists")
      .send({ name: "My Playlist" });
    expect(res.statusCode).toBe(401);
  });

  it("creates a playlist", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "Favorites", description: "My favorite videos" });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.name).toBe("Favorites");
    expect(res.body.data.videos).toEqual([]);
  });

  it("rejects an empty name", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "" });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/v1/playlists/user/:userId", () => {
  it("returns 400 for an invalid user id", async () => {
    const res = await request(app).get("/api/v1/playlists/user/not-an-id");
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await request(app).get(`/api/v1/playlists/user/${NON_EXISTENT_ID}`);
    expect(res.statusCode).toBe(404);
  });

  it("returns playlists with a videoCount field", async () => {
    const { cookies, user } = await registerAndLogin();

    await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "Watch Later" });

    const res = await request(app).get(`/api/v1/playlists/user/${user._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].videoCount).toBe(0);
  });
});

describe("GET /api/v1/playlists/:playlistId", () => {
  it("returns 404 for a non-existent playlist", async () => {
    const res = await request(app).get(`/api/v1/playlists/${NON_EXISTENT_ID}`);
    expect(res.statusCode).toBe(404);
  });

  it("hides unpublished videos within the playlist from non-owners", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: viewerCookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", ownerCookies)
      .send({ name: "Mixed" });
    const playlistId = playlistRes.body.data._id;

    const video = await publishVideo(ownerCookies);
    const videoId = video.body.data._id;

    await request(app)
      .patch(`/api/v1/playlists/${playlistId}/videos/${videoId}`)
      .set("Cookie", ownerCookies);

    await request(app)
      .patch(`/api/v1/videos/${videoId}/toggle-publish`)
      .set("Cookie", ownerCookies);

    const ownerView = await request(app)
      .get(`/api/v1/playlists/${playlistId}`)
      .set("Cookie", ownerCookies);
    expect(ownerView.body.data.videos.length).toBe(1);

    const viewerView = await request(app)
      .get(`/api/v1/playlists/${playlistId}`)
      .set("Cookie", viewerCookies);
    expect(viewerView.body.data.videos.length).toBe(0);
  });
});

describe("PATCH /api/v1/playlists/:playlistId/videos/:videoId", () => {
  it("rejects modification by a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", ownerCookies)
      .send({ name: "Mine" });

    const video = await publishVideo(ownerCookies);

    const res = await request(app)
      .patch(`/api/v1/playlists/${playlistRes.body.data._id}/videos/${video.body.data._id}`)
      .set("Cookie", otherCookies);

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when the video does not exist", async () => {
    const { cookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "Mine" });

    const res = await request(app)
      .patch(`/api/v1/playlists/${playlistRes.body.data._id}/videos/${NON_EXISTENT_ID}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(404);
  });

  it("adds a video and is idempotent (addToSet)", async () => {
    const { cookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "Mine" });
    const playlistId = playlistRes.body.data._id;

    const video = await publishVideo(cookies);
    const videoId = video.body.data._id;

    await request(app)
      .patch(`/api/v1/playlists/${playlistId}/videos/${videoId}`)
      .set("Cookie", cookies);

    const res = await request(app)
      .patch(`/api/v1/playlists/${playlistId}/videos/${videoId}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.videos.length).toBe(1);
  });
});

describe("DELETE /api/v1/playlists/:playlistId/videos/:videoId", () => {
  it("removes a video from the playlist", async () => {
    const { cookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "Mine" });
    const playlistId = playlistRes.body.data._id;

    const video = await publishVideo(cookies);
    const videoId = video.body.data._id;

    await request(app)
      .patch(`/api/v1/playlists/${playlistId}/videos/${videoId}`)
      .set("Cookie", cookies);

    const res = await request(app)
      .delete(`/api/v1/playlists/${playlistId}/videos/${videoId}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.videos.length).toBe(0);
  });
});

describe("PATCH /api/v1/playlists/:playlistId", () => {
  it("rejects an empty update", async () => {
    const { cookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "Mine" });

    const res = await request(app)
      .patch(`/api/v1/playlists/${playlistRes.body.data._id}`)
      .set("Cookie", cookies)
      .send({});

    expect(res.statusCode).toBe(400);
  });

  it("updates name and description", async () => {
    const { cookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "Mine" });

    const res = await request(app)
      .patch(`/api/v1/playlists/${playlistRes.body.data._id}`)
      .set("Cookie", cookies)
      .send({ name: "Renamed", description: "New description" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.name).toBe("Renamed");
  });

  it("rejects updates from a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", ownerCookies)
      .send({ name: "Mine" });

    const res = await request(app)
      .patch(`/api/v1/playlists/${playlistRes.body.data._id}`)
      .set("Cookie", otherCookies)
      .send({ name: "Hijacked" });

    expect(res.statusCode).toBe(403);
  });
});

describe("DELETE /api/v1/playlists/:playlistId", () => {
  it("rejects deletion from a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", ownerCookies)
      .send({ name: "Mine" });

    const res = await request(app)
      .delete(`/api/v1/playlists/${playlistRes.body.data._id}`)
      .set("Cookie", otherCookies);

    expect(res.statusCode).toBe(403);
  });

  it("deletes the playlist", async () => {
    const { cookies } = await registerAndLogin();

    const playlistRes = await request(app)
      .post("/api/v1/playlists")
      .set("Cookie", cookies)
      .send({ name: "Mine" });

    const res = await request(app)
      .delete(`/api/v1/playlists/${playlistRes.body.data._id}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);

    const getRes = await request(app).get(`/api/v1/playlists/${playlistRes.body.data._id}`);
    expect(getRes.statusCode).toBe(404);
  });
});
