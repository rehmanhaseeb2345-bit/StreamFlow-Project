import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPlaylistById,
  updatePlaylist,
  deletePlaylist,
  removeVideoFromPlaylist,
} from "../api/playlists.js";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import { usePageTitle } from "../lib/usePageTitle.js";
import { formatDuration, formatViews, timeAgo } from "../lib/format.js";
import {
  PLAYLIST_NAME_RULES,
  PLAYLIST_DESCRIPTION_RULES,
} from "../lib/constants.js";

const Playlist = () => {
  const { playlistId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [actionError, setActionError] = useState("");

  const playlistKey = ["playlist", playlistId];

  const {
    data: playlist,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: playlistKey,
    queryFn: () => fetchPlaylistById(playlistId),
    retry: false,
  });

  usePageTitle(playlist?.name);

  const isOwner = !!user && playlist?.owner?._id === user._id;

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePlaylist(playlistId, {
        name: draftName.trim(),
        description: draftDescription.trim(),
      }),
    onSuccess: () => {
      setIsEditing(false);
      setActionError("");
      queryClient.invalidateQueries({ queryKey: playlistKey });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
    onError: (err) => setActionError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePlaylist(playlistId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: playlistKey });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
      navigate(`/channel/${user.username}`);
    },
    onError: (err) => setActionError(err.message),
  });

  const removeVideoMutation = useMutation({
    mutationFn: (videoId) => removeVideoFromPlaylist(playlistId, videoId),
    onSuccess: () => {
      setActionError("");
      queryClient.invalidateQueries({ queryKey: playlistKey });
      queryClient.invalidateQueries({ queryKey: ["playlists"] });
    },
    onError: (err) => setActionError(err.message),
  });

  if (isLoading) return <Spinner fullPage />;

  if (isError) {
    return (
      <div className="not-found">
        <h1>{error.statusCode === 404 ? "Playlist not found" : "Error"}</h1>
        <p>{error.message}</p>
        <Link to="/">Go home</Link>
      </div>
    );
  }

  const trimmedName = draftName.trim();
  const canSave =
    trimmedName.length >= PLAYLIST_NAME_RULES.minLength &&
    trimmedName.length <= PLAYLIST_NAME_RULES.maxLength &&
    draftDescription.trim().length <= PLAYLIST_DESCRIPTION_RULES.maxLength &&
    !updateMutation.isPending;

  return (
    <div className="playlist-page">
      {isEditing ? (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) updateMutation.mutate();
          }}
        >
          <div className="form-field">
            <label htmlFor="playlist-name">Name</label>
            <input
              id="playlist-name"
              type="text"
              value={draftName}
              maxLength={PLAYLIST_NAME_RULES.maxLength}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="playlist-description">Description</label>
            <textarea
              id="playlist-description"
              rows={2}
              value={draftDescription}
              maxLength={PLAYLIST_DESCRIPTION_RULES.maxLength}
              onChange={(e) => setDraftDescription(e.target.value)}
            />
          </div>
          <div className="form-row">
            <button type="submit" disabled={!canSave}>
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="playlist-header">
          <div>
            <h1>{playlist.name}</h1>
            {playlist.description && <p>{playlist.description}</p>}
            <p className="subscription-meta">
              By{" "}
              <Link to={`/channel/${playlist.owner?.username}`}>
                {playlist.owner?.fullname}
              </Link>{" "}
              • {playlist.videos.length}{" "}
              {playlist.videos.length === 1 ? "video" : "videos"} • updated{" "}
              {timeAgo(playlist.updatedAt)}
            </p>
          </div>
          {isOwner && (
            <div className="form-row">
              <button
                type="button"
                onClick={() => {
                  setDraftName(playlist.name);
                  setDraftDescription(playlist.description ?? "");
                  setIsEditing(true);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete playlist "${playlist.name}"?`)) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {actionError && <p className="message-error">{actionError}</p>}

      {playlist.videos.length === 0 ? (
        <p className="empty-state">This playlist is empty.</p>
      ) : (
        <div className="playlist-videos">
          {playlist.videos.map((video) => (
            <div key={video._id} className="playlist-video-row">
              <Link to={`/watch/${video._id}`} className="playlist-video-main">
                <div className="playlist-video-thumb">
                  <img src={video.thumbnail?.url} alt={video.title} />
                  <span className="video-card-duration">
                    {formatDuration(video.duration)}
                  </span>
                </div>
                <div>
                  <p className="video-card-title">{video.title}</p>
                  <p className="video-card-meta">
                    {video.owner?.fullname} • {formatViews(video.views)} •{" "}
                    {timeAgo(video.createdAt)}
                  </p>
                </div>
              </Link>
              {isOwner && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => removeVideoMutation.mutate(video._id)}
                  disabled={removeVideoMutation.isPending}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Playlist;
