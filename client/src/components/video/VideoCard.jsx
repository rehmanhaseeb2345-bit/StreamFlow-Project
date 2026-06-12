import { Link } from "react-router-dom";
import { formatDuration, formatViews, timeAgo } from "../../lib/format.js";

const VideoCard = ({ video }) => {
  return (
    <article className="video-card">
      <Link to={`/watch/${video._id}`} className="video-card-thumb">
        <img src={video.thumbnail?.url} alt={video.title} loading="lazy" />
        <span className="video-card-duration">
          {formatDuration(video.duration)}
        </span>
      </Link>

      <div className="video-card-info">
        {video.owner?.username && (
          <Link to={`/channel/${video.owner.username}`}>
            <img
              src={video.owner.avatar?.url}
              alt={video.owner.fullname}
              className="avatar avatar-sm"
            />
          </Link>
        )}
        <div>
          <Link to={`/watch/${video._id}`} className="video-card-title">
            {video.title}
          </Link>
          {video.owner?.username && (
            <Link
              to={`/channel/${video.owner.username}`}
              className="video-card-channel"
            >
              {video.owner.fullname}
            </Link>
          )}
          <p className="video-card-meta">
            {formatViews(video.views)} • {timeAgo(video.createdAt)}
          </p>
        </div>
      </div>
    </article>
  );
};

export default VideoCard;
