import { Router } from "express";
import {
  getVideoComments,
  addComment,
  updateComment,
  deleteComment,
} from "../controllers/comment.controller.js";
import { verifyJWT, verifyJWTOptional } from "../middlewares/auth.middleware.js";
import { validateMiddleware } from "../middlewares/validate.middleware.js";
import {
  addCommentSchema,
  updateCommentSchema,
} from "../validators/comment.validator.js";

const router = Router();

router.get("/:videoId", verifyJWTOptional, getVideoComments);

router.post(
  "/:videoId",
  verifyJWT,
  validateMiddleware(addCommentSchema),
  addComment,
);

router.patch(
  "/c/:commentId",
  verifyJWT,
  validateMiddleware(updateCommentSchema),
  updateComment,
);

router.delete("/c/:commentId", verifyJWT, deleteComment);

export default router;
