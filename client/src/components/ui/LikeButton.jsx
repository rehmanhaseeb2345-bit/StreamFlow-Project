import { formatCount } from "../../lib/format.js";

// Presentational like button; parent owns the state and the mutation.
const LikeButton = ({ isLiked, count, onToggle, disabled }) => {
  return (
    <button
      type="button"
      className={isLiked ? "like-button like-button-active" : "like-button"}
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={isLiked}
    >
      👍 {formatCount(count)}
    </button>
  );
};

export default LikeButton;
