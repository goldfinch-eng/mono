import clsx from "clsx";
import { ReactNode, useRef, useState, useEffect } from "react";

/**
 * Very bespoke and purpose-built container to handle the sticky behaviour of the widget on pool pages (including senior pool page).
 * The reason this exists is due to some nuanced behaviour in CSS position sticky. If we just use sticky top, the widget looks good
 * when it is shorter than the viewport, but when the widget is too tall the user has to scroll all the way to the bottom of the page
 * to reveal the widget. If we just use sticky bottom, a tall widget is scrolled right away when it overflows the viewport, but it also
 * sticks to the bottom of the page when it is shorter than the viewport, which looks visually imbalanced.
 * This container tries to marry the best of both worlds. It uses sticky-bottom when it detects the contents are very tall, and sticky-top otherwise.
 */
export function AdaptiveStickyContainer({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAboveHeightThreshold, setIsAboveHeightThreshold] = useState(false);
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const viewportPercentage = entry.contentRect.height / window.innerHeight;
      if (viewportPercentage > 0.9) {
        setIsAboveHeightThreshold(true);
      } else {
        setIsAboveHeightThreshold(false);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="relative flex grow flex-col">
      {/* This spacer exists to force the rest of the content to the bottom of the widget div. This allows sticky + bottom to work as intended */}
      {isAboveHeightThreshold ? <div className="grow" /> : null}
      <div
        className={clsx(
          "sticky",
          isAboveHeightThreshold ? "bottom-8" : "top-8"
        )}
        ref={containerRef}
      >
        {children}
      </div>
    </div>
  );
}
