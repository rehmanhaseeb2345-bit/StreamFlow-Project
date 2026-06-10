import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin } from "../helpers/auth.js";
import { publishVideo } from "../helpers/video.js";

const NON_EXISTENT_ID = "64b1f0c2e1d2f3a4b5c6d7e8";

describe("POST /api/v1/likes/toggle/v/:videoId", () => {
  it("requires authentication", async () => {
    const res = await request(app).post(`/api/v1/likes/toggle/v/${NON_EXISTENT_ID}`);
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for an invalid video id", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/likes/toggle/v/not-an-id")
      .set("Cookie", cookies);
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent video", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post(`/api/v1/likes/toggle/v/${NON_EXISTENT_ID}`)
      .set("Cookie", cookies);
    expect(res.statusCode).toBe(404);
  });

  it("toggles like on and off", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    const likeRes = await request(app)
      .post(`/api/v1/likes/toggle/v/${videoId}`)
      .set("Cookie", cookies);
    expect(likeRes.statusCode).toBe(200);
    expect(likeRes.body.data.liked).toBe(true);

    const unlikeRes = await request(app)
      .post(`/api/v1/likes/toggle/v/${videoId}`)
      .set("Cookie", cookies);
    expect(unlikeRes.statusCode).toBe(200);
    expect(unlikeRes.body.data.liked).toBe(false);
  });

  it("hides unpublished videos from non-owner likers (404)", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    await request(app)
      .patch(`/api/v1/videos/${videoId}/toggle-publish`)
      .set("Cookie", ownerCookies);

    const res = await request(app)
      .post(`/api/v1/likes/toggle/v/${videoId}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(404);
  });

  it("survives concurrent duplicate like requests without error (unique index race)", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    const [r1, r2] = await Promise.all([
      request(app).post(`/api/v1/likes/toggle/v/${videoId}`).set("Cookie", cookies),
      request(app).post(`/api/v1/likes/toggle/v/${videoId}`).set("Cookie", cookies),
    ]);

    expect([200]).toContain(r1.statusCode);
    expect([200]).toContain(r2.statusCode);
  });
});

describe("POST /api/v1/likes/toggle/c/:commentId", () => {
  it("toggles a comment like", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);

    const commentRes = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .set("Cookie", ownerCookies)
      .send({ content: "Nice" });

    const res = await request(app)
      .post(`/api/v1/likes/toggle/c/${commentRes.body.data._id}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.liked).toBe(true);
  });

  it("returns 404 for a non-existent comment", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post(`/api/v1/likes/toggle/c/${NON_EXISTENT_ID}`)
      .set("Cookie", cookies);
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/v1/likes/toggle/t/:tweetId", () => {
  it("toggles a tweet like", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies } = await registerAndLogin();

    const tweetRes = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", ownerCookies)
      .send({ content: "Hello world" });

    const res = await request(app)
      .post(`/api/v1/likes/toggle/t/${tweetRes.body.data._id}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.liked).toBe(true);
  });

  it("returns 404 for a non-existent tweet", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post(`/api/v1/likes/toggle/t/${NON_EXISTENT_ID}`)
      .set("Cookie", cookies);
    expect(res.statusCode).toBe(404);
  });
});

describe("GET /api/v1/likes/videos", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/likes/videos");
    expect(res.statusCode).toBe(401);
  });

  it("returns liked, published videos for the current user", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies, { title: "Liked Video" });
    const videoId = created.body.data._id;

    await request(app).post(`/api/v1/likes/toggle/v/${videoId}`).set("Cookie", cookies);

    const res = await request(app).get("/api/v1/likes/videos").set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(1);
    expect(res.body.data.docs[0]._id).toBe(videoId);
  });

  it("excludes videos that were unpublished after being liked", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    await request(app).post(`/api/v1/likes/toggle/v/${videoId}`).set("Cookie", cookies);
    await request(app)
      .patch(`/api/v1/videos/${videoId}/toggle-publish`)
      .set("Cookie", ownerCookies);

    const res = await request(app).get("/api/v1/likes/videos").set("Cookie", cookies);
    expect(res.body.data.docs.length).toBe(0);
  });
});
