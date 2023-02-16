import { gql } from "@apollo/client";
import { format as formatDate, formatDistanceToNow } from "date-fns";
import { FixedNumber, utils } from "ethers";

import { InfoIconTooltip, Stat, StatGrid } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  FundingStatsLoanFieldsFragment,
  FundingStatsDealFieldsFragment,
} from "@/lib/graphql/generated";

const twoWeeksMs = 1.21e9;

export const FUNDING_STATS_LOAN_FIELDS = gql`
  fragment FundingStatsLoanFields on TranchedPool {
    __typename
    juniorDeposited
    estimatedLeverageRatio
    fundableAt
    creditLine {
      id
      maxLimit
    }
  }
`;

export const FUNDING_STATS_DEAL_FIELDS = gql`
  fragment FundingStatsDealFields on Deal {
    dealType
  }
`;

interface FundingStatsProps {
  loan: FundingStatsLoanFieldsFragment;
  deal: FundingStatsDealFieldsFragment;
}

export function FundingStats({ loan, deal }: FundingStatsProps) {
  const { juniorDeposited, estimatedLeverageRatio, fundableAt } = loan;
  const isMultitranche =
    deal.dealType === "multitranche" && loan.__typename === "TranchedPool";
  const fundedAmount =
    isMultitranche && estimatedLeverageRatio
      ? juniorDeposited.add(
          utils.parseUnits(
            FixedNumber.from(juniorDeposited)
              .mulUnsafe(estimatedLeverageRatio)
              .toString(),
            0
          )
        )
      : juniorDeposited;
  const maxFundingAmount = loan.creditLine.maxLimit;

  const fillRatio = FixedNumber.from(fundedAmount).divUnsafe(
    FixedNumber.from(maxFundingAmount)
  );

  const estimatedCloseDate = new Date(
    fundableAt.toNumber() * 1000 + twoWeeksMs
  );

  return (
    <StatGrid bgColor="mustard-50" numColumns={3}>
      <div className="col-span-full bg-mustard-50 p-5">
        <div className="mb-5 flex justify-between gap-8">
          <div>
            <div className="mb-3 flex gap-2 text-sm">
              Capital supplied <InfoIconTooltip content="TODO content" />
            </div>
            <div className="text-lg font-medium">
              {formatCrypto({ token: "USDC", amount: fundedAmount })}
            </div>
          </div>
          <div>
            <div className="mb-3 flex gap-2 text-sm">
              Maximum deal size <InfoIconTooltip content="TODO content" />
            </div>
            <div className="text-lg font-medium">
              {formatCrypto({ token: "USDC", amount: maxFundingAmount })}
            </div>
          </div>
        </div>
        <div className="relative h-2.5 overflow-hidden rounded-full bg-mustard-100">
          <div
            className="h-full rounded-full bg-mustard-600"
            style={{
              width: `${fillRatio
                .mulUnsafe(FixedNumber.from(100))
                .toString()}%`,
            }}
          />
        </div>
      </div>
      <Stat
        label="Percent filled"
        tooltip="TODO content"
        value={formatPercent(fillRatio)}
      />
      <Stat
        label="Est. time left to invest"
        tooltip="TODO content"
        value={formatDistanceToNow(estimatedCloseDate)}
      />
      <Stat
        label="Est. deal close date"
        tooltip="TODO content"
        value={formatDate(estimatedCloseDate, "MMM dd, yyyy")}
      />
    </StatGrid>
  );
}
