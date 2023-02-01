import clsx from "clsx";
import { ReactNode } from "react";

type Row = ReactNode[];

interface MiniTableProps {
  bodyRows: Row[];
  deemphasizeRowHeadings?: boolean;
  omitVerticalBorders?: boolean;
}

export function MiniTable({
  bodyRows,
  deemphasizeRowHeadings = false,
  omitVerticalBorders = false,
}: MiniTableProps) {
  return (
    <div className="rounded border border-white/25 text-xs text-white">
      <table className="w-full border-collapse">
        <tbody>
          {bodyRows.map((row, rowIndex) => (
            <tr
              key={`mini-table-row-${rowIndex}`}
              className={clsx(
                "group",
                rowIndex === 0 ? "first-row" : null,
                rowIndex === row.length - 1 ? "last-row" : null
              )}
            >
              {row.map((cell, cellIndex) => (
                <MiniTableCell
                  key={`mini-table-cell-${rowIndex}-${cellIndex}`}
                  isRowHeading={cellIndex === 0}
                  fadedBg={cellIndex === 0 && !deemphasizeRowHeadings}
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
  omitVerticalBorders = false,
}: {
  children: ReactNode;
  className?: string;
  isRowHeading?: boolean;
  fadedBg?: boolean;
  omitVerticalBorders?: boolean;
}) {
  const Component = isRowHeading ? "th" : "td";
  return (
    <Component
      scope={isRowHeading ? "row" : undefined}
      className={clsx(
        "py-2 px-3 font-normal",
        "text-center first:text-left last:text-right",
        "border border-white/25 first:border-l-0 last:border-r-0 group-[.first-row]:border-t-0 group-[.last-row]:border-b-0",
        omitVerticalBorders ? "border-r-0 border-l-0" : null,
        fadedBg ? "bg-white/5" : null,
        className
      )}
    >
      {children}
    </Component>
  );
}
