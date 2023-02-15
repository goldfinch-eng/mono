import { gql } from "@apollo/client";
import {
  format as formatDate,
  formatDistanceStrict as formatDateDistance,
} from "date-fns";
import { FixedNumber } from "ethers";

import { Stat, StatGrid } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import { TranchedPoolStatGridFieldsFragment } from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat, PoolStatus } from "@/lib/pools";

// The fragments here are just used for the purpose of typechecking. They don't get sent to the top-level query because of the fragment overlap bug
export const TRANCHED_POOL_STAT_GRID_FIELDS = gql`
  fragment TranchedPoolStatGridFields on TranchedPool {
    estimatedJuniorApy
    estimatedJuniorApyFromGfiRaw
    creditLine {
      id
      isLate @client
      termInDays
      paymentPeriodInDays
      termEndTime
      nextDueTime
      limit
      balance
    }
  }
`;

interface StatGridProps {
  poolStatus: PoolStatus;
  tranchedPool: TranchedPoolStatGridFieldsFragment;
  seniorPoolApyFromGfiRaw: FixedNumber;
  fiatPerGfi: number;
  className?: string;
}

export function StatusSection({
  poolStatus,
  tranchedPool,
  seniorPoolApyFromGfiRaw,
  fiatPerGfi,
  className,
}: StatGridProps) {
  const tranchedPoolApyFromGfi = computeApyFromGfiInFiat(
    tranchedPool.estimatedJuniorApyFromGfiRaw,
    fiatPerGfi
  );
  const seniorPoolApyFromGfi = computeApyFromGfiInFiat(
    seniorPoolApyFromGfiRaw,
    fiatPerGfi
  );
  const apyFromGfi = tranchedPool.estimatedJuniorApyFromGfiRaw.isZero()
    ? tranchedPool.estimatedJuniorApyFromGfiRaw
    : tranchedPoolApyFromGfi.addUnsafe(seniorPoolApyFromGfi);
  const totalEstApy = tranchedPool.estimatedJuniorApy.addUnsafe(apyFromGfi);

  const totalEstApyStat = (
    <Stat
      key="totalEstApyStat"
      label="Total est. APY"
      value={formatPercent(totalEstApy)}
      tooltip="The Pool's total estimated APY, including the USDC APY and est. GFI rewards APY net protocol fees."
    />
  );
  const usdcApyStat = (
    <Stat
      key="usdcApyStat"
      label="USDC APY"
      value={formatPercent(tranchedPool.estimatedJuniorApy)}
      tooltip="The fixed-rate USDC APY defined by the Borrower Pool's financing terms and interest allocation from the Senior Tranche."
    />
  );
  const gfiApyStat = (
    <Stat
      key="gfiApyStat"
      label="Est. GFI APY"
      value={formatPercent(apyFromGfi)}
      tooltip="The Pool's estimated GFI rewards APY, including Investor Rewards and the Backer Bonus."
    />
  );
  const repaymentStatusStat = (
    <Stat
      key="repaymentStatusStat"
      label="Repayment status"
      value={
        poolStatus === PoolStatus.Repaid
          ? "Repaid"
          : tranchedPool.creditLine.isLate
          ? "Grace Period"
          : "Current"
      }
      tooltip="The current status of the Borrower's repayments to this Pool. A status of Current means that the Borrower is up-to-date on their principal and interest payments to this Pool. A status of Default means that the Borrower has been late on their principal and interest payments to this Pool beyond the grace period."
    />
  );
  const principalOutstandingStat = (
    <Stat
      key="principalOutstandingStat"
      label="Principal outstanding"
      value={formatCrypto({
        token: "USDC",
        amount: tranchedPool.creditLine.balance,
      })}
      tooltip="The total amount of principal remaining for the Borrower to repay to this Pool over its payment term."
    />
  );
  const paymentFrequencyStat = (
    <Stat
      key="paymentFrequencyStat"
      label="Payment frequency"
      value={`${tranchedPool.creditLine.paymentPeriodInDays.toString()} days`}
      tooltip="Frequency of interest payments."
    />
  );
  const nextPaymentStat = (
    <Stat
      key="nextPaymentStat"
      label="Next repayment due"
      value={
        !tranchedPool.creditLine.nextDueTime.isZero()
          ? formatDate(
              new Date(tranchedPool.creditLine.nextDueTime.toNumber() * 1000),
              "MMM d, y"
            )
          : "---"
      }
      tooltip="The next scheduled date for the Borrower to make a repayment to this Pool, according to the Pool's deal terms."
    />
  );
  const finalRepaymentStat = (
    <Stat
      key="finalPaymentStat"
      label="Payment term end"
      value={formatDate(
        new Date(tranchedPool.creditLine.termEndTime.toNumber() * 1000),
        "MMM d, y"
      )}
      tooltip="The date that the Pool's payment term will end, and by which the Borrower is scheduled to have repaid their total loan amount in full, according to the Pool's deal terms."
    />
  );
  const limitStat = (
    <Stat
      key="limitStat"
      label="Pool limit"
      value={formatCrypto({
        token: "USDC",
        amount: tranchedPool.creditLine.limit,
      })}
      tooltip="The total funds that the Borrower can drawdown from this Pool."
    />
  );
  const paymentTermStat = (
    <Stat
      key="paymentTermStat"
      label="Payment term"
      value={formatDateDistance(
        0,
        tranchedPool.creditLine.termInDays.toNumber() * 86400 * 1000
      )}
      tooltip="The length of time until the full principal is due."
    />
  );

  return (
    <StatGrid className={className}>
      {poolStatus === PoolStatus.Full || poolStatus === PoolStatus.Repaid
        ? [
            totalEstApyStat,
            usdcApyStat,
            gfiApyStat,
            repaymentStatusStat,
            principalOutstandingStat,
            paymentFrequencyStat,
            nextPaymentStat,
            finalRepaymentStat,
          ]
        : poolStatus === PoolStatus.Open
        ? [limitStat, paymentTermStat, paymentFrequencyStat]
        : [
            totalEstApyStat,
            usdcApyStat,
            gfiApyStat,
            limitStat,
            paymentTermStat,
            paymentFrequencyStat,
          ]}
    </StatGrid>
  );
}
