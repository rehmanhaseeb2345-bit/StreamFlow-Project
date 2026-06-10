import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.findById(videoId).select("_id owner isPublished");
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const isOwner = String(video.owner) === String(req.user._id);
  if (!video.isPublished && !isOwner) {
    throw new ApiError(404, "Video not found");
  }

  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await existingLike.deleteOne();
    return res
      .status(200)
      .json(new ApiResponse(200, { liked: false }, "Video unliked successfully"));
  }

  try {
    await Like.create({ video: videoId, likedBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(200)
        .json(new ApiResponse(200, { liked: true }, "Already liked"));
    }
    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { liked: true }, "Video liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }

  const comment = await Comment.findById(commentId).select("_id video");
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }

  const video = await Video.findById(comment.video).select(
    "_id owner isPublished",
  );
  if (!video) {
    throw new ApiError(404, "Comment not found");
  }

  const isOwner = String(video.owner) === String(req.user._id);
  if (!video.isPublished && !isOwner) {
    throw new ApiError(404, "Comment not found");
  }

  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await existingLike.deleteOne();
    return res
      .status(200)
      .json(
        new ApiResponse(200, { liked: false }, "Comment unliked successfully"),
      );
  }

  try {
    await Like.create({ comment: commentId, likedBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(200)
        .json(new ApiResponse(200, { liked: true }, "Already liked"));
    }
    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { liked: true }, "Comment liked successfully"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }

  const tweet = await Tweet.findById(tweetId).select("_id");
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }

  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user._id,
  });

  if (existingLike) {
    await existingLike.deleteOne();
    return res
      .status(200)
      .json(
        new ApiResponse(200, { liked: false }, "Tweet unliked successfully"),
      );
  }

  try {
    await Like.create({ tweet: tweetId, likedBy: req.user._id });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(200)
        .json(new ApiResponse(200, { liked: true }, "Already liked"));
    }
    throw error;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { liked: true }, "Tweet liked successfully"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;

  const pipeline = [
    { $match: { likedBy: req.user._id, video: { $exists: true } } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                { $project: { username: 1, fullname: 1, avatar: 1 } },
              ],
            },
          },
          { $unwind: "$owner" },
        ],
      },
    },
    { $unwind: "$video" },
    { $match: { "video.isPublished": true } },
    { $replaceRoot: { newRoot: "$video" } },
  ];

  const options = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
  };

  const result = await Like.aggregatePaginate(Like.aggregate(pipeline), options);

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Liked videos fetched successfully"));
});

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };
