import { gql } from "@apollo/client";

import {
  GoldfinchLogo,
  InfoLine,
  Link,
  Shimmer,
} from "@/components/design-system";
import { formatPercent } from "@/lib/format";
import { SeniorPoolLoanSummaryFieldsFragment } from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";

export const SENIOR_POOL_LOAN_SUMMARY_FIELDS = gql`
  fragment SeniorPoolLoanSummaryFields on SeniorPool {
    address
    estimatedApy
    estimatedApyFromGfiRaw
  }
`;

interface SeniorPoolLoanSummaryProps {
  seniorPool?: SeniorPoolLoanSummaryFieldsFragment | null;
  fiatPerGfi?: number | null;
}

export function SeniorPoolLoanSummary({
  seniorPool,
  fiatPerGfi,
}: SeniorPoolLoanSummaryProps) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-mustard-500">
            <GoldfinchLogo className="h-3 w-3" />
          </div>
          <span className="text-sm">Goldfinch Protocol</span>
        </div>
        <Link
          href={
            seniorPool
              ? `https://etherscan.io/contract/${seniorPool.address}`
              : ""
          }
          openInNewTab
          iconRight="ArrowTopRight"
          className="text-sm font-medium text-sand-500"
        >
          Etherscan
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="mb-1 font-serif text-3xl font-semibold text-sand-800">
          Goldfinch Senior Pool
        </h1>
        <div className="text-sm text-sand-500">
          Supply capital to the Senior Pool in order to earn yields optimized
          for ease and diversification. Capital is automatically diversified
          across Borrower pools according to the{" "}
          <Link
            openInNewTab
            href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/leveragemodel"
          >
            Leverage Model
          </Link>{" "}
          and protected by Backer capital.
        </div>
      </div>
      <div className="mb-6 flex justify-between gap-5">
        <div className="text-left">
          <div className="mb-2 text-sm">USDC APY</div>
          <div className="font-serif text-4xl font-semibold text-sand-800">
            {seniorPool ? (
              formatPercent(seniorPool.estimatedApy)
            ) : (
              <Shimmer style={{ width: "8ch" }} />
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-2 text-sm">Variable GFI APY</div>
          <div className="font-serif text-4xl font-semibold text-sand-800">
            {seniorPool && fiatPerGfi ? (
              formatPercent(
                computeApyFromGfiInFiat(
                  seniorPool.estimatedApyFromGfiRaw,
                  fiatPerGfi
                )
              )
            ) : (
              <Shimmer style={{ width: "8ch" }} />
            )}
          </div>
        </div>
      </div>
      <div className="-mb-3">
        <InfoLine
          label="Loan term"
          tooltip="The Senior Pool does not have a fixed loan term."
          value="Open-ended"
        />
        <InfoLine
          label="Liquidity"
          tooltip="You may submit a withdrawal request, and the available liquidity in the Senior Pool will be divided amongst all outstanding withdrawal requests every 2 weeks."
          value="Withdrawal request (2-week window)"
        />
      </div>
    </div>
  );
}
