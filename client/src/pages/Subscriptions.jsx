import { Link } from "react-router-dom";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchSubscribedChannels,
  toggleSubscription,
} from "../api/subscriptions.js";
import { useAuth } from "../context/AuthContext.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import InfiniteScrollSentinel from "../components/ui/InfiniteScrollSentinel.jsx";
import { usePageTitle } from "../lib/usePageTitle.js";
import { timeAgo } from "../lib/format.js";

const Subscriptions = () => {
  usePageTitle("Subscriptions");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const subscriptionsKey = ["subscriptions", user._id];

  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: subscriptionsKey,
    queryFn: ({ pageParam }) =>
      fetchSubscribedChannels(user._id, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
  });

  const unsubscribeMutation = useMutation({
    mutationFn: toggleSubscription,
    onSuccess: (_data, channelId) => {
      queryClient.invalidateQueries({ queryKey: subscriptionsKey });
      // The channel's profile (isSubscribed, count) is now stale everywhere.
      queryClient.invalidateQueries({ queryKey: ["channel"] });
    },
  });

  if (isLoading) return <Spinner fullPage />;
  if (isError) return <p className="message-error">{error.message}</p>;

  const subscriptions = data.pages.flatMap((page) => page.docs);

  return (
    <div>
      <h1>Subscriptions</h1>

      {subscriptions.length === 0 ? (
        <p className="empty-state">
          Channels you subscribe to will show up here.
        </p>
      ) : (
        <div className="subscription-list">
          {subscriptions.map(({ channel, subscribedAt }) => (
            <div key={channel._id} className="subscription-row">
              <Link
                to={`/channel/${channel.username}`}
                className="subscription-channel"
              >
                <img
                  src={channel.avatar?.url}
                  alt={channel.fullname}
                  className="avatar avatar-md"
                />
                <div>
                  <p className="subscription-name">{channel.fullname}</p>
                  <p className="subscription-meta">
                    @{channel.username} • subscribed {timeAgo(subscribedAt)}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => unsubscribeMutation.mutate(channel._id)}
                disabled={unsubscribeMutation.isPending}
              >
                Unsubscribe
              </button>
            </div>
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

export default Subscriptions;
