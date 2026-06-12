import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchChannelProfile } from "../api/users.js";
import { fetchVideos } from "../api/videos.js";
import VideoGrid from "../components/video/VideoGrid.jsx";
import SubscribeButton from "../components/SubscribeButton.jsx";
import PlaylistsTab from "../components/playlists/PlaylistsTab.jsx";
import TweetsTab from "../components/tweets/TweetsTab.jsx";
import Spinner from "../components/ui/Spinner.jsx";
import { usePageTitle } from "../lib/usePageTitle.js";
import { formatCount, formatDate } from "../lib/format.js";

const TABS = ["videos", "playlists", "tweets"];

const Channel = () => {
  const { username } = useParams();
  const [activeTab, setActiveTab] = useState("videos");

  const {
    data: channel,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["channel", username],
    queryFn: () => fetchChannelProfile(username),
    retry: false,
  });

  usePageTitle(channel?.fullname);

  if (isLoading) return <Spinner fullPage />;

  if (isError) {
    return (
      <div className="not-found">
        <h1>{error.statusCode === 404 ? "Channel not found" : "Error"}</h1>
        <p>
          {error.statusCode === 404
            ? `No channel named "${username}" exists.`
            : error.message}
        </p>
        <Link to="/">Go home</Link>
      </div>
    );
  }

  return (
    <div className="channel-page">
      {channel.coverImage?.url && (
        <img
          src={channel.coverImage.url}
          alt=""
          className="channel-cover"
        />
      )}

      <div className="channel-header">
        <img
          src={channel.avatar?.url}
          alt={channel.fullname}
          className="avatar avatar-lg"
        />
        <div>
          <h1>{channel.fullname}</h1>
          <p className="channel-meta">
            @{channel.username} • {formatCount(channel.subscribersCount)}{" "}
            subscribers • joined {formatDate(channel.createdAt)}
          </p>
          <SubscribeButton username={channel.username} />
        </div>
      </div>

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={activeTab === tab ? "tab tab-active" : "tab"}
            onClick={() => setActiveTab(tab)}
          >
            {tab[0].toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === "videos" && (
        <VideoGrid
          queryKey={["videos", "channel", channel._id]}
          fetchPage={({ page }) => fetchVideos({ page, userId: channel._id })}
          emptyMessage="This channel has no videos yet."
        />
      )}

      {activeTab === "playlists" && <PlaylistsTab userId={channel._id} />}

      {activeTab === "tweets" && <TweetsTab userId={channel._id} />}
    </div>
  );
};

export default Channel;
