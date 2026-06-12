import { api } from "./client.js";

// { totalVideos, totalViews, totalSubscribers, totalLikes }
export const fetchChannelStats = async () => {
  const res = await api.get("/dashboard/stats");
  return res.data.data;
};

// Own videos including unpublished drafts (unlike GET /videos).
export const fetchChannelVideos = async ({ page = 1, limit = 10 } = {}) => {
  const res = await api.get("/dashboard/videos", { params: { page, limit } });
  return res.data.data;
};
