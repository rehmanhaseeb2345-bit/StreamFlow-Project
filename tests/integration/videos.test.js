import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin } from "../helpers/auth.js";
import { publishVideo } from "../helpers/video.js";
import { validMp4, validPng, validJpeg } from "../fixtures/files.js";

describe("POST /api/v1/videos", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/v1/videos")
      .field("title", "Title")
      .field("description", "Description")
      .attach("videoFile", validMp4, { filename: "v.mp4", contentType: "video/mp4" })
      .attach("thumbnail", validPng, { filename: "t.png", contentType: "image/png" });

    expect(res.statusCode).toBe(401);
  });

  it("publishes a video with valid title/description/files", async () => {
    const { cookies } = await registerAndLogin();

    const res = await publishVideo(cookies, { title: "My First Video" });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.title).toBe("My First Video");
    expect(res.body.data.isPublished).toBe(true);
    expect(res.body.data.views).toBe(0);
    expect(res.body.data.videoFile.url).toContain("res.cloudinary.com");
    expect(res.body.data.thumbnail.url).toContain("res.cloudinary.com");
    expect(res.body.data.duration).toBeGreaterThan(0);
  });

  it("rejects when video file is missing", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/videos")
      .set("Cookie", cookies)
      .field("title", "Title here")
      .field("description", "Description")
      .attach("thumbnail", validPng, { filename: "t.png", contentType: "image/png" });

    expect(res.statusCode).toBe(400);
  });

  it("rejects when thumbnail file is missing", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/videos")
      .set("Cookie", cookies)
      .field("title", "Title here")
      .field("description", "Description")
      .attach("videoFile", validMp4, { filename: "v.mp4", contentType: "video/mp4" });

    expect(res.statusCode).toBe(400);
  });

  it("rejects title shorter than 3 characters", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/videos")
      .set("Cookie", cookies)
      .field("title", "ab")
      .field("description", "Description")
      .attach("videoFile", validMp4, { filename: "v.mp4", contentType: "video/mp4" })
      .attach("thumbnail", validPng, { filename: "t.png", contentType: "image/png" });

    expect(res.statusCode).toBe(400);
  });

  it("rejects a thumbnail whose bytes don't match its declared mimetype", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/videos")
      .set("Cookie", cookies)
      .field("title", "Valid Title")
      .field("description", "Description")
      .attach("videoFile", validMp4, { filename: "v.mp4", contentType: "video/mp4" })
      .attach("thumbnail", validJpeg, { filename: "t.png", contentType: "image/png" });

    expect(res.statusCode).toBe(400);
  });

  it("rejects an unsupported video mimetype", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/videos")
      .set("Cookie", cookies)
      .field("title", "Valid Title")
      .field("description", "Description")
      .attach("videoFile", Buffer.from("not a video"), {
        filename: "v.exe",
        contentType: "application/x-msdownload",
      })
      .attach("thumbnail", validPng, { filename: "t.png", contentType: "image/png" });

    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/v1/videos", () => {
  it("lists published videos with pagination metadata", async () => {
    const { cookies } = await registerAndLogin();
    await publishVideo(cookies, { title: "Alpha video" });
    await publishVideo(cookies, { title: "Beta video" });

    const res = await request(app).get("/api/v1/videos");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(2);
    expect(res.body.data.totalDocs).toBe(2);
  });

  it("does not list unpublished videos", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies, { title: "To Be Hidden" });

    await request(app)
      .patch(`/api/v1/videos/${created.body.data._id}/toggle-publish`)
      .set("Cookie", cookies);

    const res = await request(app).get("/api/v1/videos");
    expect(res.body.data.docs.find((v) => v._id === created.body.data._id)).toBeUndefined();
  });

  it("filters by search query against title/description", async () => {
    const { cookies } = await registerAndLogin();
    await publishVideo(cookies, { title: "Cooking Pasta", description: "Italian food" });
    await publishVideo(cookies, { title: "Guitar Lessons", description: "Music tutorial" });

    const res = await request(app).get("/api/v1/videos").query({ query: "pasta" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(1);
    expect(res.body.data.docs[0].title).toBe("Cooking Pasta");
  });

  it("treats regex special characters in query as literals (no ReDoS / regex injection)", async () => {
    const { cookies } = await registerAndLogin();
    await publishVideo(cookies, { title: "Normal Video" });

    const res = await request(app).get("/api/v1/videos").query({ query: "(.*)" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(0);
  });

  it("rejects an invalid userId filter", async () => {
    const res = await request(app).get("/api/v1/videos").query({ userId: "not-an-id" });
    expect(res.statusCode).toBe(400);
  });

  it("clamps limit to a maximum of 50", async () => {
    const { cookies } = await registerAndLogin();
    await publishVideo(cookies);

    const res = await request(app).get("/api/v1/videos").query({ limit: 1000 });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.limit).toBe(50);
  });

  it("falls back to defaults for invalid sort fields", async () => {
    const { cookies } = await registerAndLogin();
    await publishVideo(cookies);

    const res = await request(app).get("/api/v1/videos").query({ sortBy: "$where" });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/v1/videos/:videoId", () => {
  it("returns 400 for a malformed video id", async () => {
    const res = await request(app).get("/api/v1/videos/not-a-valid-id");
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent video", async () => {
    const res = await request(app).get("/api/v1/videos/64b1f0c2e1d2f3a4b5c6d7e8");
    expect(res.statusCode).toBe(404);
  });

  it("increments view count for non-owner viewers", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: viewerCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    const res = await request(app)
      .get(`/api/v1/videos/${videoId}`)
      .set("Cookie", viewerCookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.views).toBe(1);
  });

  it("does not increment view count for the owner", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);
    const videoId = created.body.data._id;

    const res = await request(app).get(`/api/v1/videos/${videoId}`).set("Cookie", cookies);

    expect(res.body.data.views).toBe(0);
  });

  it("hides unpublished videos from non-owners (404)", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: viewerCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    await request(app)
      .patch(`/api/v1/videos/${videoId}/toggle-publish`)
      .set("Cookie", ownerCookies);

    const res = await request(app)
      .get(`/api/v1/videos/${videoId}`)
      .set("Cookie", viewerCookies);

    expect(res.statusCode).toBe(404);
  });

  it("allows the owner to view their own unpublished video", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);
    const videoId = created.body.data._id;

    await request(app)
      .patch(`/api/v1/videos/${videoId}/toggle-publish`)
      .set("Cookie", cookies);

    const res = await request(app).get(`/api/v1/videos/${videoId}`).set("Cookie", cookies);
    expect(res.statusCode).toBe(200);
  });

  it("adds the video to the viewer's watch history", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: viewerCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    await request(app).get(`/api/v1/videos/${videoId}`).set("Cookie", viewerCookies);

    const me = await request(app).get("/api/v1/users/me").set("Cookie", viewerCookies);
    expect(me.body.data.watchHistory).toContain(videoId);
  });
});

describe("PATCH /api/v1/videos/:videoId", () => {
  it("requires authentication", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const res = await request(app)
      .patch(`/api/v1/videos/${created.body.data._id}`)
      .send({ title: "Updated" });

    expect(res.statusCode).toBe(401);
  });

  it("rejects updates from a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);

    const res = await request(app)
      .patch(`/api/v1/videos/${created.body.data._id}`)
      .set("Cookie", otherCookies)
      .field("title", "Hijacked title here");

    expect(res.statusCode).toBe(403);
  });

  it("updates title and description", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const res = await request(app)
      .patch(`/api/v1/videos/${created.body.data._id}`)
      .set("Cookie", cookies)
      .field("title", "New Title Here")
      .field("description", "New description");

    expect(res.statusCode).toBe(200);
    expect(res.body.data.title).toBe("New Title Here");
    expect(res.body.data.description).toBe("New description");
  });

  it("rejects an empty update (no title/description/file)", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const res = await request(app)
      .patch(`/api/v1/videos/${created.body.data._id}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(400);
  });

  it("updates the thumbnail", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const res = await request(app)
      .patch(`/api/v1/videos/${created.body.data._id}`)
      .set("Cookie", cookies)
      .attach("thumbnail", validPng, { filename: "new-thumb.png", contentType: "image/png" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.thumbnail.url).toContain("res.cloudinary.com");
  });
});

describe("PATCH /api/v1/videos/:videoId/toggle-publish", () => {
  it("toggles publish status and only the owner may do it", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    const forbidden = await request(app)
      .patch(`/api/v1/videos/${videoId}/toggle-publish`)
      .set("Cookie", otherCookies);
    expect(forbidden.statusCode).toBe(403);

    const res = await request(app)
      .patch(`/api/v1/videos/${videoId}/toggle-publish`)
      .set("Cookie", ownerCookies);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.isPublished).toBe(false);
  });
});

describe("DELETE /api/v1/videos/:videoId", () => {
  it("rejects deletion from a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);

    const res = await request(app)
      .delete(`/api/v1/videos/${created.body.data._id}`)
      .set("Cookie", otherCookies);

    expect(res.statusCode).toBe(403);
  });

  it("deletes the video and it becomes inaccessible afterwards", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);
    const videoId = created.body.data._id;

    const res = await request(app)
      .delete(`/api/v1/videos/${videoId}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);

    const getRes = await request(app).get(`/api/v1/videos/${videoId}`);
    expect(getRes.statusCode).toBe(404);
  });
});
