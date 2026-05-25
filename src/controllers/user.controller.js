import fs from "fs";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const cleanupRequestFiles = (req) => {
  if (req.files) {
    Object.values(req.files)
      .flat()
      .forEach((file) => {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      });
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  const isUserAlreadyExist = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (isUserAlreadyExist) {
    cleanupRequestFiles(req);
    throw new ApiError(409, "Email or username already in use");
  }

  // 2. Verify required file is present (on disk, not yet on Cloudinary)
  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    cleanupRequestFiles(req);
    throw new ApiError(400, "Avatar file is required");
  }

  // 3. Upload to Cloudinary — only after all validation and conflict checks pass
  const [avatar, coverImage] = await Promise.all([
    uploadOnCloudinary(avatarLocalPath),
    uploadOnCloudinary(coverImageLocalPath),
  ]);

  if (!avatar) {
    if (coverImage?.public_id) await deleteFromCloudinary(coverImage.public_id);
    throw new ApiError(500, "Avatar upload failed");
  }

  // 4. Create user — clean up Cloudinary assets if this fails
  let user;
  try {
    user = await User.create({
      fullname,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
      email,
      password,
      username,
    });
  } catch {
    await Promise.all([
      deleteFromCloudinary(avatar.public_id),
      coverImage?.public_id
        ? deleteFromCloudinary(coverImage.public_id)
        : Promise.resolve(),
    ]);
    throw new ApiError(500, "User creation failed");
  }

  const { password: _, refreshToken: __, ...createdUser } = user.toObject();

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User Registered Successfully"));
});

export { registerUser };
