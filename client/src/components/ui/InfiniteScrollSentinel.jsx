import { useEffect, useRef } from "react";

// Invisible marker at the end of a list: when it scrolls into view, ask for
// the next page.
const InfiniteScrollSentinel = ({ onVisible, disabled }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (disabled || !ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onVisible();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onVisible, disabled]);

  return <div ref={ref} aria-hidden="true" />;
};

export default InfiniteScrollSentinel;
