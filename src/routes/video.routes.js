import { Router } from "express";
import {
  publishAVideo,
  getAllVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
} from "../controllers/video.controller.js";
import {
  upload,
  uploadImage,
  verifyFileSignatures,
} from "../middlewares/multer.middleware.js";
import { verifyJWT, verifyJWTOptional } from "../middlewares/auth.middleware.js";
import { validateMiddleware } from "../middlewares/validate.middleware.js";
import {
  publishVideoSchema,
  updateVideoSchema,
} from "../validators/video.validator.js";

const router = Router();

router.get("/", getAllVideos);

router.post(
  "/",
  verifyJWT,
  upload.fields([
    { name: "videoFile", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  verifyFileSignatures,
  validateMiddleware(publishVideoSchema),
  publishAVideo,
);

router.get("/:videoId", verifyJWTOptional, getVideoById);

router.patch(
  "/:videoId",
  verifyJWT,
  uploadImage.single("thumbnail"),
  verifyFileSignatures,
  validateMiddleware(updateVideoSchema),
  updateVideo,
);

router.delete("/:videoId", verifyJWT, deleteVideo);

router.patch("/:videoId/toggle-publish", verifyJWT, togglePublishStatus);

export default router;
