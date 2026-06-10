import { describe, it, expect, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { matchesFileSignature } from "../../src/utils/fileSignature.js";
import {
  validPng,
  validJpeg,
  validGif,
  validWebp,
  validMp4,
  validWebm,
  fakeImageAsText,
} from "../fixtures/files.js";

const writeTemp = (buffer) => {
  const file = path.join(os.tmpdir(), `sig-test-${Date.now()}-${Math.random()}`);
  fs.writeFileSync(file, buffer);
  return file;
};

describe("matchesFileSignature", () => {
  const tempFiles = [];

  afterEach(() => {
    while (tempFiles.length) {
      const f = tempFiles.pop();
      fs.existsSync(f) && fs.unlinkSync(f);
    }
  });

  const check = (buffer, mime) => {
    const file = writeTemp(buffer);
    tempFiles.push(file);
    return matchesFileSignature(file, mime);
  };

  it("accepts a valid PNG", () => {
    expect(check(validPng, "image/png")).toBe(true);
  });

  it("accepts a valid JPEG", () => {
    expect(check(validJpeg, "image/jpeg")).toBe(true);
  });

  it("accepts a valid GIF", () => {
    expect(check(validGif, "image/gif")).toBe(true);
  });

  it("accepts a valid WEBP", () => {
    expect(check(validWebp, "image/webp")).toBe(true);
  });

  it("accepts a valid MP4", () => {
    expect(check(validMp4, "video/mp4")).toBe(true);
  });

  it("accepts a valid WEBM", () => {
    expect(check(validWebm, "video/webm")).toBe(true);
  });

  it("rejects a text file masquerading as a PNG", () => {
    expect(check(fakeImageAsText, "image/png")).toBe(false);
  });

  it("rejects a text file masquerading as an MP4", () => {
    expect(check(fakeImageAsText, "video/mp4")).toBe(false);
  });

  it("rejects cross-type spoofing (JPEG bytes declared as PNG)", () => {
    expect(check(validJpeg, "image/png")).toBe(false);
  });

  it("rejects cross-type spoofing (PNG bytes declared as GIF)", () => {
    expect(check(validPng, "image/gif")).toBe(false);
  });

  it("returns true for mimetypes with no known signature (nothing to check)", () => {
    expect(check(fakeImageAsText, "application/octet-stream")).toBe(true);
  });
});
