import clsx from "clsx";
import type { ReactNode } from "react";

interface ChipProps {
  children: ReactNode;
  className?: string;
}

export function Chip({ children, className }: ChipProps) {
  return (
    <div
      className={clsx(
        "inline-block rounded-full border border-eggplant-100 py-1.5 px-3 text-xs font-medium text-eggplant-700",
        className
      )}
    >
      {children}
    </div>
  );
}
