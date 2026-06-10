import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getMe,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
} from "../controllers/user.controller.js";
import {
  uploadImage,
  verifyFileSignatures,
} from "../middlewares/multer.middleware.js";
import { validateMiddleware } from "../middlewares/validate.middleware.js";
import {
  registerUserSchema,
  loginUserSchema,
  changeCurrentPasswordSchema,
  updateAccountDetailsSchema,
} from "../validators/user.validator.js";
import { verifyJWT, verifyJWTOptional } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.post(
  "/register",
  uploadImage.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  verifyFileSignatures,
  validateMiddleware(registerUserSchema),
  registerUser,
);

router.post("/login", validateMiddleware(loginUserSchema), loginUser);

router.post("/refresh-token", refreshAccessToken);

// Secured routes
router.post("/logout", verifyJWT, logoutUser);

router.post(
  "/change-password",
  verifyJWT,
  validateMiddleware(changeCurrentPasswordSchema),
  changeCurrentPassword,
);

router.get("/me", verifyJWT, getMe);

router.patch(
  "/update-account",
  verifyJWT,
  validateMiddleware(updateAccountDetailsSchema),
  updateAccountDetails,
);

router.patch(
  "/avatar",
  verifyJWT,
  uploadImage.single("avatar"),
  verifyFileSignatures,
  updateUserAvatar,
);

router.patch(
  "/cover-image",
  verifyJWT,
  uploadImage.single("coverImage"),
  verifyFileSignatures,
  updateUserCoverImage,
);

router.get("/channel/:username", verifyJWTOptional, getUserChannelProfile);

export default router;
