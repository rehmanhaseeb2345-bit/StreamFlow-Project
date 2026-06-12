import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchComments, addComment } from "../../api/comments.js";
import { useAuth } from "../../context/AuthContext.jsx";
import CommentItem from "./CommentItem.jsx";
import Spinner from "../ui/Spinner.jsx";
import InfiniteScrollSentinel from "../ui/InfiniteScrollSentinel.jsx";
import { COMMENT_RULES } from "../../lib/constants.js";

const CommentsSection = ({ videoId }) => {
  const { user } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [submitError, setSubmitError] = useState("");

  const commentsKey = ["comments", videoId];

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: commentsKey,
    queryFn: ({ pageParam }) => fetchComments(videoId, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
  });

  const addMutation = useMutation({
    mutationFn: () => addComment(videoId, content.trim()),
    onSuccess: () => {
      setContent("");
      setSubmitError("");
      // The POST response's owner isn't populated, so refetch the list
      // rather than appending the raw response.
      queryClient.invalidateQueries({ queryKey: commentsKey });
    },
    onError: (err) => setSubmitError(err.message),
  });

  const trimmed = content.trim();
  const canSubmit =
    trimmed.length >= COMMENT_RULES.minLength &&
    trimmed.length <= COMMENT_RULES.maxLength &&
    !addMutation.isPending;

  const totalComments = data?.pages[0]?.totalDocs ?? 0;
  const comments = data?.pages.flatMap((page) => page.docs) ?? [];

  return (
    <section className="comments-section">
      <h2>
        {totalComments} {totalComments === 1 ? "Comment" : "Comments"}
      </h2>

      {user ? (
        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) addMutation.mutate();
          }}
        >
          <textarea
            placeholder="Add a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={COMMENT_RULES.maxLength}
            rows={2}
          />
          <div className="comment-form-footer">
            <span className="char-counter">
              {content.length}/{COMMENT_RULES.maxLength}
            </span>
            <button type="submit" disabled={!canSubmit}>
              {addMutation.isPending ? "Posting..." : "Comment"}
            </button>
          </div>
          {submitError && <p className="field-error">{submitError}</p>}
        </form>
      ) : (
        <p>
          <Link to="/login" state={{ from: location }}>
            Sign in
          </Link>{" "}
          to comment.
        </p>
      )}

      {isLoading && <Spinner />}
      {isError && <p className="message-error">{error.message}</p>}

      <div className="comments-list">
        {comments.map((comment) => (
          <CommentItem
            key={comment._id}
            comment={comment}
            commentsKey={commentsKey}
          />
        ))}
      </div>

      {isFetchingNextPage && <Spinner />}
      <InfiniteScrollSentinel
        onVisible={fetchNextPage}
        disabled={!hasNextPage || isFetchingNextPage}
      />
    </section>
  );
};

export default CommentsSection;
