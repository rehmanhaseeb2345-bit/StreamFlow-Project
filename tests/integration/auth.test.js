import { describe, it, expect } from "vitest";
import { app, request, registerUser, registerAndLogin, buildUserPayload } from "../helpers/auth.js";
import { validPng, validJpeg } from "../fixtures/files.js";

describe("POST /api/v1/users/register", () => {
  it("registers a new user with an avatar", async () => {
    const { res, data } = await registerUser();

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.username).toBe(data.username);
    expect(res.body.data.email).toBe(data.email);
    expect(res.body.data).not.toHaveProperty("password");
    expect(res.body.data).not.toHaveProperty("refreshToken");
    expect(res.body.data.avatar.url).toContain("res.cloudinary.com");
  });

  it("rejects registration without an avatar", async () => {
    const data = buildUserPayload();
    const res = await request(app)
      .post("/api/v1/users/register")
      .field("fullname", data.fullname)
      .field("username", data.username)
      .field("email", data.email)
      .field("password", data.password);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/avatar/i);
  });

  it("rejects duplicate username/email with 409", async () => {
    const { data } = await registerUser();

    const dup = await request(app)
      .post("/api/v1/users/register")
      .field("fullname", "Another Name")
      .field("username", data.username)
      .field("email", `different_${data.email}`)
      .field("password", "Passw0rd!")
      .attach("avatar", validPng, { filename: "a.png", contentType: "image/png" });

    expect(dup.statusCode).toBe(409);
  });

  it.each([
    ["fullname too short", { fullname: "ab" }],
    ["username with invalid characters", { username: "bad name!" }],
    ["username too short", { username: "ab" }],
    ["invalid email", { email: "not-an-email" }],
    ["password too short", { password: "short1!" }],
    ["password missing special char/number", { password: "longpasswordnonum" }],
  ])("rejects invalid input: %s", async (_label, override) => {
    const data = buildUserPayload(override);
    const res = await request(app)
      .post("/api/v1/users/register")
      .field("fullname", data.fullname)
      .field("username", data.username)
      .field("email", data.email)
      .field("password", data.password)
      .attach("avatar", validPng, { filename: "a.png", contentType: "image/png" });

    expect(res.statusCode).toBe(400);
  });

  it("rejects a file whose content does not match its declared mimetype", async () => {
    const data = buildUserPayload();
    const res = await request(app)
      .post("/api/v1/users/register")
      .field("fullname", data.fullname)
      .field("username", data.username)
      .field("email", data.email)
      .field("password", data.password)
      .attach("avatar", validJpeg, { filename: "avatar.png", contentType: "image/png" });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/does not match/i);
  });

  it("rejects unsupported file types for avatar", async () => {
    const data = buildUserPayload();
    const res = await request(app)
      .post("/api/v1/users/register")
      .field("fullname", data.fullname)
      .field("username", data.username)
      .field("email", data.email)
      .field("password", data.password)
      .attach("avatar", Buffer.from("not an image"), {
        filename: "avatar.txt",
        contentType: "text/plain",
      });

    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/v1/users/login", () => {
  it("logs in with username + password and sets auth cookies", async () => {
    const { res, data } = await registerUser();
    expect(res.statusCode).toBe(201);

    const loginRes = await request(app)
      .post("/api/v1/users/login")
      .send({ username: data.username, password: data.password });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.body.data.accessToken).toBeTruthy();
    expect(loginRes.body.data.refreshToken).toBeTruthy();
    expect(loginRes.body.data.user.password).toBeUndefined();

    const cookies = loginRes.headers["set-cookie"].join(";");
    expect(cookies).toMatch(/accessToken=/);
    expect(cookies).toMatch(/refreshToken=/);
    expect(cookies).toMatch(/HttpOnly/i);
  });

  it("logs in with email + password", async () => {
    const { data } = await registerUser();

    const loginRes = await request(app)
      .post("/api/v1/users/login")
      .send({ email: data.email, password: data.password });

    expect(loginRes.statusCode).toBe(200);
  });

  it("rejects login with wrong password with 401 and a generic message", async () => {
    const { data } = await registerUser();

    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ username: data.username, password: "WrongPassw0rd!" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid Credentials");
  });

  it("rejects login for a non-existent user with the same generic message", async () => {
    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ username: "no_such_user", password: "WrongPassw0rd!" });

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toBe("Invalid Credentials");
  });

  it("rejects login when neither username nor email is provided", async () => {
    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ password: "Passw0rd!" });

    expect(res.statusCode).toBe(400);
  });

  it("rejects login with an empty password", async () => {
    const { data } = await registerUser();
    const res = await request(app)
      .post("/api/v1/users/login")
      .send({ username: data.username, password: "" });

    expect(res.statusCode).toBe(400);
  });
});

describe("POST /api/v1/users/logout", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/v1/users/logout");
    expect(res.statusCode).toBe(401);
  });

  it("clears cookies and unsets the refresh token", async () => {
    const { cookies, refreshToken } = await registerAndLogin();

    const logoutRes = await request(app)
      .post("/api/v1/users/logout")
      .set("Cookie", cookies);

    expect(logoutRes.statusCode).toBe(200);
    const setCookies = logoutRes.headers["set-cookie"].join(";");
    expect(setCookies).toMatch(/accessToken=;/);
    expect(setCookies).toMatch(/refreshToken=;/);

    // The old refresh token must no longer work.
    const refreshRes = await request(app)
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken });

    expect(refreshRes.statusCode).toBe(401);
  });
});

describe("POST /api/v1/users/refresh-token", () => {
  it("rejects when no refresh token is provided", async () => {
    const res = await request(app).post("/api/v1/users/refresh-token");
    expect(res.statusCode).toBe(401);
  });

  it("rejects an invalid/garbage refresh token", async () => {
    const res = await request(app)
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken: "not.a.valid.jwt" });

    expect(res.statusCode).toBe(401);
  });

  it("issues new tokens for a valid refresh token (rotation)", async () => {
    const { refreshToken } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken });

    expect(res.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.refreshToken).not.toBe(refreshToken);
  });

  it("rejects reuse of a rotated-out refresh token", async () => {
    const { refreshToken } = await registerAndLogin();

    const first = await request(app)
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken });
    expect(first.statusCode).toBe(200);

    const second = await request(app)
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken });
    expect(second.statusCode).toBe(401);
  });

  it("accepts the refresh token via cookie as well as body", async () => {
    const { cookies } = await registerAndLogin();
    const refreshCookie = cookies.find((c) => c.startsWith("refreshToken="));

    const res = await request(app)
      .post("/api/v1/users/refresh-token")
      .set("Cookie", refreshCookie);

    expect(res.statusCode).toBe(200);
  });
});

describe("POST /api/v1/users/change-password", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/v1/users/change-password")
      .send({ oldPassword: "x", newPassword: "Newpass1!", confirmPassword: "Newpass1!" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects when newPassword and confirmPassword mismatch", async () => {
    const { cookies, credentials } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/users/change-password")
      .set("Cookie", cookies)
      .send({
        oldPassword: credentials.password,
        newPassword: "Newpass1!",
        confirmPassword: "Different1!",
      });

    expect(res.statusCode).toBe(400);
  });

  it("rejects an incorrect old password", async () => {
    const { cookies } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/users/change-password")
      .set("Cookie", cookies)
      .send({
        oldPassword: "WrongOld1!",
        newPassword: "Newpass1!",
        confirmPassword: "Newpass1!",
      });

    expect(res.statusCode).toBe(401);
  });

  it("changes the password and invalidates the refresh token", async () => {
    const { cookies, credentials, refreshToken } = await registerAndLogin();

    const res = await request(app)
      .post("/api/v1/users/change-password")
      .set("Cookie", cookies)
      .send({
        oldPassword: credentials.password,
        newPassword: "Newpass1!",
        confirmPassword: "Newpass1!",
      });

    expect(res.statusCode).toBe(200);

    // Old refresh token should now be invalid.
    const refreshRes = await request(app)
      .post("/api/v1/users/refresh-token")
      .send({ refreshToken });
    expect(refreshRes.statusCode).toBe(401);

    // New password should work for login.
    const loginRes = await request(app)
      .post("/api/v1/users/login")
      .send({ username: credentials.username, password: "Newpass1!" });
    expect(loginRes.statusCode).toBe(200);

    // Old password should no longer work.
    const oldLoginRes = await request(app)
      .post("/api/v1/users/login")
      .send({ username: credentials.username, password: credentials.password });
    expect(oldLoginRes.statusCode).toBe(401);
  });
});
