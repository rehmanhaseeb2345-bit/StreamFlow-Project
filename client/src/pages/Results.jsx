import { useSearchParams } from "react-router-dom";
import VideoGrid from "../components/video/VideoGrid.jsx";
import { fetchVideos } from "../api/videos.js";
import { usePageTitle } from "../lib/usePageTitle.js";

// Only fields the backend's allow-list accepts (getAllVideos).
const SORT_OPTIONS = [
  { value: "createdAt:desc", label: "Newest" },
  { value: "createdAt:asc", label: "Oldest" },
  { value: "views:desc", label: "Most viewed" },
  { value: "duration:asc", label: "Shortest" },
  { value: "duration:desc", label: "Longest" },
  { value: "title:asc", label: "Title A-Z" },
];

const Results = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("query") ?? "";
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const sortType = searchParams.get("sortType") ?? "desc";

  usePageTitle(query || "Search");

  const handleSortChange = (e) => {
    const [newSortBy, newSortType] = e.target.value.split(":");
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("sortBy", newSortBy);
      next.set("sortType", newSortType);
      return next;
    });
  };

  return (
    <div>
      <div className="results-header">
        <h1>{query ? `Results for "${query}"` : "All videos"}</h1>
        <label>
          Sort by{" "}
          <select value={`${sortBy}:${sortType}`} onChange={handleSortChange}>
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <VideoGrid
        queryKey={["videos", "results", { query, sortBy, sortType }]}
        fetchPage={({ page }) =>
          fetchVideos({ page, query: query || undefined, sortBy, sortType })
        }
        emptyMessage={
          query ? `No videos matched "${query}".` : "No videos found."
        }
      />
    </div>
  );
};

export default Results;
