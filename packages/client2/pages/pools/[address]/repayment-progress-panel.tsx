import { gql } from "@apollo/client";
import clsx from "clsx";
import { formatDistanceToNowStrict } from "date-fns";
import { BigNumber, FixedNumber } from "ethers";

import { InfoIconTooltip, Icon } from "@/components/design-system";
import { formatCrypto } from "@/lib/format";
import {
  SupportedCrypto,
  RepaymentProgressPanelTranchedPoolFieldsFragment,
  RepaymentProgressPanelPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import { PoolStatus } from "@/lib/pools";

export const REPAYMENT_PROGRESS_PANEL_FIELDS = gql`
  fragment RepaymentProgressPanelTranchedPoolFields on TranchedPool {
    estimatedJuniorApy
    initialInterestOwed
    principalAmountRepaid
    interestAmountRepaid
    creditLine {
      limit
      termInDays
      termEndTime
    }
  }
`;

export const REPAYMENT_PROGRESS_PANEL_POOL_TOKEN_FIELDS = gql`
  fragment RepaymentProgressPanelPoolTokenFields on TranchedPoolToken {
    principalAmount
  }
`;

interface RepaymentProgressPanelProps {
  poolStatus: PoolStatus.Full | PoolStatus.Repaid;
  tranchedPool: RepaymentProgressPanelTranchedPoolFieldsFragment;
  userPoolTokens: RepaymentProgressPanelPoolTokenFieldsFragment[];
}

export default function RepaymentProgressPanel({
  poolStatus,
  tranchedPool,
  userPoolTokens,
}: RepaymentProgressPanelProps) {
  const totalRepaid = tranchedPool.principalAmountRepaid.add(
    tranchedPool.interestAmountRepaid
  );
  const userHasPosition = userPoolTokens.length > 0;
  const userPositionRatio =
    userPoolTokens.reduce(
      (prev, current) => prev + current.principalAmount.toNumber(),
      0
    ) / tranchedPool.creditLine.limit.toNumber();
  const principalOutstanding = tranchedPool.creditLine.limit.sub(
    tranchedPool.principalAmountRepaid
  );

  const numYears = FixedNumber.from(
    tranchedPool.creditLine.termInDays.div("365")
  );
  const oneYearBackerInterest = FixedNumber.from(
    tranchedPool.creditLine.limit
  ).mulUnsafe(tranchedPool.estimatedJuniorApy);
  const initialBackerInterestOwed = BigNumber.from(
    parseInt(oneYearBackerInterest.mulUnsafe(numYears).round().toString())
  );
  const backerInterestOutstanding = initialBackerInterestOwed.sub(
    tranchedPool.interestAmountRepaid
  );

  const interestOutstanding = tranchedPool.initialInterestOwed.sub(
    tranchedPool.interestAmountRepaid
  );

  const remainingInterestTime = formatDistanceToNowStrict(
    tranchedPool.creditLine.termEndTime.toNumber() * 1000,
    { unit: "month" }
  );

  return (
    <div className="rounded-xl border border-sand-200 p-5">
      {userHasPosition ? (
        <div>
          <PanelHeading
            heading="Remaining position outstanding"
            tooltip="The total value of your investment that remains for the Borrower to repay to you over the course of the Pool's payment term, including interest and principal repayments."
            value={formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: multiplyByFraction(
                principalOutstanding.add(backerInterestOutstanding),
                userPositionRatio
              ),
            })}
          />
          <MiniTable
            rows={[
              [
                "Principal",
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: multiplyByFraction(
                    principalOutstanding,
                    userPositionRatio
                  ),
                }),
              ],
              [
                `Interest (${remainingInterestTime})`,
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: multiplyByFraction(
                    backerInterestOutstanding,
                    userPositionRatio
                  ),
                }),
              ],
              [
                "Total",
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: multiplyByFraction(
                    principalOutstanding.add(backerInterestOutstanding),
                    userPositionRatio
                  ),
                }),
              ],
            ]}
          />
        </div>
      ) : poolStatus === PoolStatus.Full ? (
        <div>
          <PanelHeading
            heading="Total remaining principal and interest"
            tooltip="The total amount of USDC remaining for the Borrower to repay to this Pool over its payment term, including interest and principal repayments."
            value={formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: principalOutstanding.add(interestOutstanding),
            })}
          />
          <MiniTable
            rows={[
              [
                "Principal",
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: principalOutstanding,
                }),
              ],
              [
                `Interest (${remainingInterestTime})`,
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: interestOutstanding,
                }),
              ],
              [
                "Total",
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: principalOutstanding.add(interestOutstanding),
                }),
              ],
            ]}
          />
        </div>
      ) : poolStatus === PoolStatus.Repaid ? (
        <div>
          <PanelHeading
            heading="Total USDC repaid"
            tooltip="The total amount of of USDC that the Borrower repaid to this Pool over its payment term, including interest and principal repayments."
            value={formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: totalRepaid,
            })}
          />
          <MiniTable
            rows={[
              [
                "Principal",
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: tranchedPool.principalAmountRepaid,
                }),
              ],
              [
                "Interest",
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: tranchedPool.interestAmountRepaid,
                }),
              ],
              [
                "Total",
                formatCrypto({
                  token: SupportedCrypto.Usdc,
                  amount: totalRepaid,
                }),
              ],
            ]}
          />
        </div>
      ) : null}
    </div>
  );
}

function PanelHeading({
  heading,
  tooltip,
  value,
}: {
  heading: string;
  tooltip: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2 text-sm">
        {heading}
        <InfoIconTooltip content={tooltip} size="sm" />
      </div>
      <div className="flex items-center gap-2 text-3xl">
        {value}
        <Icon name="Usdc" size="md" />
      </div>
    </div>
  );
}

function MiniTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="mt-6 w-full border-collapse">
      <tbody>
        {rows.map((row, index) => (
          <tr
            key={index}
            className={clsx(index === rows.length - 1 ? "font-semibold" : null)}
          >
            <th
              scope="row"
              className={clsx(
                "border border-sand-200 py-2 px-4 text-left",
                index === rows.length - 1 ? "font-semibold" : "font-normal"
              )}
            >
              {row[0]}
            </th>
            <td className="border border-sand-200 py-2 px-4 text-right">
              {row[1]}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function multiplyByFraction(n: BigNumber, m: number): BigNumber {
  return BigNumber.from(Math.trunc(n.toNumber() * m));
}
