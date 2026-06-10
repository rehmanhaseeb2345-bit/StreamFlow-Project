// Minimal buffers carrying valid magic-byte signatures for the file types
// accepted by src/utils/fileSignature.js. Only the leading bytes matter for
// signature checks, so the rest of each buffer is arbitrary padding.

export const validPng = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

export const validJpeg = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

export const validGif = Buffer.from(
  "GIF89a\x00\x00\x00\x00\x00\x00",
  "binary",
);

export const validWebp = Buffer.from("RIFF\x00\x00\x00\x00WEBP", "binary");

// MP4 container: "ftyp" must appear at byte offset 4.
export const validMp4 = Buffer.from([
  0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);

// Matroska/WebM EBML header.
export const validWebm = Buffer.from([
  0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

// Plain text content with a spoofed image mimetype/extension - should be
// rejected by verifyFileSignatures.
export const fakeImageAsText = Buffer.from(
  "this is definitely not an image, just plain text padding",
  "utf-8",
);
