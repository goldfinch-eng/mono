import React, { ReactNode } from "react";

interface Row {
  heading: string;
  boldValue?: ReactNode;
  value: ReactNode;
}

interface VerboseTableProps {
  rows: Row[];
  className?: string;
}

function VerboseTableRow({ heading, boldValue, value }: Row) {
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
