import { gql } from "@apollo/client";

import { Stat, StatGrid } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import { AmountStatsFieldsFragment } from "@/lib/graphql/generated";
import {
  getLoanRepaymentStatus,
  getLoanRepaymentStatusLabel,
  REPAYMENT_STATUS_LOAN_FIELDS,
} from "@/lib/pools";

export const AMOUNT_STATS_FIELDS = gql`
  ${REPAYMENT_STATUS_LOAN_FIELDS}
  fragment AmountStatsFields on Loan {
    principalAmount
    initialInterestOwed
    ...RepaymentStatusLoanFields
  }
`;

interface AmountStatsProps {
  loan: AmountStatsFieldsFragment;
}

export function AmountStats({ loan }: AmountStatsProps) {
  const repaymentStatus = getLoanRepaymentStatus(loan);
  return (
    <StatGrid bgColor="mustard-50">
      <Stat
        label="Principal"
        tooltip="The principal amount of the loan."
        value={formatCrypto({ token: "USDC", amount: loan.principalAmount })}
      />
      <Stat
        label="Interest"
        tooltip="The total interest owed on the loan."
        value={formatCrypto({
          token: "USDC",
          amount: loan.initialInterestOwed,
        })}
      />
      <Stat
        label="Total"
        tooltip="The combined amount of money to be repaid."
        value={formatCrypto({
          token: "USDC",
          amount: loan.principalAmount.add(loan.initialInterestOwed),
        })}
      />
      <Stat
        label="Repayment status"
        value={getLoanRepaymentStatusLabel(repaymentStatus)}
      />
    </StatGrid>
  );
}
