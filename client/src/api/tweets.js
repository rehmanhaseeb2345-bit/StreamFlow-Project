import { api } from "./client.js";

export const createTweet = async (content) => {
  const res = await api.post("/tweets", { content });
  return res.data.data;
};

// Paginated; each doc has owner populated + likesCount + isLiked.
export const fetchUserTweets = async (userId, { page = 1 } = {}) => {
  const res = await api.get(`/tweets/user/${userId}`, { params: { page } });
  return res.data.data;
};

export const updateTweet = async (tweetId, content) => {
  const res = await api.patch(`/tweets/${tweetId}`, { content });
  return res.data.data;
};

export const deleteTweet = async (tweetId) => {
  const res = await api.delete(`/tweets/${tweetId}`);
  return res.data.data;
};
