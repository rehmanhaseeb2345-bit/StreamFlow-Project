import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin } from "../helpers/auth.js";
import { publishVideo } from "../helpers/video.js";

describe("GET /api/v1/dashboard/stats", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/dashboard/stats");
    expect(res.statusCode).toBe(401);
  });

  it("returns zeroed stats for a channel with no content", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app).get("/api/v1/dashboard/stats").set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({
      totalVideos: 0,
      totalViews: 0,
      totalSubscribers: 0,
      totalLikes: 0,
    });
  });

  it("aggregates videos, views, subscribers and likes", async () => {
    const { cookies, user } = await registerAndLogin();
    const { cookies: viewerCookies } = await registerAndLogin();
    const { cookies: subscriberCookies } = await registerAndLogin();

    const created = await publishVideo(cookies);
    const videoId = created.body.data._id;

    // view it (increments views)
    await request(app).get(`/api/v1/videos/${videoId}`).set("Cookie", viewerCookies);

    // like it
    await request(app).post(`/api/v1/likes/toggle/v/${videoId}`).set("Cookie", viewerCookies);

    // subscribe to channel
    await request(app)
      .post(`/api/v1/subscriptions/c/${user._id}`)
      .set("Cookie", subscriberCookies);

    const res = await request(app).get("/api/v1/dashboard/stats").set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.totalVideos).toBe(1);
    expect(res.body.data.totalViews).toBe(1);
    expect(res.body.data.totalSubscribers).toBe(1);
    expect(res.body.data.totalLikes).toBe(1);
  });
});

describe("GET /api/v1/dashboard/videos", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/dashboard/videos");
    expect(res.statusCode).toBe(401);
  });

  it("returns only the current user's videos, including unpublished", async () => {
    const { cookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();

    const created = await publishVideo(cookies);
    await publishVideo(otherCookies);

    await request(app)
      .patch(`/api/v1/videos/${created.body.data._id}/toggle-publish`)
      .set("Cookie", cookies);

    const res = await request(app).get("/api/v1/dashboard/videos").set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(1);
    expect(res.body.data.docs[0]._id).toBe(created.body.data._id);
    expect(res.body.data.docs[0].isPublished).toBe(false);
  });
});
