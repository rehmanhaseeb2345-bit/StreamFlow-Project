import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateComment, deleteComment } from "../../api/comments.js";
import { toggleCommentLike } from "../../api/likes.js";
import { useAuth } from "../../context/AuthContext.jsx";
import LikeButton from "../ui/LikeButton.jsx";
import { timeAgo } from "../../lib/format.js";
import { COMMENT_RULES } from "../../lib/constants.js";

// Applies an updater to one comment across the infinite-query page cache.
const patchCommentInCache = (data, commentId, updater) => {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      docs: page.docs.map((comment) =>
        comment._id === commentId ? updater(comment) : comment,
      ),
    })),
  };
};

const CommentItem = ({ comment, commentsKey }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const [actionError, setActionError] = useState("");

  const isOwn = user && comment.owner?._id === user._id;

  const likeMutation = useMutation({
    mutationFn: () => toggleCommentLike(comment._id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: commentsKey });
      const previous = queryClient.getQueryData(commentsKey);
      queryClient.setQueryData(commentsKey, (data) =>
        patchCommentInCache(data, comment._id, (c) => ({
          ...c,
          isLiked: !c.isLiked,
          likesCount: c.likesCount + (c.isLiked ? -1 : 1),
        })),
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(commentsKey, context.previous);
      setActionError(err.message);
    },
  });

  const editMutation = useMutation({
    mutationFn: () => updateComment(comment._id, draft.trim()),
    onSuccess: (updated) => {
      queryClient.setQueryData(commentsKey, (data) =>
        patchCommentInCache(data, comment._id, (c) => ({
          ...c,
          content: updated.content,
        })),
      );
      setIsEditing(false);
      setActionError("");
    },
    onError: (err) => setActionError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteComment(comment._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: commentsKey });
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

  const handleDelete = () => {
    if (window.confirm("Delete this comment?")) {
      deleteMutation.mutate();
    }
  };

  const trimmedDraft = draft.trim();
  const isDraftValid =
    trimmedDraft.length >= COMMENT_RULES.minLength &&
    trimmedDraft.length <= COMMENT_RULES.maxLength;

  return (
    <div className="comment">
      <Link to={`/channel/${comment.owner?.username}`}>
        <img
          src={comment.owner?.avatar?.url}
          alt={comment.owner?.fullname}
          className="avatar avatar-sm"
        />
      </Link>

      <div className="comment-body">
        <p className="comment-meta">
          <Link to={`/channel/${comment.owner?.username}`} className="comment-author">
            @{comment.owner?.username}
          </Link>{" "}
          <span>{timeAgo(comment.createdAt)}</span>
        </p>

        {isEditing ? (
          <div className="comment-edit">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={COMMENT_RULES.maxLength}
              rows={2}
            />
            <div className="comment-actions">
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
                  setDraft(comment.content);
                  setActionError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="comment-content">{comment.content}</p>
        )}

        <div className="comment-actions">
          <LikeButton
            isLiked={!!comment.isLiked}
            count={comment.likesCount ?? 0}
            onToggle={handleLike}
            disabled={likeMutation.isPending}
          />
          {isOwn && !isEditing && (
            <>
              <button type="button" className="link-button" onClick={() => setIsEditing(true)}>
                Edit
              </button>
              <button
                type="button"
                className="link-button"
                onClick={handleDelete}
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

export default CommentItem;
