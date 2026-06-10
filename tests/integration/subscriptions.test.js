import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin } from "../helpers/auth.js";

const NON_EXISTENT_ID = "64b1f0c2e1d2f3a4b5c6d7e8";

describe("POST /api/v1/subscriptions/c/:channelId", () => {
  it("requires authentication", async () => {
    const res = await request(app).post(`/api/v1/subscriptions/c/${NON_EXISTENT_ID}`);
    expect(res.statusCode).toBe(401);
  });

  it("returns 400 for an invalid channel id", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/subscriptions/c/not-an-id")
      .set("Cookie", cookies);
    expect(res.statusCode).toBe(400);
  });

  it("rejects subscribing to your own channel", async () => {
    const { cookies, user } = await registerAndLogin();
    const res = await request(app)
      .post(`/api/v1/subscriptions/c/${user._id}`)
      .set("Cookie", cookies);
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent channel", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post(`/api/v1/subscriptions/c/${NON_EXISTENT_ID}`)
      .set("Cookie", cookies);
    expect(res.statusCode).toBe(404);
  });

  it("toggles subscription on and off", async () => {
    const { cookies } = await registerAndLogin();
    const { user: channel } = await registerAndLogin();

    const subRes = await request(app)
      .post(`/api/v1/subscriptions/c/${channel._id}`)
      .set("Cookie", cookies);
    expect(subRes.statusCode).toBe(200);
    expect(subRes.body.data.subscribed).toBe(true);

    const unsubRes = await request(app)
      .post(`/api/v1/subscriptions/c/${channel._id}`)
      .set("Cookie", cookies);
    expect(unsubRes.statusCode).toBe(200);
    expect(unsubRes.body.data.subscribed).toBe(false);
  });
});

describe("GET /api/v1/subscriptions/c/:channelId", () => {
  it("returns 400 for an invalid channel id", async () => {
    const res = await request(app).get("/api/v1/subscriptions/c/not-an-id");
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent channel", async () => {
    const res = await request(app).get(`/api/v1/subscriptions/c/${NON_EXISTENT_ID}`);
    expect(res.statusCode).toBe(404);
  });

  it("lists subscribers of a channel", async () => {
    const { cookies, user: subscriber } = await registerAndLogin();
    const { user: channel } = await registerAndLogin();

    await request(app)
      .post(`/api/v1/subscriptions/c/${channel._id}`)
      .set("Cookie", cookies);

    const res = await request(app).get(`/api/v1/subscriptions/c/${channel._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(1);
    expect(res.body.data.docs[0].subscriber._id).toBe(subscriber._id);
  });
});

describe("GET /api/v1/subscriptions/u/:subscriberId", () => {
  it("returns 400 for an invalid id", async () => {
    const res = await request(app).get("/api/v1/subscriptions/u/not-an-id");
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await request(app).get(`/api/v1/subscriptions/u/${NON_EXISTENT_ID}`);
    expect(res.statusCode).toBe(404);
  });

  it("lists channels a user is subscribed to", async () => {
    const { cookies, user: subscriber } = await registerAndLogin();
    const { user: channel } = await registerAndLogin();

    await request(app)
      .post(`/api/v1/subscriptions/c/${channel._id}`)
      .set("Cookie", cookies);

    const res = await request(app).get(`/api/v1/subscriptions/u/${subscriber._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(1);
    expect(res.body.data.docs[0].channel._id).toBe(channel._id);
  });
});
