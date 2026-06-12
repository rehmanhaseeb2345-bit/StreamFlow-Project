import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchChannelProfile } from "../api/users.js";
import { toggleSubscription } from "../api/subscriptions.js";
import { useAuth } from "../context/AuthContext.jsx";

// Self-contained subscribe toggle for any channel, keyed by username.
// Uses the ["channel", username] cache, so on the channel page it costs no
// extra request, and on the watch page it fetches the profile once (the
// video payload itself carries no subscription state).
const SubscribeButton = ({ username }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const channelKey = ["channel", username];

  const { data: channel } = useQuery({
    queryKey: channelKey,
    queryFn: () => fetchChannelProfile(username),
    enabled: !!username,
  });

  const mutation = useMutation({
    mutationFn: () => toggleSubscription(channel._id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: channelKey });
      const previous = queryClient.getQueryData(channelKey);
      queryClient.setQueryData(channelKey, (old) =>
        old
          ? {
              ...old,
              isSubscribed: !old.isSubscribed,
              subscribersCount:
                old.subscribersCount + (old.isSubscribed ? -1 : 1),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(channelKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });

  if (!channel) return null;

  // The backend rejects self-subscription; don't show the button at all.
  if (user && user._id === channel._id) return null;

  const handleClick = () => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }
    mutation.mutate();
  };

  return (
    <button
      type="button"
      className={
        channel.isSubscribed
          ? "subscribe-button subscribe-button-active"
          : "subscribe-button"
      }
      onClick={handleClick}
      disabled={mutation.isPending}
    >
      {channel.isSubscribed ? "Subscribed" : "Subscribe"}
    </button>
  );
};

export default SubscribeButton;
