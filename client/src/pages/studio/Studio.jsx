import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { fetchChannelStats, fetchChannelVideos } from "../../api/dashboard.js";
import { deleteVideo, togglePublishStatus } from "../../api/videos.js";
import Spinner from "../../components/ui/Spinner.jsx";
import { usePageTitle } from "../../lib/usePageTitle.js";
import { formatCount, formatDate } from "../../lib/format.js";

const StatCard = ({ label, value }) => (
  <div className="stat-card">
    <p className="stat-value">{formatCount(value)}</p>
    <p className="stat-label">{label}</p>
  </div>
);

const Studio = () => {
  usePageTitle("Creator Studio");
  const location = useLocation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState("");
  const successMessage = location.state?.message;

  const statsQuery = useQuery({
    queryKey: ["studio", "stats"],
    queryFn: fetchChannelStats,
  });

  const videosKey = ["studio", "videos", page];
  const videosQuery = useQuery({
    queryKey: videosKey,
    queryFn: () => fetchChannelVideos({ page }),
    placeholderData: keepPreviousData,
  });

  const toggleMutation = useMutation({
    mutationFn: togglePublishStatus,
    onMutate: async (videoId) => {
      await queryClient.cancelQueries({ queryKey: videosKey });
      const previous = queryClient.getQueryData(videosKey);
      queryClient.setQueryData(videosKey, (data) =>
        data
          ? {
              ...data,
              docs: data.docs.map((v) =>
                v._id === videoId ? { ...v, isPublished: !v.isPublished } : v,
              ),
            }
          : data,
      );
      return { previous };
    },
    onError: (err, _videoId, context) => {
      queryClient.setQueryData(videosKey, context.previous);
      setActionError(err.message);
    },
    onSettled: (_data, _err, videoId) => {
      // Public lists and the watch page see publish state too.
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.removeQueries({ queryKey: ["video", videoId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVideo,
    onSuccess: (_data, videoId) => {
      setActionError("");
      // The backend cascades (comments, likes, playlists, history) — drop
      // every cache that could contain this video.
      queryClient.removeQueries({ queryKey: ["video", videoId] });
      queryClient.removeQueries({ queryKey: ["comments", videoId] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["studio"] });
    },
    onError: (err) => setActionError(err.message),
  });

  const handleDelete = (video) => {
    const confirmed = window.confirm(
      `Delete "${video.title}" permanently? This also removes its comments and likes.`,
    );
    if (confirmed) deleteMutation.mutate(video._id);
  };

  const videos = videosQuery.data;

  return (
    <div className="studio-page">
      <div className="studio-header">
        <h1>Creator Studio</h1>
        <Link to="/studio/upload">
          <button type="button">Upload video</button>
        </Link>
      </div>

      {successMessage && <p className="message-success">{successMessage}</p>}
      {actionError && <p className="message-error">{actionError}</p>}

      {statsQuery.isLoading ? (
        <Spinner />
      ) : statsQuery.isError ? (
        <p className="message-error">{statsQuery.error.message}</p>
      ) : (
        <div className="stats-grid">
          <StatCard label="Videos" value={statsQuery.data.totalVideos} />
          <StatCard label="Views" value={statsQuery.data.totalViews} />
          <StatCard
            label="Subscribers"
            value={statsQuery.data.totalSubscribers}
          />
          <StatCard label="Likes" value={statsQuery.data.totalLikes} />
        </div>
      )}

      <h2>Your videos</h2>

      {videosQuery.isLoading ? (
        <Spinner />
      ) : videosQuery.isError ? (
        <p className="message-error">{videosQuery.error.message}</p>
      ) : videos.docs.length === 0 ? (
        <p className="empty-state">
          No videos yet. <Link to="/studio/upload">Upload your first one.</Link>
        </p>
      ) : (
        <>
          <table className="studio-table">
            <thead>
              <tr>
                <th>Video</th>
                <th>Status</th>
                <th>Views</th>
                <th>Published</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.docs.map((video) => (
                <tr key={video._id}>
                  <td>
                    <Link to={`/watch/${video._id}`} className="studio-video-cell">
                      <img src={video.thumbnail?.url} alt="" />
                      <span>{video.title}</span>
                    </Link>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => toggleMutation.mutate(video._id)}
                      disabled={toggleMutation.isPending}
                      title="Click to toggle"
                    >
                      {video.isPublished ? "Public" : "Private"}
                    </button>
                  </td>
                  <td>{formatCount(video.views)}</td>
                  <td>{formatDate(video.createdAt)}</td>
                  <td className="studio-actions">
                    <Link to={`/studio/edit/${video._id}`}>Edit</Link>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => handleDelete(video)}
                      disabled={deleteMutation.isPending}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {videos.totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={!videos.hasPrevPage}
              >
                Previous
              </button>
              <span>
                Page {videos.page} of {videos.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={!videos.hasNextPage}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Studio;
