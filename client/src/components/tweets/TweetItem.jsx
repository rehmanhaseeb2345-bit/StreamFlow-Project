import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateTweet, deleteTweet } from "../../api/tweets.js";
import { toggleTweetLike } from "../../api/likes.js";
import { useAuth } from "../../context/AuthContext.jsx";
import LikeButton from "../ui/LikeButton.jsx";
import { patchDocInPages } from "../../lib/queryCache.js";
import { timeAgo } from "../../lib/format.js";
import { TWEET_RULES } from "../../lib/constants.js";

const TweetItem = ({ tweet, tweetsKey }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(tweet.content);
  const [actionError, setActionError] = useState("");

  const isOwn = user && tweet.owner?._id === user._id;

  const likeMutation = useMutation({
    mutationFn: () => toggleTweetLike(tweet._id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: tweetsKey });
      const previous = queryClient.getQueryData(tweetsKey);
      queryClient.setQueryData(tweetsKey, (data) =>
        patchDocInPages(data, tweet._id, (t) => ({
          ...t,
          isLiked: !t.isLiked,
          likesCount: t.likesCount + (t.isLiked ? -1 : 1),
        })),
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(tweetsKey, context.previous);
      setActionError(err.message);
    },
  });

  const editMutation = useMutation({
    mutationFn: () => updateTweet(tweet._id, draft.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(tweetsKey, (data) =>
        patchDocInPages(data, tweet._id, (t) => ({
          ...t,
          content: updated.content,
        })),
      );
      setIsEditing(false);
      setActionError("");
    },
    onError: (err) => setActionError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTweet(tweet._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tweetsKey });
    },
    onError: (err) => setActionError(err.message),
  });

  const handleLike = () => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }
    likeMutation.mutate();
  };

  const trimmedDraft = draft.trim();
  const isDraftValid =
    trimmedDraft.length >= TWEET_RULES.minLength &&
    trimmedDraft.length <= TWEET_RULES.maxLength;

  return (
    <div className="comment">
      <Link to={`/channel/${tweet.owner?.username}`}>
        <img
          src={tweet.owner?.avatar?.url}
          alt={tweet.owner?.fullname}
          className="avatar avatar-sm"
        />
      </Link>

      <div className="comment-body">
        <p className="comment-meta">
          <Link
            to={`/channel/${tweet.owner?.username}`}
            className="comment-author"
          >
            @{tweet.owner?.username}
          </Link>{" "}
          <span>{timeAgo(tweet.createdAt)}</span>
        </p>

        {isEditing ? (
          <div className="comment-edit">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={TWEET_RULES.maxLength}
              rows={2}
            />
            <div className="comment-actions">
              <span className="char-counter">
                {draft.length}/{TWEET_RULES.maxLength}
              </span>
              <button
                type="button"
                onClick={() => editMutation.mutate()}
                disabled={!isDraftValid || editMutation.isPending}
              >
                {editMutation.isPending ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setDraft(tweet.content);
                  setActionError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="comment-content">{tweet.content}</p>
        )}

        <div className="comment-actions">
          <LikeButton
            isLiked={!!tweet.isLiked}
            count={tweet.likesCount ?? 0}
            onToggle={handleLike}
            disabled={likeMutation.isPending}
          />
          {isOwn && !isEditing && (
            <>
              <button
                type="button"
                className="link-button"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  if (window.confirm("Delete this post?")) {
                    deleteMutation.mutate();
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </>
          )}
        </div>

        {actionError && <p className="field-error">{actionError}</p>}
      </div>
    </div>
  );
};

export default TweetItem;
