import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPaginationOptions } from "../utils/pagination.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const playlist = await Playlist.create({
    name,
    description: description || "",
    videos: [],
    owner: req.user._id,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { videoId } = req.query;

  if (!isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user id");
  }

  const user = await User.findById(userId).select("_id");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Optional ?videoId= adds a hasVideo flag per playlist so clients can
  // render checked/unchecked membership (e.g. a save-to-playlist dialog)
  // without fetching every playlist's full video list.
  const addFields = { videoCount: { $size: "$videos" } };
  if (videoId !== undefined) {
    if (!isValidObjectId(videoId)) {
      throw new ApiError(400, "Invalid video id");
    }
    addFields.hasVideo = {
      $in: [new mongoose.Types.ObjectId(videoId), "$videos"],
    };
  }

  const pipeline = [
    { $match: { owner: new mongoose.Types.ObjectId(userId) } },
    { $addFields: addFields },
    {
      $project: {
        name: 1,
        description: 1,
        videoCount: 1,
        hasVideo: 1,
        owner: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
    { $sort: { createdAt: -1 } },
  ];

  const options = getPaginationOptions(req.query);

  const result = await Playlist.aggregatePaginate(
    Playlist.aggregate(pipeline),
    options,
  );

  return res
    .status(200)
    .json(new ApiResponse(200, result, "Playlists fetched successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  const playlist = await Playlist.findById(playlistId)
    .populate("owner", "username fullname avatar")
    .populate({
      path: "videos",
      populate: { path: "owner", select: "username fullname avatar" },
    });

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  const isOwner =
    !!req.user &&
    !!playlist.owner &&
    String(playlist.owner._id) === String(req.user._id);

  // Drop entries for videos that no longer exist (dangling references), and
  // hide unpublished videos from anyone but the playlist owner.
  playlist.videos = playlist.videos.filter((video) => {
    if (!video) return false;
    return isOwner || video.isPublished;
  });

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid playlist or video id");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (String(playlist.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to modify this playlist");
  }

  const video = await Video.findById(videoId).select("_id owner isPublished");
  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const isVideoOwner = String(video.owner) === String(req.user._id);
  if (!video.isPublished && !isVideoOwner) {
    throw new ApiError(404, "Video not found");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $addToSet: { videos: videoId } },
    { new: true },
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedPlaylist, "Video added to playlist successfully"),
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid playlist or video id");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (String(playlist.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to modify this playlist");
  }

  const updatedPlaylist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $pull: { videos: videoId } },
    { new: true },
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedPlaylist,
        "Video removed from playlist successfully",
      ),
    );
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  if (name === undefined && description === undefined) {
    throw new ApiError(400, "Nothing to update");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (String(playlist.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to update this playlist");
  }

  if (name !== undefined) playlist.name = name;
  if (description !== undefined) playlist.description = description;

  await playlist.save();

  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist updated successfully"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid playlist id");
  }

  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  if (String(playlist.owner) !== String(req.user._id)) {
    throw new ApiError(403, "You are not authorized to delete this playlist");
  }

  await playlist.deleteOne();

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  updatePlaylist,
  deletePlaylist,
};
