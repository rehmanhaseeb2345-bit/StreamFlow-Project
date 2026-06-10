import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { logger } from "../utils/logger.js";
import { cleanupRequestFiles } from "../utils/fileCleanup.js";
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  getClearCookieOptions,
} from "../utils/cookieOptions.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Token generation failed:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating auth tokens",
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  const isUserAlreadyExist = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (isUserAlreadyExist) {
    await cleanupRequestFiles(req);
    throw new ApiError(409, "Email or username already in use");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    await cleanupRequestFiles(req);
    throw new ApiError(400, "Avatar file is required");
  }

  const [avatar, coverImage] = await Promise.all([
    uploadOnCloudinary(avatarLocalPath),
    uploadOnCloudinary(coverImageLocalPath),
  ]);

  if (!avatar) {
    if (coverImage?.public_id) await deleteFromCloudinary(coverImage.public_id);
    throw new ApiError(500, "Avatar upload failed");
  }

  let user;
  try {
    user = await User.create({
      fullname,
      avatar: { url: avatar.url, public_id: avatar.public_id },
      coverImage: coverImage
        ? { url: coverImage.url, public_id: coverImage.public_id }
        : undefined,
      email,
      password,
      username,
    });
  } catch (error) {
    await Promise.all([
      deleteFromCloudinary(avatar.public_id),
      coverImage?.public_id
        ? deleteFromCloudinary(coverImage.public_id)
        : Promise.resolve(),
    ]);
    if (error.code === 11000) {
      throw new ApiError(409, "Email or username already in use");
    }
    throw new ApiError(500, "User creation failed");
  }

  const { password: _, refreshToken: __, ...createdUser } = user.toObject();

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User Registered Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  const orConditions = [];
  if (email) orConditions.push({ email });
  if (username) orConditions.push({ username });

  const user = await User.findOne(
    { $or: orConditions },
    {
      password: 1,
      refreshToken: 1,
      email: 1,
      username: 1,
      fullname: 1,
      avatar: 1,
      coverImage: 1,
    },
  );

  if (!user) {
    logger.warn("login_failed", { reason: "user_not_found", ip: req.ip });
    throw new ApiError(401, "Invalid Credentials");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    logger.warn("login_failed", {
      reason: "invalid_password",
      userId: String(user._id),
      ip: req.ip,
    });
    throw new ApiError(401, "Invalid Credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id,
  );

  const loggedInUser = user.toObject();

  delete loggedInUser.password;
  delete loggedInUser.refreshToken;

  logger.info("login_success", {
    userId: String(loggedInUser._id),
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return res
    .status(200)
    .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
    .cookie("refreshToken", refreshToken, getRefreshTokenCookieOptions())
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully",
      ),
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    },
  );

  const options = getClearCookieOptions();

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incommingRefreshToken =
    req.cookies.refreshToken || req.body?.refreshToken;

  if (!incommingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }

  let decodedToken;
  try {
    decodedToken = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(401, "Invalid Refresh Token");
  }

  if (incommingRefreshToken !== user?.refreshToken) {
    throw new ApiError(401, "Refresh Token is expired or used");
  }

  const { accessToken, refreshToken: newRefreshToken } =
    await generateAccessAndRefreshTokens(user._id);

  return res
    .status(200)
    .cookie("accessToken", accessToken, getAccessTokenCookieOptions())
    .cookie("refreshToken", newRefreshToken, getRefreshTokenCookieOptions())
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken: newRefreshToken },
        "Access token Refreshed",
      ),
    );
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    throw new ApiError(400, "Passwords do not match");
  }

  const user = await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid old password");
  }

  user.password = newPassword;
  user.refreshToken = undefined;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .clearCookie("refreshToken", getClearCookieOptions())
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const getMe = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError(400, "All fields are required");
  }

  let user;
  try {
    user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          fullname,
          email,
        },
      },
      { new: true },
    ).select("-password");
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "Email already in use");
    }
    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar?.url) {
    throw new ApiError(500, "Error while uploading avatar");
  }

  const oldAvatarPublicId = req.user.avatar?.public_id;

  let user;
  try {
    user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: { url: avatar.url, public_id: avatar.public_id },
        },
      },
      { new: true },
    ).select("-password");
  } catch (error) {
    await deleteFromCloudinary(avatar.public_id);
    throw error;
  }

  if (oldAvatarPublicId) {
    await deleteFromCloudinary(oldAvatarPublicId);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverLocalPath = req.file?.path;

  if (!coverLocalPath) {
    throw new ApiError(400, "Cover image file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverLocalPath);

  if (!coverImage?.url) {
    throw new ApiError(500, "Error while uploading cover image");
  }

  const oldCoverImagePublicId = req.user.coverImage?.public_id;

  let user;
  try {
    user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          coverImage: { url: coverImage.url, public_id: coverImage.public_id },
        },
      },
      { new: true },
    ).select("-password");
  } catch (error) {
    await deleteFromCloudinary(coverImage.public_id);
    throw error;
  }

  if (oldCoverImagePublicId) {
    await deleteFromCloudinary(oldCoverImagePublicId);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "Username is missing");
  }

  const requesterId = req.user?._id ?? null;

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [requesterId, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        createdAt: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(404, "channel does not exist");
  }

  // Email is private; only expose it to the channel owner viewing their own profile.
  if (requesterId && String(channel[0]._id) === String(requesterId)) {
    channel[0].email = req.user.email;
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully "),
    );
});

export {
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
};
