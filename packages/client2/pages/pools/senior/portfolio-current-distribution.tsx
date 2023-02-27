import { format as formatDate } from "date-fns";

import { formatCrypto } from "@/lib/format";
import {
  SeniorPoolPortfolioDetailsFieldsFragment,
  SeniorPoolPortfolioPoolsDealsFieldsFragment,
} from "@/lib/graphql/generated";
import { getLoanRepaymentStatus } from "@/lib/pools";

interface PortfolioCurrentDistributionProps {
  seniorPool: SeniorPoolPortfolioDetailsFieldsFragment;
  dealMetaData: Record<string, SeniorPoolPortfolioPoolsDealsFieldsFragment>;
}

export function PortfolioCurrentDistribution({
  seniorPool,
  dealMetaData,
}: PortfolioCurrentDistributionProps) {
  return (
    <div className="rounded-xl border border-sand-300">
      <div className="flex justify-between p-6">
        <div className="text-sm">Current distribution</div>
        <div className="text-sm">by Deal</div>
      </div>

      <table className="w-full text-xs [&_th]:px-3.5 [&_th]:py-2 [&_th]:font-normal [&_td]:px-3.5 [&_td]:py-2">
        <thead>
          <tr className="bg-mustard-100">
            <th scope="col" className="w-[30%] text-left">
              Deal name
            </th>
            <th scope="col" className="w-[17.5%] text-right">
              Portfolio share
            </th>
            <th scope="col" className="w-[17.5%] text-right">
              Capital owed
            </th>
            <th scope="col" className="w-[17.5%] text-right">
              Maturity date
            </th>
            <th scope="col" className="w-[17.5%] text-right">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sand-300">
          {seniorPool.tranchedPools.map((pool) => {
            const dealDetails = dealMetaData[pool.id];

            return (
              <tr key={pool.id}>
                <td className="text-left">{dealDetails.name}</td>
                <td className="text-right">
                  {formatCrypto({ amount: pool.balance, token: "USDC" })}
                </td>
                <td className="text-right">
                  {formatCrypto({ amount: pool.balance, token: "USDC" })}
                </td>
                <td className="text-right">
                  {formatDate(
                    pool.termEndTime.toNumber() * 1000,
                    "MMM dd, yyyy"
                  )}
                </td>
                <td className="text-right">{getLoanRepaymentStatus(pool)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
