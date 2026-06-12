import { useInfiniteQuery } from "@tanstack/react-query";
import VideoCard from "./VideoCard.jsx";
import Spinner from "../ui/Spinner.jsx";
import InfiniteScrollSentinel from "../ui/InfiniteScrollSentinel.jsx";

// Reusable infinite-scrolling video grid for any paginated video list
// (home, search results, channel videos, liked, history).
//
// queryKey: TanStack cache key array.
// fetchPage: ({ page }) => Promise<paginated envelope with docs>.
const VideoGrid = ({ queryKey, fetchPage, emptyMessage = "No videos found." }) => {
  const {
    data,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasNextPage ? lastPage.nextPage : undefined,
  });

  if (isLoading) return <Spinner fullPage />;

  if (isError) {
    return <p className="message-error">{error.message}</p>;
  }

  const videos = data.pages.flatMap((page) => page.docs);

  if (videos.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="video-grid">
        {videos.map((video) => (
          <VideoCard key={video._id} video={video} />
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

export default VideoGrid;
