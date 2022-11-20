import { useEffect, useRef } from "react";

interface SentinelProps {
  onVisibilityChange: (b: boolean) => void;
}

export function Sentinel({ onVisibilityChange }: SentinelProps) {
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (divRef.current) {
      const observer = new IntersectionObserver(
        ([target]) => {
          if (target.isIntersecting) {
            onVisibilityChange(true);
          } else {
            onVisibilityChange(false);
          }
        },
        { root: null, rootMargin: "20px", threshold: 0 }
      );
      observer.observe(divRef.current);
      return () => observer.disconnect();
    }
  }, [onVisibilityChange]);
  return <div className="h-px" ref={divRef} />;
}
