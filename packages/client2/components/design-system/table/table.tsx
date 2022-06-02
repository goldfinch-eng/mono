import clsx from "clsx";
import { ReactNode } from "react";

type Row = ReactNode[];

interface TableProps {
  headings: Row;
  rows: Row[];
  className?: string;
  hideHeadings?: boolean;
}

export function Table({
  headings,
  rows,
  className,
  hideHeadings = false,
}: TableProps) {
  return (
    <div className="relative">
      <div className="max-h-96 overflow-auto">
        <table
          className={clsx(
            "w-full table-fixed border-collapse text-sm",
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
      </div>
      <div
        className="pointer-events-none absolute top-0 left-0 h-full w-full"
        style={{
          background: "linear-gradient(to bottom, rgba(0, 0, 0, 0) 75%, white)",
        }}
      />
    </div>
  );
}
