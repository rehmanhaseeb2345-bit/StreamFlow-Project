import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { cleanupRequestFiles } from "../utils/fileCleanup.js";

const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  const videoLocalPath = req.files?.videoFile?.[0]?.path;
  const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

  if (!videoLocalPath || !thumbnailLocalPath) {
    await cleanupRequestFiles(req);
    throw new ApiError(400, "Video file and thumbnail are required");
  }

  const [videoFile, thumbnail] = await Promise.all([
    uploadOnCloudinary(videoLocalPath),
    uploadOnCloudinary(thumbnailLocalPath),
  ]);

  if (!videoFile || !thumbnail) {
    await Promise.all([
      videoFile?.public_id
        ? deleteFromCloudinary(videoFile.public_id, "video")
        : Promise.resolve(),
      thumbnail?.public_id
        ? deleteFromCloudinary(thumbnail.public_id)
        : Promise.resolve(),
    ]);
    throw new ApiError(500, "Failed to upload video or thumbnail");
  }

  let video;
  try {
    video = await Video.create({
      title,
      description,
      duration: videoFile.duration,
      videoFile: {
        url: videoFile.url,
        public_id: videoFile.public_id,
      },
      thumbnail: {
        url: thumbnail.url,
        public_id: thumbnail.public_id,
      },
      owner: req.user._id,
    });
  } catch {
    await Promise.all([
      deleteFromCloudinary(videoFile.public_id, "video"),
      deleteFromCloudinary(thumbnail.public_id),
    ]);
    throw new ApiError(500, "Video creation failed");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));
});

const getAllVideos = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    query,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query;

  const matchStage = { isPublished: true };

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid user id");
    }
    matchStage.owner = new mongoose.Types.ObjectId(userId);
  }

  if (query) {
    const safeQuery = escapeRegex(query);
    matchStage.$or = [
      { title: { $regex: safeQuery, $options: "i" } },
      { description: { $regex: safeQuery, $options: "i" } },
    ];
  }

  const allowedSortFields = ["createdAt", "views", "duration", "title"];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
  const sortOrder = sortType === "asc" ? 1 : -1;

  const pipeline = [
    { $match: matchStage },
    { $sort: { [sortField]: sortOrder } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [{ $project: { username: 1, fullname: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$owner" },
  ];

  const options = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
  };

  const result = await Video.aggregatePaginate(
    Video.aggregate(pipeline),
    options,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Videos fetched successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId).populate(
    "owner",
    "username fullname avatar",
  );

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const isOwner =
    !!req.user &&
    !!video.owner &&
    String(video.owner._id) === String(req.user._id);

  if (!video.isPublished && !isOwner) {
    throw new ApiError(404, "Video not found");
  }

  if (!isOwner) {
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $addToSet: { watchHistory: videoId },
      });
    }

    video.views += 1;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    await cleanupRequestFiles(req);
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    await cleanupRequestFiles(req);
    throw new ApiError(404, "Video not found");
  }

  if (String(video.owner) !== String(req.user._id)) {
    await cleanupRequestFiles(req);
    throw new ApiError(403, "You are not authorized to update this video");
  }

  const { title, description } = req.body;

  if (!title && !description && !req.file) {
    throw new ApiError(400, "Nothing to update");
  }

  if (title !== undefined) video.title = title;
  if (description !== undefined) video.description = description;

  if (req.file?.path) {
    const newThumbnail = await uploadOnCloudinary(req.file.path);
    if (!newThumbnail) {
      throw new ApiError(500, "Failed to upload thumbnail");
    }

    const oldThumbnailPublicId = video.thumbnail.public_id;
    video.thumbnail = {
      url: newThumbnail.url,
      public_id: newThumbnail.public_id,
    };
    await deleteFromCloudinary(oldThumbnailPublicId);
  }

  await video.save();

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (String(video.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }

  const commentIds = await Comment.find({ video: videoId }).distinct("_id");

  await Promise.all([
    deleteFromCloudinary(video.videoFile.public_id, "video"),
    deleteFromCloudinary(video.thumbnail.public_id),
  ]);

  await Promise.all([
    video.deleteOne(),
    Comment.deleteMany({ video: videoId }),
    Like.deleteMany({
      $or: [{ video: videoId }, { comment: { $in: commentIds } }],
    }),
    Playlist.updateMany(
      { videos: videoId },
      { $pull: { videos: videoId } },
    ),
    User.updateMany(
      { watchHistory: videoId },
      { $pull: { watchHistory: videoId } },
    ),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  if (String(video.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to update this video");
  }

  video.isPublished = !video.isPublished;
  await video.save();

  return res
    .status(200)
    .json(
      new ApiResponse(200, video, "Publish status toggled successfully"),
    );
});

export {
  publishAVideo,
  getAllVideos,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
