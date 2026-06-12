// Display helpers for video metadata.

export const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

const compactFormatter = new Intl.NumberFormat("en", { notation: "compact" });

export const formatViews = (views) => {
  const count = views ?? 0;
  return `${compactFormatter.format(count)} ${count === 1 ? "view" : "views"}`;
};

export const formatCount = (count) => compactFormatter.format(count ?? 0);

const TIME_UNITS = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

export const timeAgo = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSeconds < 60) return "just now";
  for (const [unit, secondsInUnit] of TIME_UNITS) {
    if (diffSeconds >= secondsInUnit) {
      const value = Math.floor(diffSeconds / secondsInUnit);
      return `${value} ${unit}${value > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
};

export const formatDate = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};
