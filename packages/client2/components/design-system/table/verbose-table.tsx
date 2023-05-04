import React, { ReactNode } from "react";

export interface VerboseTableRowProps {
  heading: string;
  boldValue?: ReactNode;
  value: ReactNode;
}

interface VerboseTableProps {
  rows: VerboseTableRowProps[];
  className?: string;
}

function VerboseTableRow({ heading, boldValue, value }: VerboseTableRowProps) {
  return (
    <tr>
      <th
        scope="row"
        className="py-4 pr-5 text-left align-top text-sm font-medium text-mustard-600"
      >
        {heading}
      </th>
      <td className="py-4 pl-5 text-sm text-sand-700">
        {boldValue ? <div className="font-medium">{boldValue}</div> : null}
        <div>{value}</div>
      </td>
    </tr>
  );
}

export function VerboseTable({ rows, className }: VerboseTableProps) {
  return (
    <table className={className}>
      <tbody className="divide-y divide-sand-200">
        {rows.map((row, index) => (
          <VerboseTableRow key={index} {...row} />
        ))}
      </tbody>
    </table>
  );
}
