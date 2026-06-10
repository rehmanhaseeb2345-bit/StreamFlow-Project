import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  if (String(channelId) === String(req.user._id)) {
    throw new ApiError(400, "You cannot subscribe to your own channel");
  }

  const channel = await User.findById(channelId).select("_id");
  if (!channel) {
    throw new ApiError(404, "Channel not found");
  }

  const existingSubscription = await Subscription.findOne({
    subscriber: req.user._id,
    channel: channelId,
  });

  if (existingSubscription) {
    await existingSubscription.deleteOne();
    return res
      .status(200)
      .json(
        new ApiResponse(200, { subscribed: false }, "Unsubscribed successfully"),
      );
  }

  try {
    await Subscription.create({
      subscriber: req.user._id,
      channel: channelId,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(200)
        .json(
          new ApiResponse(200, { subscribed: true }, "Already subscribed"),
        );
    }
    throw error;
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, { subscribed: true }, "Subscribed successfully"),
    );
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  const channel = await User.findById(channelId).select("_id");
  if (!channel) {
    throw new ApiError(404, "Channel not found");
  }

  const pipeline = [
    { $match: { channel: new mongoose.Types.ObjectId(channelId) } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
        pipeline: [{ $project: { username: 1, fullname: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$subscriber" },
    {
      $project: {
        _id: 0,
        subscriber: 1,
        subscribedAt: "$createdAt",
      },
    },
  ];

  const options = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
  };

  const result = await Subscription.aggregatePaginate(
    Subscription.aggregate(pipeline),
    options,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Subscribers fetched successfully"));
});

const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const user = await User.findById(subscriberId).select("_id");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const pipeline = [
    { $match: { subscriber: new mongoose.Types.ObjectId(subscriberId) } },
    { $sort: { createdAt: -1 } },
    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [{ $project: { username: 1, fullname: 1, avatar: 1 } }],
      },
    },
    { $unwind: "$channel" },
    {
      $project: {
        _id: 0,
        channel: 1,
        subscribedAt: "$createdAt",
      },
    },
  ];

  const options = {
    page: Math.max(1, parseInt(page, 10) || 1),
    limit: Math.min(50, Math.max(1, parseInt(limit, 10) || 10)),
  };

  const result = await Subscription.aggregatePaginate(
    Subscription.aggregate(pipeline),
    options,
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, result, "Subscribed channels fetched successfully"),
    );
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };
