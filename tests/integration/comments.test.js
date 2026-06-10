import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin } from "../helpers/auth.js";
import { publishVideo } from "../helpers/video.js";

const NON_EXISTENT_ID = "64b1f0c2e1d2f3a4b5c6d7e8";

describe("GET /api/v1/comments/:videoId", () => {
  it("returns 400 for an invalid video id", async () => {
    const res = await request(app).get("/api/v1/comments/not-an-id");
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent video", async () => {
    const res = await request(app).get(`/api/v1/comments/${NON_EXISTENT_ID}`);
    expect(res.statusCode).toBe(404);
  });

  it("returns paginated comments for a published video", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);
    const videoId = created.body.data._id;

    await request(app)
      .post(`/api/v1/comments/${videoId}`)
      .set("Cookie", cookies)
      .send({ content: "First comment" });

    const res = await request(app).get(`/api/v1/comments/${videoId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(1);
    expect(res.body.data.docs[0].content).toBe("First comment");
    expect(res.body.data.docs[0].owner.username).toBeTruthy();
  });

  it("hides comments on unpublished videos from non-owners", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);
    const videoId = created.body.data._id;

    await request(app)
      .patch(`/api/v1/videos/${videoId}/toggle-publish`)
      .set("Cookie", ownerCookies);

    const res = await request(app)
      .get(`/api/v1/comments/${videoId}`)
      .set("Cookie", otherCookies);

    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/v1/comments/:videoId", () => {
  it("requires authentication", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const res = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .send({ content: "Hello" });

    expect(res.statusCode).toBe(401);
  });

  it("rejects empty content", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const res = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .set("Cookie", cookies)
      .send({ content: "" });

    expect(res.statusCode).toBe(400);
  });

  it("rejects content over 1000 characters", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const res = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .set("Cookie", cookies)
      .send({ content: "a".repeat(1001) });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when commenting on a non-existent video", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post(`/api/v1/comments/${NON_EXISTENT_ID}`)
      .set("Cookie", cookies)
      .send({ content: "Hello" });

    expect(res.statusCode).toBe(404);
  });

  it("adds a comment successfully", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const res = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .set("Cookie", cookies)
      .send({ content: "Great video!" });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.content).toBe("Great video!");
  });
});

describe("PATCH /api/v1/comments/c/:commentId", () => {
  it("rejects updates from a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);

    const commentRes = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .set("Cookie", ownerCookies)
      .send({ content: "Original" });

    const res = await request(app)
      .patch(`/api/v1/comments/c/${commentRes.body.data._id}`)
      .set("Cookie", otherCookies)
      .send({ content: "Hijacked" });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for a non-existent comment", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .patch(`/api/v1/comments/c/${NON_EXISTENT_ID}`)
      .set("Cookie", cookies)
      .send({ content: "Edited" });

    expect(res.statusCode).toBe(404);
  });

  it("allows the owner to update their comment", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const commentRes = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .set("Cookie", cookies)
      .send({ content: "Original" });

    const res = await request(app)
      .patch(`/api/v1/comments/c/${commentRes.body.data._id}`)
      .set("Cookie", cookies)
      .send({ content: "Edited content" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.content).toBe("Edited content");
  });
});

describe("DELETE /api/v1/comments/c/:commentId", () => {
  it("rejects deletion from a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();
    const created = await publishVideo(ownerCookies);

    const commentRes = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .set("Cookie", ownerCookies)
      .send({ content: "Original" });

    const res = await request(app)
      .delete(`/api/v1/comments/c/${commentRes.body.data._id}`)
      .set("Cookie", otherCookies);

    expect(res.statusCode).toBe(403);
  });

  it("allows the owner to delete their comment", async () => {
    const { cookies } = await registerAndLogin();
    const created = await publishVideo(cookies);

    const commentRes = await request(app)
      .post(`/api/v1/comments/${created.body.data._id}`)
      .set("Cookie", cookies)
      .send({ content: "Original" });

    const res = await request(app)
      .delete(`/api/v1/comments/c/${commentRes.body.data._id}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);

    const list = await request(app).get(`/api/v1/comments/${created.body.data._id}`);
    expect(list.body.data.docs.length).toBe(0);
  });
});
