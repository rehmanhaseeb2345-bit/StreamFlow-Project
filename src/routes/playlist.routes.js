import { Router } from "express";
import {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  updatePlaylist,
  deletePlaylist,
} from "../controllers/playlist.controller.js";
import { verifyJWT, verifyJWTOptional } from "../middlewares/auth.middleware.js";
import { validateMiddleware } from "../middlewares/validate.middleware.js";
import {
  createPlaylistSchema,
  updatePlaylistSchema,
} from "../validators/playlist.validator.js";

const router = Router();

router.get("/user/:userId", getUserPlaylists);

router.post(
  "/",
  verifyJWT,
  validateMiddleware(createPlaylistSchema),
  createPlaylist,
);

router.get("/:playlistId", verifyJWTOptional, getPlaylistById);

router.patch(
  "/:playlistId",
  verifyJWT,
  validateMiddleware(updatePlaylistSchema),
  updatePlaylist,
);

router.delete("/:playlistId", verifyJWT, deletePlaylist);

router.patch(
  "/:playlistId/videos/:videoId",
  verifyJWT,
  addVideoToPlaylist,
);

router.delete(
  "/:playlistId/videos/:videoId",
  verifyJWT,
  removeVideoFromPlaylist,
);

export default router;
