import { gql } from "@apollo/client";
import { format } from "date-fns";

import { InfoIconTooltip } from "@/components/design-system";
import { formatCrypto, formatPercent } from "@/lib/format";
import {
  SupportedCrypto,
  DealTermsTableFieldsFragment,
} from "@/lib/graphql/generated";

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
    }
  }
`;

interface DealTermsProps {
  tranchedPool: DealTermsTableFieldsFragment;
}

export default function DealTermsTable({ tranchedPool }: DealTermsProps) {
  if (!tranchedPool) return <></>;

  const openingDate = new Date(tranchedPool.fundableAt.toNumber() * 1000);

  return (
    <table className="w-full border border-sand-200">
      <tbody>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Interest Rate
              <InfoIconTooltip
                size="sm"
                content="The Pool's fixed interest rate APR."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">
            {formatPercent(tranchedPool.creditLine.interestAprDecimal)}
          </td>
        </tr>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Drawdown cap
              <InfoIconTooltip
                size="sm"
                content="The total funds that the Borrower can drawdown from this Pool."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">
            {formatCrypto({
              token: SupportedCrypto.Usdc,
              amount: tranchedPool.creditLine.maxLimit,
            })}
          </td>
        </tr>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Payment frequency
              <InfoIconTooltip
                size="sm"
                content="Frequency of interest and principal payments."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">
            {tranchedPool.creditLine.paymentPeriodInDays.toString()} days
          </td>
        </tr>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Payment term
              <InfoIconTooltip
                size="sm"
                content="The length of time until the full principal is due."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">
            {tranchedPool.creditLine.termInDays.toNumber()} days
          </td>
        </tr>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Default interest rate
              <InfoIconTooltip
                size="sm"
                content="An additional interest rate paid by the Borrower if they are late on their payments following a 30 day grace period. The total interest rate a Borrower in default pays = interest rate + default interest rate."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">{formatPercent(0.1)}</td>
        </tr>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Current leverage ratio
              <InfoIconTooltip
                size="sm"
                content="The leverage of senior tranche to junior tranche capital in this Pool. Senior tranche capital is automatically allocated by Goldfinch's Senior Pool, according to the protocol's leverage model. Junior tranche capital is provided directly by Backer deposits. A current leverage ratio of 4x means that for every $1 of junior capital deposited by Backers, $4 of senior capital will be allocated by the Senior Pool."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">
            {tranchedPool.estimatedLeverageRatio.toNumber()}
          </td>
        </tr>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Opening date
              <InfoIconTooltip
                size="sm"
                content="The date that the Pool will be open for Backer investments."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">
            {format(openingDate, "MMMM d, y")}
          </td>
        </tr>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Contract address
              <InfoIconTooltip
                size="sm"
                content="The Ethereum address for this Borrower Pool smart contract."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">{tranchedPool.id}</td>
        </tr>
        <tr>
          <th className="max-w-xs border-b border-sand-200 bg-sand-50 p-5 font-medium">
            <div className="flex items-center justify-between">
              Borrower address
              <InfoIconTooltip
                size="sm"
                content="The Ethereum address associated with this Borrower."
              />
            </div>
          </th>
          <td className="border-b border-sand-200 p-5">0x</td>
        </tr>
      </tbody>
    </table>
  );
}
