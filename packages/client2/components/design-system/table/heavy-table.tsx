import clsx from "clsx";
import { ReactNode } from "react";

import { InfoIconTooltip } from "../tooltip";

export type HeavyTableRow = [string, string | ReactNode | null, ReactNode];

/**
 * The HeavyTable is meant for situations where text-heavy content is being presented as a table. It has a distinct look from the other <Table> component.
 * A good way to distinguish is that HeavyTable is good for situations where the table has multiple lines of text in a row. Table is meant for only single lines of text per row.
 */
export function HeavyTable({
  rows,
  className,
}: {
  rows: HeavyTableRow[];
  className?: string;
}) {
  return (
    <div className={clsx("overflow-auto", className)}>
      <table className="w-full border-collapse border border-sand-200 text-sand-600">
        <tbody>
          {rows.map(([heading, tooltip, value], index) => (
            <tr key={index} className="border border-sand-200">
              <th
                scope="row"
                className="bg-sand-50 p-5 text-left align-top font-medium sm:min-w-[260px]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sand-600">{heading}</div>
                  {tooltip ? (
                    <InfoIconTooltip size="sm" content={tooltip} />
                  ) : null}
                </div>
              </th>
              <td className="p-5 align-top">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
