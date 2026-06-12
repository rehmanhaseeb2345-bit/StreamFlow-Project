import { api } from "./client.js";

// Returns { subscribed: boolean } — the state AFTER the toggle.
// 400 if you try to subscribe to your own channel (UI hides the button).
export const toggleSubscription = async (channelId) => {
  const res = await api.post(`/subscriptions/c/${channelId}`);
  return res.data.data;
};

// docs: [{ channel: { _id, username, fullname, avatar }, subscribedAt }]
export const fetchSubscribedChannels = async (subscriberId, { page = 1 } = {}) => {
  const res = await api.get(`/subscriptions/u/${subscriberId}`, {
    params: { page },
  });
  return res.data.data;
};

// docs: [{ subscriber: { _id, username, fullname, avatar }, subscribedAt }]
export const fetchChannelSubscribers = async (channelId, { page = 1 } = {}) => {
  const res = await api.get(`/subscriptions/c/${channelId}`, {
    params: { page },
  });
  return res.data.data;
};
