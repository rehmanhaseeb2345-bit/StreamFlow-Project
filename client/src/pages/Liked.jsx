import VideoGrid from "../components/video/VideoGrid.jsx";
import { fetchLikedVideos } from "../api/likes.js";
import { usePageTitle } from "../lib/usePageTitle.js";

const Liked = () => {
  usePageTitle("Liked videos");
  return (
    <div>
      <h1>Liked videos</h1>
      <VideoGrid
        queryKey={["videos", "liked"]}
        fetchPage={fetchLikedVideos}
        emptyMessage="Videos you like will show up here."
      />
    </div>
  );
};

export default Liked;
