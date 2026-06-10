import request from "supertest";
import app from "../../src/app.js";
import { validPng } from "../fixtures/files.js";

let counter = 0;
const unique = () => `${Date.now()}_${process.pid}_${counter++}`;

export const buildUserPayload = (overrides = {}) => {
  const id = unique();
  return {
    fullname: "Test User",
    username: `user_${id}`.slice(0, 20),
    email: `user_${id}@example.com`,
    password: "Passw0rd!",
    ...overrides,
  };
};

// Registers a user via the real /register endpoint (multipart, with avatar).
export const registerUser = async (overrides = {}) => {
  const data = buildUserPayload(overrides);
  const res = await request(app)
    .post("/api/v1/users/register")
    .field("fullname", data.fullname)
    .field("username", data.username)
    .field("email", data.email)
    .field("password", data.password)
    .attach("avatar", validPng, {
      filename: "avatar.png",
      contentType: "image/png",
    });
  return { res, data };
};

// Registers and logs in a user, returning auth cookies + tokens for use in
// subsequent authenticated requests.
export const registerAndLogin = async (overrides = {}) => {
  const { res: registerRes, data } = await registerUser(overrides);
  if (registerRes.statusCode !== 201) {
    throw new Error(
      `registerAndLogin: registration failed (${registerRes.statusCode}): ${JSON.stringify(registerRes.body)}`,
    );
  }

  const loginRes = await request(app).post("/api/v1/users/login").send({
    username: data.username,
    password: data.password,
  });

  if (loginRes.statusCode !== 200) {
    throw new Error(
      `registerAndLogin: login failed (${loginRes.statusCode}): ${JSON.stringify(loginRes.body)}`,
    );
  }

  const cookies = loginRes.headers["set-cookie"];

  return {
    user: loginRes.body.data.user,
    cookies,
    accessToken: loginRes.body.data.accessToken,
    refreshToken: loginRes.body.data.refreshToken,
    credentials: data,
  };
};

export { app, request };
