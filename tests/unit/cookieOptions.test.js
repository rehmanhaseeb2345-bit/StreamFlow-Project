import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
} from "../../src/utils/cookieOptions.js";

describe("cookieOptions", () => {
  const original = {
    NODE_ENV: process.env.NODE_ENV,
    ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY,
  };

  afterEach(() => {
    process.env.NODE_ENV = original.NODE_ENV;
    process.env.ACCESS_TOKEN_EXPIRY = original.ACCESS_TOKEN_EXPIRY;
    process.env.REFRESH_TOKEN_EXPIRY = original.REFRESH_TOKEN_EXPIRY;
  });

  it("sets httpOnly + sameSite=strict on all cookie options", () => {
    for (const opts of [
      getAccessTokenCookieOptions(),
      getRefreshTokenCookieOptions(),
      getClearCookieOptions(),
    ]) {
      expect(opts.httpOnly).toBe(true);
      expect(opts.sameSite).toBe("strict");
    }
  });

  it("marks cookies secure only in production", () => {
    process.env.NODE_ENV = "production";
    expect(getAccessTokenCookieOptions().secure).toBe(true);

    process.env.NODE_ENV = "development";
    expect(getAccessTokenCookieOptions().secure).toBe(false);
  });

  it("converts '15m' access token expiry to milliseconds", () => {
    process.env.ACCESS_TOKEN_EXPIRY = "15m";
    expect(getAccessTokenCookieOptions().maxAge).toBe(15 * 60 * 1000);
  });

  it("converts '7d' refresh token expiry to milliseconds", () => {
    process.env.REFRESH_TOKEN_EXPIRY = "7d";
    expect(getRefreshTokenCookieOptions().maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("treats a bare numeric expiry as seconds", () => {
    process.env.ACCESS_TOKEN_EXPIRY = "3600";
    expect(getAccessTokenCookieOptions().maxAge).toBe(3600 * 1000);
  });

  it("omits maxAge when expiry is unparseable", () => {
    process.env.ACCESS_TOKEN_EXPIRY = "not-a-duration";
    expect(getAccessTokenCookieOptions().maxAge).toBeUndefined();
  });

  it("clear cookie options never carry a maxAge", () => {
    expect(getClearCookieOptions().maxAge).toBeUndefined();
  });
});
