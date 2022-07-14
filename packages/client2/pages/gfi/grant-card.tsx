import { BigNumber } from "ethers";

import { GrantWithSource, getReasonLabel } from "@/lib/gfi-rewards";

interface GrantCardProps {
  grant: GrantWithSource;
}

export function GrantCard({ grant }: GrantCardProps) {
  const {
    reason,
    grant: { amount },
  } = grant;
  const amountAsBigNumber = BigNumber.from(amount);
  return (
    <div className="rounded-xl bg-sand-100 py-4 px-6">
      <div className="flex">
        <div className="text-xl font-medium">{getReasonLabel(reason)}</div>
        <div>{amountAsBigNumber.toString()}</div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
}
