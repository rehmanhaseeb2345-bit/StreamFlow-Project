import VideoGrid from "../components/video/VideoGrid.jsx";
import { fetchWatchHistory } from "../api/users.js";
import { usePageTitle } from "../lib/usePageTitle.js";

const History = () => {
  usePageTitle("Watch history");

  return (
    <div>
      <h1>Watch history</h1>
      <VideoGrid
        queryKey={["videos", "history"]}
        fetchPage={fetchWatchHistory}
        emptyMessage="Videos you watch will show up here."
      />
    </div>
  );
};

export default History;
