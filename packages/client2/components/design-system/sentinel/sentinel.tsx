import { useEffect, useRef } from "react";

interface SentinelProps {
  onVisibilityChange: (b: boolean) => void;
}

export function Sentinel({ onVisibilityChange }: SentinelProps) {
  const divRef = useRef<HTMLDivElement>(null);
  // This might seem like a use case for useLayoutEffect, but I've found that useLayoutEffect actually runs too fast.
  // The sentinel will not have any styles applied in the DOM and will not be considered intersecting on the first frame, even if it should be
  useEffect(() => {
    if (!divRef.current) {
      return;
    }
    const observer = new IntersectionObserver(
      ([target]) => {
        onVisibilityChange(target.isIntersecting);
      },
      { root: null, threshold: 1.0 }
    );
    observer.observe(divRef.current);
    return () => observer.disconnect();
  }, [onVisibilityChange]);
  return <div className="h-px" ref={divRef} />;
}
