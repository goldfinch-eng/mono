import clsx from "clsx";
import { format as formatDate } from "date-fns";

import { formatCrypto } from "@/lib/format";
import { RepaymentSchedule } from "@/lib/pools";

interface RepaymentScheduleTableProps {
  className?: string;
  repaymentSchedule: RepaymentSchedule;
}

export function RepaymentScheduleTable({
  className,
  repaymentSchedule,
}: RepaymentScheduleTableProps) {
  return (
    <div className={clsx(className, "max-h-80 overflow-y-auto")}>
      <table className="w-full text-xs [&_th]:px-3.5 [&_th]:py-2 [&_th]:font-normal [&_td]:px-3.5 [&_td]:py-2">
        <thead>
          <tr className="sticky top-0 bg-mustard-100">
            <th scope="col" className="w-1/12 text-left">
              No.
            </th>
            <th scope="col" className="w-4/12 text-left">
              Est. payment date
            </th>
            <th scope="col" className="w-2/12 text-right">
              Principal due
            </th>
            <th scope="col" className="w/5-12 text-right">
              Interest due
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-300">
          {repaymentSchedule.map(
            ({ paymentPeriod, estimatedPaymentDate, interest, principal }) => (
              <tr key={paymentPeriod}>
                <td className="text-left">{paymentPeriod}</td>
                <td className="text-left">
                  {formatDate(estimatedPaymentDate, "MMM d, y")}
                </td>
                <td className="text-right">
                  {formatCrypto({ amount: principal, token: "USDC" })}
                </td>
                <td className="text-right">
                  {formatCrypto({ amount: interest, token: "USDC" })}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
