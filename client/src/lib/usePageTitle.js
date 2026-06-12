import { useEffect } from "react";

export const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} - StreamYT` : "StreamYT";
    return () => {
      document.title = "StreamYT";
    };
  }, [title]);
};
