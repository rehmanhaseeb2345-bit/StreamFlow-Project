import { api } from "./client.js";

// All toggles return { liked: boolean } — the state AFTER the toggle.

export const toggleVideoLike = async (videoId) => {
  const res = await api.post(`/likes/toggle/v/${videoId}`);
  return res.data.data;
};

export const toggleCommentLike = async (commentId) => {
  const res = await api.post(`/likes/toggle/c/${commentId}`);
  return res.data.data;
};

export const toggleTweetLike = async (tweetId) => {
  const res = await api.post(`/likes/toggle/t/${tweetId}`);
  return res.data.data;
};

export const fetchLikedVideos = async ({ page = 1 } = {}) => {
  const res = await api.get("/likes/videos", { params: { page } });
  return res.data.data;
};
