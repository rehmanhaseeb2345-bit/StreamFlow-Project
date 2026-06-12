import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchUserPlaylists } from "../../api/playlists.js";
import Spinner from "../ui/Spinner.jsx";
import InfiniteScrollSentinel from "../ui/InfiniteScrollSentinel.jsx";
import { timeAgo } from "../../lib/format.js";

const PlaylistsTab = ({ userId }) => {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["playlists", userId],
    queryFn: ({ pageParam }) => fetchUserPlaylists(userId, { page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
  });

  if (isLoading) return <Spinner />;
  if (isError) return <p className="message-error">{error.message}</p>;

  const playlists = data.pages.flatMap((page) => page.docs);

  if (playlists.length === 0) {
    return <p className="empty-state">This channel has no playlists.</p>;
  }

  return (
    <>
      <div className="playlist-grid">
        {playlists.map((playlist) => (
          <Link
            key={playlist._id}
            to={`/playlist/${playlist._id}`}
            className="playlist-card"
          >
            <p className="playlist-card-name">{playlist.name}</p>
            <p className="subscription-meta">
              {playlist.videoCount}{" "}
              {playlist.videoCount === 1 ? "video" : "videos"} • updated{" "}
              {timeAgo(playlist.updatedAt)}
            </p>
          </Link>
        ))}
      </div>

      {isFetchingNextPage && <Spinner />}
      <InfiniteScrollSentinel
        onVisible={fetchNextPage}
        disabled={!hasNextPage || isFetchingNextPage}
      />
    </>
  );
};

export default PlaylistsTab;
