import VideoGrid from "../components/video/VideoGrid.jsx";
import { fetchVideos } from "../api/videos.js";

const Home = () => {
  return (
    <VideoGrid
      queryKey={["videos", "home"]}
      fetchPage={({ page }) => fetchVideos({ page })}
      emptyMessage="No videos yet. Be the first to upload!"
    />
  );
};

export default Home;
