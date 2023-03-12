import { format as formatDate } from "date-fns";
import { BigNumber } from "ethers/lib/ethers";
import React from "react";

import { formatCrypto } from "@/lib/format";

export interface LoanCallsDataTableRow {
  totalCalled: BigNumber;
  dueDate: number;
  status: string;
  balance: BigNumber;
}

interface LoanCallsDataTableProps {
  callsData: LoanCallsDataTableRow[];
  loading: boolean;
  className?: string;
}

export function LoanCallsDataTable({
  callsData,
  loading,
  className,
}: LoanCallsDataTableProps) {
  return (
    <div className={className}>
      {loading && <div>Loading</div>}
      <table className="w-full text-xs [&_th]:py-2.5 [&_th]:text-base [&_th]:font-medium [&_th]:text-sand-500 [&_td]:py-4 [&_td]:text-lg">
        <thead>
          <tr className="bg-transparent">
            <th scope="col" className="w-3/12 pl-5 text-left">
              Total called
            </th>
            <th scope="col" className="w-3/12 text-right">
              Due date
            </th>
            <th scope="col" className="w-3/12 text-right">
              Status
            </th>
            <th scope="col" className="w-3/12 pr-5 text-right">
              Balance
            </th>
          </tr>
        </thead>
        <tbody
          className="shadow-outline divide-y divide-sand-300 rounded-md"
          // Workaround to get border radius applied to tbody element
          style={{
            boxShadow: "0 0 0 1px #D6D3D1",
          }}
        >
          {callsData.map(({ totalCalled, dueDate, status, balance }, i) => (
            <tr key={i}>
              <td className="pl-5 text-left font-semibold">
                {formatCrypto({ amount: totalCalled, token: "USDC" })}
              </td>
              <td className="text-right">
                {formatDate(dueDate * 1000, "MMM d, Y")}
              </td>
              <td className="text-right">
                <div className="flex items-center justify-end">
                  {status === "Open" && (
                    <svg className="mr-2 h-2 w-2">
                      <circle cx={4} cy={4} r={4} className="fill-mint-500" />
                    </svg>
                  )}
                  {status}
                </div>
              </td>
              <td className="pr-5 text-right font-semibold">
                {formatCrypto({ amount: balance, token: "USDC" })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
