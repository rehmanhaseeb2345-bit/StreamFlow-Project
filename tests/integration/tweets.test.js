import { describe, it, expect } from "vitest";
import { app, request, registerAndLogin } from "../helpers/auth.js";

const NON_EXISTENT_ID = "64b1f0c2e1d2f3a4b5c6d7e8";

describe("POST /api/v1/tweets", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/v1/tweets").send({ content: "Hello" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects empty content", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", cookies)
      .send({ content: "" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects content over 280 characters", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", cookies)
      .send({ content: "a".repeat(281) });
    expect(res.statusCode).toBe(400);
  });

  it("creates a tweet", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", cookies)
      .send({ content: "Hello world" });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.content).toBe("Hello world");
  });
});

describe("GET /api/v1/tweets/user/:userId", () => {
  it("returns 400 for an invalid user id", async () => {
    const res = await request(app).get("/api/v1/tweets/user/not-an-id");
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 for a non-existent user", async () => {
    const res = await request(app).get(`/api/v1/tweets/user/${NON_EXISTENT_ID}`);
    expect(res.statusCode).toBe(404);
  });

  it("lists a user's tweets", async () => {
    const { cookies, user } = await registerAndLogin();
    await request(app).post("/api/v1/tweets").set("Cookie", cookies).send({ content: "Tweet 1" });
    await request(app).post("/api/v1/tweets").set("Cookie", cookies).send({ content: "Tweet 2" });

    const res = await request(app).get(`/api/v1/tweets/user/${user._id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.data.docs.length).toBe(2);
  });
});

describe("PATCH /api/v1/tweets/:tweetId", () => {
  it("rejects updates from a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();

    const tweetRes = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", ownerCookies)
      .send({ content: "Original" });

    const res = await request(app)
      .patch(`/api/v1/tweets/${tweetRes.body.data._id}`)
      .set("Cookie", otherCookies)
      .send({ content: "Hijacked" });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 for a non-existent tweet", async () => {
    const { cookies } = await registerAndLogin();
    const res = await request(app)
      .patch(`/api/v1/tweets/${NON_EXISTENT_ID}`)
      .set("Cookie", cookies)
      .send({ content: "Edited" });
    expect(res.statusCode).toBe(404);
  });

  it("allows the owner to update their tweet", async () => {
    const { cookies } = await registerAndLogin();

    const tweetRes = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", cookies)
      .send({ content: "Original" });

    const res = await request(app)
      .patch(`/api/v1/tweets/${tweetRes.body.data._id}`)
      .set("Cookie", cookies)
      .send({ content: "Edited" });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.content).toBe("Edited");
  });
});

describe("DELETE /api/v1/tweets/:tweetId", () => {
  it("rejects deletion from a non-owner with 403", async () => {
    const { cookies: ownerCookies } = await registerAndLogin();
    const { cookies: otherCookies } = await registerAndLogin();

    const tweetRes = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", ownerCookies)
      .send({ content: "Original" });

    const res = await request(app)
      .delete(`/api/v1/tweets/${tweetRes.body.data._id}`)
      .set("Cookie", otherCookies);

    expect(res.statusCode).toBe(403);
  });

  it("allows the owner to delete their tweet", async () => {
    const { cookies, user } = await registerAndLogin();

    const tweetRes = await request(app)
      .post("/api/v1/tweets")
      .set("Cookie", cookies)
      .send({ content: "Original" });

    const res = await request(app)
      .delete(`/api/v1/tweets/${tweetRes.body.data._id}`)
      .set("Cookie", cookies);

    expect(res.statusCode).toBe(200);

    const list = await request(app).get(`/api/v1/tweets/user/${user._id}`);
    expect(list.body.data.docs.length).toBe(0);
  });
});
