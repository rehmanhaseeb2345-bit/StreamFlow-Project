import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin, buildUserPayload } from "../helpers/auth.js";
import { publishVideo } from "../helpers/video.js";
import { validPng } from "../fixtures/files.js";

describe("NoSQL operator injection", () => {
  it("rejects an object-shaped username/password in login (no $ne bypass)", async () => {
    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ username: { $ne: null }, password: { $ne: null } });

    expect(res.statusCode).toBe(400);
  });

  it("rejects an object-shaped email in login", async () => {
    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ email: { $gt: "" }, password: "anything" });

    expect(res.statusCode).toBe(400);
  });

  it("does not crash when refresh-token body contains an operator object", async () => {
    const res = await request(app)
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken: { $ne: null } });

    expect(res.statusCode).toBe(401);
  });

  it("treats an array-shaped query param as an invalid id rather than crashing", async () => {
    // ?userId=a&userId=b -> req.query.userId becomes ['a', 'b']
    const res = await request(app).get("/api/v1/videos").query("userId=a&userId=b");

    expect(res.statusCode).toBe(400);
  });
});

describe("Regex injection / ReDoS-shaped search queries", () => {
  it("treats regex metacharacters in the search query as literal text", async () => {
    const { cookies } = await registerAndLogin();
    await publishVideo(cookies, { title: "Normal Title", description: "desc" });

    for (const query of ["(.*)", "a{1000000}", "[a-z]+$", ".*.*.*.*"]) {
      const res = await request(app).get("/api/v1/videos").query({ query });
      expect(res.statusCode).toBe(200);
      expect(res.body.data.docs.length).toBe(0);
    }
  });
});

describe("Request body size limits", () => {
  it("rejects an oversized JSON body (> 16kb) with 413", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", cookies)
      .send({ content: "a".repeat(20000) });

    expect(res.statusCode).toBe(413);
  });
});

describe("Mass assignment protection", () => {
  it("ignores unexpected fields like role/isAdmin during registration", async () => {
    const data = buildUserPayload();

    const res = await request(app)
      .post("/api/v1/users/register")
      .field("fullname", data.fullname)
      .field("username", data.username)
      .field("email", data.email)
      .field("password", data.password)
      .field("role", "admin")
      .field("isAdmin", "true")
      .field("_id", "64b1f0c2e1d2f3a4b5c6d7e8")
      .attach("avatar", validPng, { filename: "avatar.png", contentType: "image/png" });

    expect(res.statusCode).toBe(201);
    expect(res.body.data.role).toBeUndefined();
    expect(res.body.data.isAdmin).toBeUndefined();
    expect(res.body.data._id).not.toBe("64b1f0c2e1d2f3a4b5c6d7e8");
  });

  it("ignores attempts to set views/isPublished/owner directly when publishing a video", async () => {
    const { cookies, user } = await registerAndLogin();
    const created = await publishVideo(cookies);

    expect(created.body.data.owner).toBe(user._id);
    expect(created.body.data.views).toBe(0);
    expect(created.body.data.isPublished).toBe(true);
  });
});
