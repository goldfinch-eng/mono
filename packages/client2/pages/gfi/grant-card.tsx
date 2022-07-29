import { format } from "date-fns";
import { BigNumber } from "ethers";

import { formatCrypto } from "@/lib/format";
import { GrantWithToken, getReasonLabel } from "@/lib/gfi-rewards";
import { SupportedCrypto } from "@/lib/graphql/generated";

const TOKEN_LAUNCH_TIME = 1641920400000; // Tuesday, January 11, 2022 09:00:00 AM GMT-08:00

interface GrantCardProps {
  grant: GrantWithToken;
}

export function GrantCard({ grant }: GrantCardProps) {
  const {
    reason,
    grant: { amount },
  } = grant;
  return (
    <div className="rounded-xl bg-sand-100 py-4 px-6">
      <div className="flex items-center">
        <div>
          <div className="mb-1.5 text-xl font-medium">
            {getReasonLabel(reason)}
          </div>
          <div>
            {formatCrypto({
              token: SupportedCrypto.Gfi,
              amount: BigNumber.from(amount),
            })}{" "}
            GFI - {format(TOKEN_LAUNCH_TIME, "MMM d, y")}
          </div>
        </div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
}
