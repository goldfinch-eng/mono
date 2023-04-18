import { gql } from "@apollo/client";
import {
  format as formatDate,
  fromUnixTime,
  formatDistance,
  isAfter,
} from "date-fns";
import { FixedNumber, utils } from "ethers";

import { InfoIconTooltip, Stat, StatGrid } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  FundingStatsLoanFieldsFragment,
  FundingStatsDealFieldsFragment,
} from "@/lib/graphql/generated";

const threeWeeksMs = 1000 * 60 * 60 * 24 * 7 * 3;
const fazzCloseExtraPadding = 60 * 60 * 8 * 1000 + 259_200; // TODO Fazz wanted to close a few hours later and 3 days, just take this out when Fazz is closed.

export const FUNDING_STATS_LOAN_FIELDS = gql`
  fragment FundingStatsLoanFields on Loan {
    __typename
    ... on TranchedPool {
      juniorDeposited
      estimatedLeverageRatio
    }
    totalDeposited
    fundableAt
    fundingLimit
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
  currentBlockTimestamp: number;
}

export function FundingStats({
  loan,
  deal,
  currentBlockTimestamp,
}: FundingStatsProps) {
  const now = fromUnixTime(currentBlockTimestamp);
  const fundedAmount =
    loan.__typename === "TranchedPool"
      ? deal.dealType === "multitranche" && loan.estimatedLeverageRatio
        ? loan.juniorDeposited.add(
            utils.parseUnits(
              FixedNumber.from(loan.juniorDeposited)
                .mulUnsafe(loan.estimatedLeverageRatio)
                .toString(),
              0
            )
          )
        : loan.juniorDeposited
      : loan.totalDeposited;
  const maxFundingAmount = loan.fundingLimit;

  const fillRatio = FixedNumber.from(fundedAmount).divUnsafe(
    FixedNumber.from(maxFundingAmount)
  );

  const estimatedCloseDate = new Date(
    loan.fundableAt * 1000 + threeWeeksMs + fazzCloseExtraPadding
  );

  return (
    <StatGrid bgColor="mustard-50" numColumns={3}>
      <div className="col-span-full bg-mustard-50 p-5">
        <div className="mb-5 flex justify-between gap-8">
          <div>
            <div className="mb-3 flex gap-2 text-sm">
              Capital supplied{" "}
              <InfoIconTooltip content="The amount of capital currently supplied for this deal." />
            </div>
            <div className="text-lg font-medium">
              {formatCrypto({ token: "USDC", amount: fundedAmount })}
            </div>
          </div>
          <div>
            <div className="mb-3 flex gap-2 text-sm">
              Maximum deal size{" "}
              <InfoIconTooltip content="The maximum amount of capital that can be supplied for this deal." />
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
      <Stat label="Percent filled" value={formatPercent(fillRatio)} />
      <Stat
        label="Est. time left to invest"
        value={
          isAfter(now, estimatedCloseDate)
            ? "-"
            : formatDistance(now, estimatedCloseDate)
        }
      />
      <Stat
        label="Est. deal close date"
        value={formatDate(estimatedCloseDate, "MMM dd, yyyy")}
      />
    </StatGrid>
  );
}
