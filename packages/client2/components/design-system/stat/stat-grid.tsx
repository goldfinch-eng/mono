import clsx from "clsx";
import { ReactNode, Children } from "react";

interface StatGridProps {
  children: ReactNode;
  className?: string;
}

/**
 * Honestly the layout that this component gives you is only good for the senior pool/borrower pool pages, so beware.
 */
export function StatGrid({ children, className }: StatGridProps) {
  const numChildren = Children.count(children);
  const isRowsOfFour = numChildren % 4 === 0;

  return (
    <div
      className={clsx(
        className,
        "grid gap-px overflow-hidden rounded-xl border border-sand-200 bg-sand-200",
        isRowsOfFour
          ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4"
          : "grid-cols-1 sm:grid-cols-3"
      )}
    >
      {children}
    </div>
  );
}
