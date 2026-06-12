// Mirrors the backend's Zod validators (src/validators/*.js) and multer
// limits (src/middlewares/multer.middleware.js). Keep in sync — validating
// client-side avoids uploading a 100MB file only to fail text validation.

export const USERNAME_RULES = {
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-zA-Z0-9_]+$/,
  message: "3-20 characters; letters, numbers, and underscores only",
};

export const FULLNAME_RULES = {
  minLength: 3,
  maxLength: 50,
  message: "3-50 characters",
};

export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 64,
  pattern: /^(?=.*[0-9])(?=.*[!@#$%^&*])/,
  message: "8-64 characters with at least one number and one of !@#$%^&*",
};

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100MB

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "video/x-matroska",
];

export const VIDEO_TITLE_RULES = { minLength: 3, maxLength: 100 };
export const VIDEO_DESCRIPTION_RULES = { minLength: 1, maxLength: 5000 };
export const COMMENT_RULES = { minLength: 1, maxLength: 1000 };
export const TWEET_RULES = { minLength: 1, maxLength: 280 };
export const PLAYLIST_NAME_RULES = { minLength: 1, maxLength: 100 };
export const PLAYLIST_DESCRIPTION_RULES = { maxLength: 500 };

// Validates a picked image file; returns an error string or null.
export const validateImageFile = (file) => {
  if (!file) return null;
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, WebP, and GIF images are allowed";
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return "Image must be 5MB or smaller";
  }
  return null;
};

export const validateVideoFile = (file) => {
  if (!file) return null;
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return "Only MP4, WebM, OGG, MOV, and MKV videos are allowed";
  }
  if (file.size > VIDEO_MAX_BYTES) {
    return "Video must be 100MB or smaller";
  }
  return null;
};
