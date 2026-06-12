import { api } from "./client.js";

export const createPlaylist = async ({ name, description = "" }) => {
  const res = await api.post("/playlists", { name, description });
  return res.data.data;
};

// docs include videoCount but NOT the videos array (list projection).
// Pass videoId to also get a hasVideo flag per playlist (membership).
export const fetchUserPlaylists = async (
  userId,
  { page = 1, videoId } = {},
) => {
  const res = await api.get(`/playlists/user/${userId}`, {
    params: { page, videoId },
  });
  return res.data.data;
};

// Fully populated: videos[] with their owners. Unpublished videos are
// hidden from everyone but the playlist owner.
export const fetchPlaylistById = async (playlistId) => {
  const res = await api.get(`/playlists/${playlistId}`);
  return res.data.data;
};

export const updatePlaylist = async (playlistId, body) => {
  const res = await api.patch(`/playlists/${playlistId}`, body);
  return res.data.data;
};

export const deletePlaylist = async (playlistId) => {
  const res = await api.delete(`/playlists/${playlistId}`);
  return res.data.data;
};

// $addToSet server-side — adding an already-present video is a no-op.
export const addVideoToPlaylist = async (playlistId, videoId) => {
  const res = await api.patch(`/playlists/${playlistId}/videos/${videoId}`);
  return res.data.data;
};

export const removeVideoFromPlaylist = async (playlistId, videoId) => {
  const res = await api.delete(`/playlists/${playlistId}/videos/${videoId}`);
  return res.data.data;
};
