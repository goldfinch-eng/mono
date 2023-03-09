import { gql } from "@apollo/client";
import { formatDistanceStrict } from "date-fns";
import { FixedNumber } from "ethers";
import Image from "next/future/image";

import { InfoLine } from "@/components/design-system";
import { RichText } from "@/components/rich-text";
import { formatPercent } from "@/lib/format";
import {
  LoanSummaryDealFieldsFragment,
  LoanSummaryTranchedPoolFieldsFragment,
  LoanSummaryBorrowerFieldsFragment,
} from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";

const secondsPerDay = 86400;

export const LOAN_SUMMARY_TRANCHED_POOL_FIELDS = gql`
  fragment LoanSummaryTranchedPoolFields on Loan {
    id
    usdcApy
    interestRate
    rawGfiApy
    termInDays
  }
`;

export const LOAN_SUMMARY_BORROWER_FIELDS = gql`
  fragment LoanSummaryBorrowerFields on Borrower {
    id
    name
    logo {
      url
    }
  }
`;

export const LOAN_SUMMARY_DEAL_FIELDS = gql`
  fragment LoanSummaryDealFields on Deal {
    id
    name
    overview
    dealType
  }
`;

interface LoanSummaryProps {
  className?: string;
  loan: LoanSummaryTranchedPoolFieldsFragment;
  deal: LoanSummaryDealFieldsFragment;
  borrower: LoanSummaryBorrowerFieldsFragment;
  seniorPoolEstimatedApyFromGfiRaw: FixedNumber;
  fiatPerGfi: number;
}

export function LoanSummary({
  className,
  loan,
  deal,
  borrower,
  seniorPoolEstimatedApyFromGfiRaw,
  fiatPerGfi,
}: LoanSummaryProps) {
  return (
    <div className={className}>
      <div className="mb-4 flex items-center gap-2">
        <div className="relative h-5 w-5 overflow-hidden rounded-full bg-sand-200">
          {borrower.logo?.url ? (
            <Image
              fill
              sizes="20px"
              src={borrower.logo.url}
              alt={`${borrower.name} logo`}
            />
          ) : null}
        </div>
        <span className="text-sm">{borrower.name}</span>
      </div>
      <div className="mb-8">
        <h1 className="mb-1 font-serif text-3xl font-semibold text-sand-800">
          {deal.name}
        </h1>
        <RichText content={deal.overview} className="text-sm text-sand-500" />
      </div>
      <div className="mb-6 flex justify-between gap-5">
        <div className="text-left">
          <div className="mb-2 text-sm">Fixed USDC APY</div>
          <div className="font-serif text-4xl font-semibold text-sand-800">
            {formatPercent(
              deal.dealType === "multitranche"
                ? loan.usdcApy
                : loan.interestRate
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="mb-2 text-sm">Variable GFI APY</div>
          <div className="font-serif text-4xl font-semibold text-sand-800">
            {formatPercent(
              computeApyFromGfiInFiat(loan.rawGfiApy, fiatPerGfi).addUnsafe(
                computeApyFromGfiInFiat(
                  seniorPoolEstimatedApyFromGfiRaw,
                  fiatPerGfi
                )
              )
            )}
          </div>
        </div>
      </div>
      <div className="-mb-3">
        <InfoLine
          label="Loan term"
          tooltip="Length of the loan term up until the principal is due."
          value={formatDistanceStrict(
            0,
            loan.termInDays * secondsPerDay * 1000,
            { unit: "month", roundingMethod: "ceil" }
          )}
        />
        <InfoLine
          label="Liquidity"
          tooltip="When you can withdraw and reclaim your invested capital."
          value="End of loan term"
        />
      </div>
    </div>
  );
}
