import clsx from "clsx";

import { formatCrypto } from "@/lib/format";

import { RepaymentScheduleData } from "../v2-components/repayment-terms-schedule";

interface RepaymentScheduleTableProps {
  className?: string;
  repaymentScheduleData: RepaymentScheduleData[];
}

export function RepaymentScheduleTable({
  className,
  repaymentScheduleData,
}: RepaymentScheduleTableProps) {
  return (
    <div className={clsx(className, "max-h-[18rem] overflow-y-auto")}>
      <table className="w-full">
        <thead className="sticky top-0">
          <tr>
            <td className="grid w-full grid-cols-12 border-y border-sand-300 bg-sand-50 text-xs">
              <div className="col-span-1 px-3.5 py-2">No.</div>
              <div className="col-span-4 px-3.5 py-2">Est. payment date</div>
              <div className="col-span-2 px-3.5 py-2 text-right">
                Principal due
              </div>
              <div className="col-span-5 px-3.5 py-2 text-right">
                Interest due
              </div>
            </td>
          </tr>
        </thead>
        <tbody className="max-h-[18rem] overflow-y-auto">
          {repaymentScheduleData.map(
            ({ paymentPeriod, estimatedPaymentDate, interest, principal }) => (
              <tr
                key={paymentPeriod}
                className="border-y border-sand-300 first:border-t-0 last:border-b-0"
              >
                <td className="grid w-full grid-cols-12 text-xs">
                  <div className="col-span-1 px-3.5 py-3">{paymentPeriod}</div>
                  <div className="col-span-4 px-3.5 py-3">
                    {estimatedPaymentDate}
                  </div>
                  <div className="col-span-2 px-3.5 py-3 text-right">
                    {formatCrypto({ amount: principal, token: "USDC" })}
                  </div>
                  <div className="col-span-5 px-3.5 py-3 text-right">
                    {formatCrypto({ amount: interest, token: "USDC" })}
                  </div>
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}
