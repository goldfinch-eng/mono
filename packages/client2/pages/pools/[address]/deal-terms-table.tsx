import { gql } from "@apollo/client";
import { format } from "date-fns";
import { FixedNumber } from "ethers";

import {
  Button,
  InfoIconTooltip,
  ShimmerLines,
} from "@/components/design-system";
import { POOL_METADATA } from "@/constants";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SupportedCrypto,
  DealTermsTableFieldsFragment,
} from "@/lib/graphql/generated";
import { PoolStatus } from "@/lib/pools";

export const DEAL_TERMS_TABLE_FIELDS = gql`
  fragment DealTermsTableFields on TranchedPool {
    id
    estimatedLeverageRatio
    fundableAt
    creditLine {
      interestAprDecimal
      maxLimit
      paymentPeriodInDays
      termInDays
      borrower
      lateFeeApr
    }
  }
`;

interface DealTermsProps {
  tranchedPool?: DealTermsTableFieldsFragment | null;
  poolStatus: PoolStatus | null;
}

function getLateFeeApr(
  tranchedPool: DealTermsTableFieldsFragment
): FixedNumber {
  // Override the on-chain lateFeeApr value if there is a hardcoded lateFeeApr in
  // POOL_METADATA because some credit lines were incorrectly initialized with a
  // lateFeeApr of 0
  if (POOL_METADATA[tranchedPool.id].lateFeeApr) {
    return FixedNumber.fromString(
      `${POOL_METADATA[tranchedPool.id].lateFeeApr}`
    );
  } else {
    return tranchedPool.creditLine.lateFeeApr;
  }
}

export default function DealTermsTable({
  tranchedPool,
  poolStatus,
}: DealTermsProps) {
  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Deal Terms</h2>
          <div className="flex text-sand-400">
            <InfoIconTooltip
              size="sm"
              content="The Borrower's proposed terms for the Pool, including the loan's basic timeframe and conditions."
            />
          </div>
        </div>
        {tranchedPool && poolStatus !== PoolStatus.ComingSoon ? (
          <Button
            variant="rounded"
            colorScheme="secondary"
            iconRight="ArrowTopRight"
            as="a"
            href={`https://etherscan.io/address/${tranchedPool.id}`}
            target="_blank"
            rel="noopener"
          >
            Contract
          </Button>
        ) : null}
      </div>
      {!tranchedPool ? (
        <ShimmerLines truncateFirstLine={false} lines={8} />
      ) : (
        <Table
          rows={[
            [
              "Interest Rate",
              "The fixed interest rate APR paid by the Borrower to the Pool.",
              formatPercent(tranchedPool.creditLine.interestAprDecimal),
            ],
            [
              "Drawdown cap",
              "The total funds that the Borrower can drawdown from this Pool.",
              formatCrypto({
                token: SupportedCrypto.Usdc,
                amount: tranchedPool.creditLine.maxLimit,
              }),
            ],
            [
              "Payment frequency",
              "Frequency of interest and principal payments.",
              `${tranchedPool.creditLine.paymentPeriodInDays.toString()} days`,
            ],
            [
              "Payment term",
              "The length of time until the full principal is due.",
              `${tranchedPool.creditLine.termInDays.toString()} days`,
            ],
            [
              "Default interest rate",
              "An additional interest rate paid by the Borrower if they are late on their payments following the grace period. The total interest rate a Borrower in default pays =  interest rate + default interest rate.",
              formatPercent(getLateFeeApr(tranchedPool)),
            ],
            [
              "Current leverage ratio",
              "The leverage of senior tranche to junior tranche capital in this Pool. Senior tranche capital is automatically allocated by Goldfinch's Senior Pool, according to the protocol's leverage model. Junior tranche capital is provided directly by Backer investments. A current leverage ratio of 4x means that for every $1 of junior capital deposited by Backers, $4 of senior capital will be allocated by the Senior Pool.",
              tranchedPool.estimatedLeverageRatio
                ? tranchedPool.estimatedLeverageRatio.toString()
                : "N/A",
            ],
            [
              "Opening date",
              "The date that the Pool will be open for Backer investments.",
              format(
                new Date(tranchedPool.fundableAt.toNumber() * 1000),
                "MMMM d, y"
              ),
            ],
            [
              "Contract address",
              "The Ethereum address for this Borrower Pool smart contract.",
              tranchedPool.id,
            ],
            [
              "Borrower address",
              "The Ethereum address associated with this Borrower.",
              tranchedPool.creditLine.borrower,
            ],
          ]}
        />
      )}
    </div>
  );
}

function Table({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse whitespace-nowrap border border-sand-200 text-sand-600">
        <tbody>
          {rows.map(([heading, tooltip, value], index) => (
            <tr key={index} className="border border-sand-200">
              <th scope="row" className="bg-sand-50 p-5 font-medium">
                <div className="flex items-center justify-between">
                  <div className="text-sand-600">{heading}</div>
                  <InfoIconTooltip size="sm" content={tooltip} />
                </div>
              </th>
              <td className="p-5">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
