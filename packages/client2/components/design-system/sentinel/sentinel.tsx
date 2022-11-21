import { useLayoutEffect, useRef } from "react";

interface SentinelProps {
  onVisibilityChange: (b: boolean) => void;
}

export function Sentinel({ onVisibilityChange }: SentinelProps) {
  const divRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
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
