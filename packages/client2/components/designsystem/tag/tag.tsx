import clsx from "clsx";
import type { ReactNode } from "react";

interface TagProps {
  children: ReactNode;
  className?: string;
}

export function Tag({ children, className }: TagProps) {
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
