import fs from "fs";

// Magic-byte signatures for the mime types accepted by the upload
// middleware. Checking these prevents a client from uploading arbitrary
// content while spoofing the Content-Type/mimetype of a file part.
const SIGNATURES = {
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/png": [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  "image/gif": [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
  ],
  "image/webp": "webp", // RIFF....WEBP
  "video/mp4": "ftyp", // ....ftyp at offset 4 (ISO base media container)
  "video/quicktime": "qt-atom", // ftyp or a handful of legacy QuickTime atoms
  "video/webm": [[0x1a, 0x45, 0xdf, 0xa3]], // EBML/Matroska container
  "video/x-matroska": [[0x1a, 0x45, 0xdf, 0xa3]],
  "video/ogg": [[0x4f, 0x67, 0x67, 0x53]], // "OggS"
};

const QUICKTIME_ATOMS = ["ftyp", "moov", "free", "mdat", "wide", "skip", "pnot"];

const HEADER_BYTES = 12;

const matchesBytes = (buffer, signature) =>
  signature.every((byte, index) => buffer[index] === byte);

// Returns true if the file's leading bytes are consistent with the given
// mimetype, or if the mimetype has no signature defined (nothing to check).
export const matchesFileSignature = (filePath, mimetype) => {
  const signature = SIGNATURES[mimetype];
  if (!signature) return true;

  const buffer = Buffer.alloc(HEADER_BYTES);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, HEADER_BYTES, 0);
  } finally {
    fs.closeSync(fd);
  }

  if (signature === "webp") {
    return (
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP"
    );
  }

  if (signature === "ftyp") {
    return buffer.toString("ascii", 4, 8) === "ftyp";
  }

  if (signature === "qt-atom") {
    return QUICKTIME_ATOMS.includes(buffer.toString("ascii", 4, 8));
  }

  return signature.some((sig) => matchesBytes(buffer, sig));
};
