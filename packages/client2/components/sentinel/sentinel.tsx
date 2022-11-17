import { useEffect, useRef } from "react";

interface SentinelProps {
  onVisible: () => void;
}

export function Sentinel({ onVisible }: SentinelProps) {
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (divRef.current) {
      const observer = new IntersectionObserver(
        ([target]) => {
          if (target.isIntersecting) {
            onVisible();
          }
        },
        { root: null, rootMargin: "20px", threshold: 0 }
      );
      observer.observe(divRef.current);
      return () => observer.disconnect();
    }
  }, [onVisible]);
  return <div className="h-px" ref={divRef} />;
}
