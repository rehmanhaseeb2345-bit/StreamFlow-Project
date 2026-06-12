import { api } from "./client.js";

export const fetchComments = async (videoId, { page = 1 } = {}) => {
  const res = await api.get(`/comments/${videoId}`, { params: { page } });
  return res.data.data;
};

// NOTE: the created comment comes back with owner as a raw id (not populated),
// so callers should invalidate the list instead of appending the response.
export const addComment = async (videoId, content) => {
  const res = await api.post(`/comments/${videoId}`, { content });
  return res.data.data;
};

export const updateComment = async (commentId, content) => {
  const res = await api.patch(`/comments/c/${commentId}`, { content });
  return res.data.data;
};

export const deleteComment = async (commentId) => {
  const res = await api.delete(`/comments/c/${commentId}`);
  return res.data.data;
};
