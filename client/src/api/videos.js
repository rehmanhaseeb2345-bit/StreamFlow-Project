import { api } from "./client.js";

// Backend list endpoints share the aggregate-paginate envelope:
// { docs, totalDocs, limit, page, totalPages, hasNextPage, nextPage, ... }

// params: { query?, sortBy?, sortType?, userId? } — page comes from the
// infinite query's pageParam.
export const fetchVideos = async ({ page = 1, ...params } = {}) => {
  const res = await api.get("/videos", { params: { ...params, page } });
  return res.data.data;
};

// NOTE: every non-owner call increments the view count server-side, so this
// must only be fetched once per visit (staleTime handles that in the page).
export const fetchVideoById = async (videoId) => {
  const res = await api.get(`/videos/${videoId}`);
  return res.data.data;
};

// formData: videoFile + thumbnail + title + description. Uploads are large
// (up to 100MB), so callers should surface onProgress in the UI.
export const publishVideo = async (formData, onProgress) => {
  const res = await api.post("/videos", formData, {
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
  return res.data.data;
};

// The update route always runs multer, so always send FormData (works fine
// with only text fields). thumbnail is optional.
export const updateVideo = async (videoId, formData) => {
  const res = await api.patch(`/videos/${videoId}`, formData);
  return res.data.data;
};

export const deleteVideo = async (videoId) => {
  const res = await api.delete(`/videos/${videoId}`);
  return res.data.data;
};

export const togglePublishStatus = async (videoId) => {
  const res = await api.patch(`/videos/${videoId}/toggle-publish`);
  return res.data.data;
};
