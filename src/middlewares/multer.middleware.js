import multer from "multer";
import path from "path";
import crypto from "crypto";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { cleanupRequestFiles } from "../utils/fileCleanup.js";
import { matchesFileSignature } from "../utils/fileSignature.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./temp/uploads");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`);
  },
});

const allowedImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const allowedVideoMimeTypes = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
];

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "videoFile") {
    if (!allowedVideoMimeTypes.includes(file.mimetype)) {
      return cb(
        new ApiError(
          400,
          "Invalid file type. Only MP4, WebM, OGG, MOV, and MKV videos are allowed.",
        ),
        false,
      );
    }
    return cb(null, true);
  }

  if (!allowedImageMimeTypes.includes(file.mimetype)) {
    return cb(
      new ApiError(
        400,
        "Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.",
      ),
      false,
    );
  }

  cb(null, true);
};

const createUploader = (maxFileSize) =>
  multer({
    storage,
    limits: { fileSize: maxFileSize },
    fileFilter,
  });

// Video uploads. Also covers the video-publish route's thumbnail field,
// since multer applies a single size limit per .fields() call.
export const upload = createUploader(100 * 1024 * 1024); // 100MB

// Image-only uploads (avatars, cover images, standalone thumbnail updates).
export const uploadImage = createUploader(5 * 1024 * 1024); // 5MB

// Verifies that uploaded files' actual content matches their declared
// mimetype, which is client-supplied and otherwise spoofable. Must run
// after a multer middleware has populated req.file/req.files.
export const verifyFileSignatures = asyncHandler(async (req, res, next) => {
  const files = req.file ? [req.file] : Object.values(req.files || {}).flat();

  for (const file of files) {
    if (!matchesFileSignature(file.path, file.mimetype)) {
      await cleanupRequestFiles(req);
      throw new ApiError(
        400,
        `File "${file.originalname}" does not match its declared type`,
      );
    }
  }

  next();
});
