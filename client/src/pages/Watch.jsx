import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchVideoById } from "../api/videos.js";
import { toggleVideoLike } from "../api/likes.js";
import { useAuth } from "../context/AuthContext.jsx";
import CommentsSection from "../components/comments/CommentsSection.jsx";
import SubscribeButton from "../components/SubscribeButton.jsx";
import SaveToPlaylistModal from "../components/playlists/SaveToPlaylistModal.jsx";
import LikeButton from "../components/ui/LikeButton.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import { usePageTitle } from "../lib/usePageTitle.js";
import { formatViews, formatDate } from "../lib/format.js";

const Watch = () => {
  const { videoId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);

  const videoKey = ["video", videoId];

  const {
    data: video,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: videoKey,
    queryFn: () => fetchVideoById(videoId),
    // Every fetch increments the server-side view count, so never refetch
    // this query during the visit.
    staleTime: Infinity,
    retry: false,
  });

  usePageTitle(video?.title);

  const likeMutation = useMutation({
    mutationFn: () => toggleVideoLike(videoId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: videoKey });
      const previous = queryClient.getQueryData(videoKey);
      queryClient.setQueryData(videoKey, (old) =>
        old
          ? {
              ...old,
              isLiked: !old.isLiked,
              likesCount: old.likesCount + (old.isLiked ? -1 : 1),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(videoKey, context.previous);
    },
    onSettled: () => {
      // The liked-videos list changed; refetch it next time it's shown.
      queryClient.invalidateQueries({ queryKey: ["videos", "liked"] });
    },
  });

  const handleLike = () => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }
    likeMutation.mutate();
  };

  if (isLoading) return <Spinner fullPage />;

  if (isError) {
    return (
      <div className="not-found">
        <h1>{error.statusCode === 404 ? "Video not found" : "Error"}</h1>
        <p>
          {error.statusCode === 404
            ? "It may have been removed or made private."
            : error.message}
        </p>
        <Link to="/">Go home</Link>
      </div>
    );
  }

  const description = video.description ?? "";
  const isLongDescription = description.length > 200;
  const visibleDescription =
    showFullDescription || !isLongDescription
      ? description
      : `${description.slice(0, 200)}...`;

  return (
    <div className="watch-page">
      <video
        className="watch-player"
        src={video.videoFile?.url}
        poster={video.thumbnail?.url}
        controls
        autoPlay
      />

      <h1 className="watch-title">{video.title}</h1>

      <div className="watch-meta">
        <span>
          {formatViews(video.views)} • {formatDate(video.createdAt)}
        </span>
        <div className="watch-actions">
          <LikeButton
            isLiked={!!video.isLiked}
            count={video.likesCount ?? 0}
            onToggle={handleLike}
            disabled={likeMutation.isPending}
          />
          <button
            type="button"
            onClick={() => {
              if (!user) {
                navigate("/login", { state: { from: location } });
                return;
              }
              setShowSaveModal(true);
            }}
          >
            Save
          </button>
        </div>
      </div>

      {showSaveModal && (
        <SaveToPlaylistModal
          videoId={videoId}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      {video.owner && (
        <div className="watch-owner">
          <Link to={`/channel/${video.owner.username}`} className="header-user">
            <img
              src={video.owner.avatar?.url}
              alt={video.owner.fullname}
              className="avatar avatar-md"
            />
            <span>{video.owner.fullname}</span>
          </Link>
          <SubscribeButton username={video.owner.username} />
        </div>
      )}

      <div className="watch-description">
        <p>{visibleDescription}</p>
        {isLongDescription && (
          <button
            type="button"
            className="link-button"
            onClick={() => setShowFullDescription((v) => !v)}
          >
            {showFullDescription ? "Show less" : "Show more"}
          </button>
        )}
      </div>

      <CommentsSection videoId={videoId} />
    </div>
  );
};

export default Watch;
