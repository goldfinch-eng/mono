import clsx from "clsx";
import { ReactNode } from "react";

type Row = ReactNode[];

interface MiniTableProps {
  className?: string;
  rows: Row[];
  deemphasizeRowHeadings?: boolean;
  deemphasizeMiddleCols?: boolean;
  omitVerticalBorders?: boolean;
}

export function MiniTable({
  className,
  rows,
  deemphasizeRowHeadings = false,
  deemphasizeMiddleCols = false,
  omitVerticalBorders = false,
}: MiniTableProps) {
  return (
    <div
      className={clsx(
        "rounded border border-white/25 text-xs text-white",
        className
      )}
    >
      <table className="w-full border-collapse">
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={`mini-table-row-${rowIndex}`}
              className={clsx(
                "group",
                rowIndex === 0 ? "first-row" : null,
                rowIndex === rows.length - 1 ? "last-row" : null
              )}
            >
              {row.map((cell, cellIndex) => (
                <MiniTableCell
                  key={`mini-table-cell-${rowIndex}-${cellIndex}`}
                  isRowHeading={cellIndex === 0}
                  fadedBg={cellIndex === 0 && !deemphasizeRowHeadings}
                  fadedText={
                    deemphasizeMiddleCols &&
                    cellIndex !== 0 &&
                    cellIndex !== row.length - 1
                  }
                  omitVerticalBorders={omitVerticalBorders}
                >
                  {cell}
                </MiniTableCell>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MiniTableCell({
  children,
  className,
  isRowHeading = false,
  fadedBg = false,
  fadedText = false,
  omitVerticalBorders = false,
}: {
  children: ReactNode;
  className?: string;
  isRowHeading?: boolean;
  fadedBg?: boolean;
  fadedText?: boolean;
  omitVerticalBorders?: boolean;
}) {
  const Component = isRowHeading ? "th" : "td";
  return (
    <Component
      scope={isRowHeading ? "row" : undefined}
      className={clsx(
        "py-2 px-3 font-normal",
        "text-right first:text-left",
        "border border-white/25 first:border-l-0 last:border-r-0 group-[.first-row]:border-t-0 group-[.last-row]:border-b-0",
        omitVerticalBorders ? "border-r-0 border-l-0" : null,
        fadedBg ? "bg-white/5" : null,
        fadedText ? "opacity-60" : null,
        className
      )}
    >
      {children}
    </Component>
  );
}
