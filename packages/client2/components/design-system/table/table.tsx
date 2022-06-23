import clsx from "clsx";
import { ReactNode, useEffect, useRef } from "react";

type Row = ReactNode[];

interface TableProps {
  headings: Row;
  rows: Row[];
  className?: string;
  hideHeadings?: boolean;
  /**
   * Callback that gets invoked when the user scrolls to the bottom of the table. Use this to enable lazy loading of rows
   */
  onScrollBottom?: () => void;
}

export function Table({
  headings,
  rows,
  className,
  hideHeadings = false,
  onScrollBottom,
}: TableProps) {
  const scrollBottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (onScrollBottom) {
      const observer = new IntersectionObserver(
        ([target]) => {
          if (target.isIntersecting) {
            onScrollBottom();
          }
        },
        { root: null, rootMargin: "20px", threshold: 0 }
      );
      if (scrollBottomRef.current) {
        observer.observe(scrollBottomRef.current);
        return () => observer.disconnect();
      }
    }
  }, [onScrollBottom]);

  return (
    <div className="relative">
      <div className="max-h-96 overflow-auto">
        <table
          className={clsx(
            "mb-10 min-w-full table-fixed border-collapse whitespace-nowrap text-sm",
            className
          )}
        >
          <thead>
            <tr>
              {headings.map((heading, index) => (
                <th
                  className={clsx(
                    "bg-sand-50 px-5 py-3.5 text-center font-normal first:rounded-l first:text-left last:rounded-r last:text-right",
                    hideHeadings ? "sr-only" : null
                  )}
                  key={index}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((col, index) => (
                  <td
                    key={index}
                    className="border-y-2 border-white bg-sand-50 px-5 py-3.5 text-center first:rounded-l first:text-left last:rounded-r last:text-right"
                  >
                    {col}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ height: "2px" }} ref={scrollBottomRef} />
      </div>
      <div
        className="pointer-events-none absolute top-0 left-0 h-full w-full"
        style={{
          background: "linear-gradient(to bottom, rgba(0, 0, 0, 0) 80%, white)",
        }}
      />
    </div>
  );
}
