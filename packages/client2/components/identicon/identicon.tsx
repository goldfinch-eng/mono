import { renderIcon } from "@download/blockies";
import clsx from "clsx";
import { useEffect, useRef } from "react";

interface IdenticonProps {
  account: string;
  className?: string;
  /**
   * Determines the size of the icon. This number * 8 will be the height and width in pixels
   */
  scale?: number;
}

export function Identicon({ account, className, scale = 3 }: IdenticonProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (canvasRef.current) {
      renderIcon(
        { seed: account.toLowerCase(), size: 8, scale },
        canvasRef.current
      );
    }
  }, [account, scale]);
  return (
    <canvas
      className={clsx("rounded-full", className)}
      ref={canvasRef}
      aria-hidden="true"
    />
  );
}
