import { format } from "date-fns";
import { BigNumber } from "ethers";

import { Stat, InfoIconTooltip, Button } from "@/components/design-system";
import { formatPercent, formatUsdcAsDollars } from "@/lib/format";
import type { CreditLine, TranchedPool } from "@/lib/graphql/generated";

interface PoolFilledPanelProps {
  apy?: TranchedPool["estimatedJuniorApy"];
  apyGfi?: TranchedPool["estimatedJuniorApyFromGfi"];
  limit?: CreditLine["limit"];
  balance?: CreditLine["balance"];
  dueDate?: CreditLine["nextDueTime"];
}

export default function PoolFilledPanel({
  apy,
  apyGfi,
  limit,
  dueDate,
}: PoolFilledPanelProps) {
  return (
    <div className="sticky top-12 rounded-xl border border-sand-200">
      <div className="p-5">
        <div className="mb-9">
          <Stat
            label="Initial investment"
            value={formatUsdcAsDollars(limit || BigNumber.from(0))}
            tooltip="lorem ipsum text"
          />
        </div>

        <div className="mb-9">
          <Stat
            label="Total amount repaid"
            value="$XXX.XX"
            tooltip="lorem ipsum text"
          />
        </div>

        <table className="w-full">
          <thead>
            <tr>
              <th className="pb-3 text-left text-sm font-normal" colSpan={2}>
                <div className="flex items-center text-sand-600">
                  <span className="mr-2 ">Interest breakdown</span>
                  <InfoIconTooltip
                    size="sm"
                    content={
                      <div className="max-w-xs">
                        Lorem ipsum dolor sit amet, consectetur adipisicing
                        elit. Officia culpa possimus accusantium cumque
                        suscipit.
                      </div>
                    }
                  />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="w-1/2 border border-sand-100 p-3 text-xl">
                $XXX.XX
              </td>
              <td className="w-1/2 border border-sand-100 p-3 text-right text-xl">
                {formatPercent(apy || 0)}
              </td>
            </tr>
            <tr>
              <td className="w-1/2 border border-sand-100 p-3 text-xl">
                $XXX.XX
              </td>
              <td className="w-1/2 border border-sand-100 p-3 text-right text-xl">
                {formatPercent(apyGfi || 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {dueDate && (
        <div className="flex items-end justify-between border-t border-sand-200 p-5 ">
          <Stat
            label="Next repayment date"
            value={format(dueDate.toNumber() * 1000, "MMM d, y")}
            tooltip="lorem ipsum text"
          />
          <Button variant="rounded" colorScheme="secondary">
            See schedule
          </Button>
        </div>
      )}
    </div>
  );
}
