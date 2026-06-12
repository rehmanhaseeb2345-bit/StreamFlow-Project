import { api } from "./client.js";

// Returns { _id, username, fullname, avatar, coverImage, subscribersCount,
// channelsSubscribedToCount, isSubscribed, createdAt } — plus email when
// viewing your own channel.
export const fetchChannelProfile = async (username) => {
  const res = await api.get(`/users/channel/${username}`);
  return res.data.data;
};

// Both fields are required by the backend. 409 = email already in use.
export const updateAccount = async ({ fullname, email }) => {
  const res = await api.patch("/users/update-account", { fullname, email });
  return res.data.data;
};

// formData with a single "avatar" file. Returns the updated user.
export const updateAvatar = async (formData) => {
  const res = await api.patch("/users/avatar", formData);
  return res.data.data;
};

// formData with a single "coverImage" file. Returns the updated user.
export const updateCoverImage = async (formData) => {
  const res = await api.patch("/users/cover-image", formData);
  return res.data.data;
};

// Revokes the refresh token server-side: the session is effectively over,
// so callers must log the user out afterwards.
export const changePassword = async ({
  oldPassword,
  newPassword,
  confirmPassword,
}) => {
  const res = await api.post("/users/change-password", {
    oldPassword,
    newPassword,
    confirmPassword,
  });
  return res.data.data;
};

// Paginated, most-recently-watched first, published videos only.
export const fetchWatchHistory = async ({ page = 1 } = {}) => {
  const res = await api.get("/users/history", { params: { page } });
  return res.data.data;
};
