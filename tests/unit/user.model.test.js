import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { User } from "../../src/models/user.model.js";

const baseUser = () => ({
  username: `modeltest_${Date.now()}`,
  email: `modeltest_${Date.now()}@example.com`,
  fullname: "Model Test",
  avatar: { url: "https://example.com/a.png", public_id: "a" },
  password: "Passw0rd!",
});

describe("User model", () => {
  it("hashes the password on save and never stores it in plaintext", async () => {
    const user = await User.create(baseUser());
    expect(user.password).not.toBe("Passw0rd!");
    expect(user.password.length).toBeGreaterThan(20);
  });

  it("isPasswordCorrect validates the original password", async () => {
    const user = await User.create(baseUser());
    expect(await user.isPasswordCorrect("Passw0rd!")).toBe(true);
    expect(await user.isPasswordCorrect("wrong-password")).toBe(false);
  });

  it("does not rehash the password if it is unmodified on subsequent saves", async () => {
    const user = await User.create(baseUser());
    const firstHash = user.password;

    user.fullname = "Renamed";
    await user.save();

    expect(user.password).toBe(firstHash);
  });

  it("rehashes the password when it is changed", async () => {
    const user = await User.create(baseUser());
    const firstHash = user.password;

    user.password = "NewPassw0rd!";
    await user.save();

    expect(user.password).not.toBe(firstHash);
    expect(await user.isPasswordCorrect("NewPassw0rd!")).toBe(true);
  });

  it("generateAccessToken produces a verifiable JWT with expected claims", async () => {
    const user = await User.create(baseUser());
    const token = user.generateAccessToken();

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    expect(decoded._id).toBe(String(user._id));
    expect(decoded.email).toBe(user.email);
    expect(decoded.username).toBe(user.username);
  });

  it("generateRefreshToken produces a JWT with a unique jti each call", async () => {
    const user = await User.create(baseUser());
    const token1 = user.generateRefreshToken();
    const token2 = user.generateRefreshToken();

    const decoded1 = jwt.verify(token1, process.env.REFRESH_TOKEN_SECRET);
    const decoded2 = jwt.verify(token2, process.env.REFRESH_TOKEN_SECRET);

    expect(decoded1._id).toBe(String(user._id));
    expect(decoded1.jti).not.toBe(decoded2.jti);
  });

  it("enforces unique username and email", async () => {
    const data = baseUser();
    await User.create(data);

    await expect(
      User.create({ ...baseUser(), username: data.username }),
    ).rejects.toThrow();

    await expect(
      User.create({ ...baseUser(), email: data.email }),
    ).rejects.toThrow();
  });

  it("requires avatar, password, username, email, fullname", async () => {
    await expect(User.create({})).rejects.toThrow();
  });
});
