import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { app, request, registerAndLogin } from "../helpers/auth.js";

describe("Authentication bypass attempts on protected routes", () => {
  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/v1/users/me");
    expect(res.statusCode).toBe(401);
  });

  it("rejects a malformed bearer token", async () => {
    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", "Bearer not-a-real-jwt");
    expect(res.statusCode).toBe(401);
  });

  it("rejects a token signed with the wrong secret", async () => {
    const fakeToken = jwt.sign({ _id: "64b1f0c2e1d2f3a4b5c6d7e8" }, "wrong-secret", {
      expiresIn: "15m",
    });

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${fakeToken}`);
    expect(res.statusCode).toBe(401);
  });

  it("rejects an expired token", async () => {
    const expiredToken = jwt.sign(
      { _id: "64b1f0c2e1d2f3a4b5c6d7e8" },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: -10 },
    );

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${expiredToken}`);
    expect(res.statusCode).toBe(401);
  });

  it("rejects an alg:none token (unsigned token attack)", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    );
    const payload = Buffer.from(
      JSON.stringify({ _id: "64b1f0c2e1d2f3a4b5c6d7e8", exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    const noneToken = `${header}.${payload}.`;

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${noneToken}`);
    expect(res.statusCode).toBe(401);
  });

  it("rejects a validly-signed token whose user no longer exists", async () => {
    const token = jwt.sign(
      {
        _id: "64b1f0c2e1d2f3a4b5c6d7e8",
        email: "ghost@example.com",
        username: "ghost",
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" },
    );

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(401);
  });

  it("rejects a refresh token presented as an access token", async () => {
    const { refreshToken } = await registerAndLogin();

    const res = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${refreshToken}`);

    // Signed with a different secret (REFRESH_TOKEN_SECRET) -> verification fails.
    expect(res.statusCode).toBe(401);
  });

  it("does not leak password/refreshToken hashes via the authenticated /me response", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app).get("/api/v1/users/me").set("Cookie", cookies);

    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/); // bcrypt hash prefix
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.refreshToken).toBeUndefined();
  });
});
