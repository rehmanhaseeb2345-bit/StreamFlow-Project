import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin, registerUser } from "../helpers/auth.js";
import { validPng, validJpeg } from "../fixtures/files.js";

describe("GET /api/v1/users/me", () => {
  it("requires authentication", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.statusCode).toBe(401);
  });

  it("returns the current user without password/refreshToken", async () => {
    const { cookies, user } = await registerAndLogin();

    const res = await request(app).get("/api/v1/users/me").set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data._id).toBe(user._id);
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
  });

  it("accepts the access token via Authorization Bearer header", async () => {
    const { accessToken, user } = await registerAndLogin();

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data._id).toBe(user._id);
  });
});

describe("PATCH /api/v1/users/update-account", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .patch("/api/v1/users/update-account")
      .send({ fullname: "New Name", email: "new@example.com" });
    expect(res.statusCode).toBe(401);
  });

  it("updates fullname and email", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .patch("/api/v1/users/update-account")
      .set("Cookie", cookies)
      .send({ fullname: "Updated Name", email: "updated_email@example.com" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.fullname).toBe("Updated Name");
    expect(res.body.data.email).toBe("updated_email@example.com");
  });

  it("rejects when fullname or email missing", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .patch("/api/v1/users/update-account")
      .set("Cookie", cookies)
      .send({ fullname: "Only Name" });

    expect(res.statusCode).toBe(400);
  });

  it("rejects updating email to one already in use by another user", async () => {
    const { credentials: other } = await registerAndLogin();
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .patch("/api/v1/users/update-account")
      .set("Cookie", cookies)
      .send({ fullname: "Name", email: other.email });

    expect(res.statusCode).toBe(409);
  });
});

describe("PATCH /api/v1/users/avatar", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .patch("/api/v1/users/avatar")
      .attach("avatar", validPng, { filename: "a.png", contentType: "image/png" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects when no file is provided", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .patch("/api/v1/users/avatar")
      .set("Cookie", cookies);
    expect(res.statusCode).toBe(400);
  });

  it("updates the avatar", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .patch("/api/v1/users/avatar")
      .set("Cookie", cookies)
      .attach("avatar", validPng, { filename: "new.png", contentType: "image/png" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.avatar.url).toContain("res.cloudinary.com");
  });

  it("rejects a spoofed file (declared png, jpeg bytes)", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .patch("/api/v1/users/avatar")
      .set("Cookie", cookies)
      .attach("avatar", validJpeg, { filename: "new.png", contentType: "image/png" });

    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/v1/users/cover-image", () => {
  it("updates the cover image", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .patch("/api/v1/users/cover-image")
      .set("Cookie", cookies)
      .attach("coverImage", validPng, { filename: "cover.png", contentType: "image/png" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.coverImage.url).toContain("res.cloudinary.com");
  });
});

describe("GET /api/v1/users/channel/:username", () => {
  it("returns 404 for a non-existent channel", async () => {
    const res = await request(app).get("/api/v1/users/channel/no_such_user");
    expect(res.statusCode).toBe(404);
  });

  it("returns channel profile for an anonymous viewer without email", async () => {
    const { credentials } = await registerAndLogin();

    const res = await request(app).get(`/api/v1/users/channel/${credentials.username}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.username).toBe(credentials.username);
    expect(res.body.data.subscribersCount).toBe(0);
    expect(res.body.data.isSubscribed).toBe(false);
    expect(res.body.data.email).toBeUndefined();
  });

  it("includes email when the owner views their own channel", async () => {
    const { cookies, credentials } = await registerAndLogin();

    const res = await request(app)
      .get(`/api/v1/users/channel/${credentials.username}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe(credentials.email);
  });

  it("reflects subscription status for the requesting user", async () => {
    const { cookies: subscriberCookies } = await registerAndLogin();
    const { user: channelUser, credentials: channelCreds } = await registerAndLogin();

    await request(app)
      .post(`/api/v1/subscriptions/c/${channelUser._id}`)
      .set("Cookie", subscriberCookies);

    const res = await request(app)
      .get(`/api/v1/users/channel/${channelCreds.username}`)
      .set("Cookie", subscriberCookies);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.isSubscribed).toBe(true);
    expect(res.body.data.subscribersCount).toBe(1);
  });

  it("username lookup is case-insensitive (stored lowercase)", async () => {
    const { credentials } = await registerAndLogin();

    const res = await request(app).get(
      `/api/v1/users/channel/${credentials.username.toUpperCase()}`,
    );

    expect(res.statusCode).toBe(200);
  });
});
