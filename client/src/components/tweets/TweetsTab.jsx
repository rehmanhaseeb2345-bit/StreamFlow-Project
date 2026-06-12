import { useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchUserTweets, createTweet } from "../../api/tweets.js";
import { useAuth } from "../../context/AuthContext.jsx";
import TweetItem from "./TweetItem.jsx";
import Spinner from "../ui/Spinner.jsx";
import InfiniteScrollSentinel from "../ui/InfiniteScrollSentinel.jsx";
import { TWEET_RULES } from "../../lib/constants.js";

const TweetsTab = ({ userId }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [submitError, setSubmitError] = useState("");

  const tweetsKey = ["tweets", userId];
  const isOwnChannel = user && user._id === userId;

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: tweetsKey,
    queryFn: ({ pageParam }) => fetchUserTweets(userId, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
  });

  const createMutation = useMutation({
    mutationFn: () => createTweet(content.trim()),
    onSuccess: () => {
      setContent("");
      setSubmitError("");
      queryClient.invalidateQueries({ queryKey: tweetsKey });
    },
    onError: (err) => setSubmitError(err.message),
  });

  const trimmed = content.trim();
  const canSubmit =
    trimmed.length >= TWEET_RULES.minLength &&
    trimmed.length <= TWEET_RULES.maxLength &&
    !createMutation.isPending;

  if (isLoading) return <Spinner />;
  if (isError) return <p className="message-error">{error.message}</p>;

  const tweets = data.pages.flatMap((page) => page.docs);

  return (
    <div>
      {isOwnChannel && (
        <form
          className="comment-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) createMutation.mutate();
          }}
        >
          <textarea
            placeholder="Share something with your subscribers..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={TWEET_RULES.maxLength}
            rows={2}
          />
          <div className="comment-form-footer">
            <span className="char-counter">
              {content.length}/{TWEET_RULES.maxLength}
            </span>
            <button type="submit" disabled={!canSubmit}>
              {createMutation.isPending ? "Posting..." : "Post"}
            </button>
          </div>
          {submitError && <p className="field-error">{submitError}</p>}
        </form>
      )}

      {tweets.length === 0 ? (
        <p className="empty-state">This channel has no posts.</p>
      ) : (
        <div className="comments-list">
          {tweets.map((tweet) => (
            <TweetItem key={tweet._id} tweet={tweet} tweetsKey={tweetsKey} />
          ))}
        </div>
      )}

      {isFetchingNextPage && <Spinner />}
      <InfiniteScrollSentinel
        onVisible={fetchNextPage}
        disabled={!hasNextPage || isFetchingNextPage}
      />
    </div>
  );
};

export default TweetsTab;
