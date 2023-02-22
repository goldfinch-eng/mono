import { gql } from "@apollo/client";
import { ReactNode } from "react";

import { formatPercent } from "@/lib/format";
import {
  RiskTableDealFieldsFragment,
  RiskTableLoanFieldsFragment,
} from "@/lib/graphql/generated";

export const RISK_TABLE_DEAL_FIELDS = gql`
  fragment RiskTableDealFields on Deal {
    securitiesAndRecourse {
      value
    }
    dealType
  }
`;

export const RISK_TABLE_LOAN_FIELDS = gql`
  fragment RiskTableLoanFields on Loan {
    __typename
    ... on TranchedPool {
      estimatedLeverageRatio
    }
  }
`;

interface RiskTableProps {
  deal: RiskTableDealFieldsFragment;
  loan: RiskTableLoanFieldsFragment;
}

export function RiskTable({ deal, loan }: RiskTableProps) {
  return (
    <table>
      <tbody className="divide-y divide-sand-200">
        {deal.securitiesAndRecourse?.value ? (
          <RiskTableRow
            heading="LTV ratio"
            boldValue={new Intl.NumberFormat("en-US", {
              style: "percent",
            }).format(deal.securitiesAndRecourse.value)}
            value={
              deal.securitiesAndRecourse.value > 1
                ? "This deal is overcollateralized"
                : null
            }
          />
        ) : null}
        <RiskTableRow
          heading="Deal structure"
          boldValue={
            deal.dealType === "multitranche"
              ? "Tranched"
              : deal.dealType === "unitranche"
              ? "Non-tranched"
              : null
          }
          value="On-chain capital for this deal comes from multiple sources"
        />
        {loan.__typename === "TranchedPool" && loan.estimatedLeverageRatio ? (
          <RiskTableRow
            heading="Leverage ratio"
            boldValue={`${new Intl.NumberFormat("en-US", {
              maximumFractionDigits: 1,
            }).format(loan.estimatedLeverageRatio.toUnsafeFloat())}:1`}
            value={
              <div>
                <div>
                  The ratio of capital supplied from each on-chain source:
                </div>
                <ul className="list-disc pl-5">
                  <li>
                    Senior Pool (
                    {formatPercent(
                      1 - 1 / (loan.estimatedLeverageRatio.toUnsafeFloat() + 1)
                    )}
                    )
                  </li>
                  <li>
                    Direct funding (
                    {formatPercent(
                      1 / (loan.estimatedLeverageRatio.toUnsafeFloat() + 1)
                    )}
                    )
                  </li>
                </ul>
              </div>
            }
          />
        ) : null}
      </tbody>
    </table>
  );
}

function RiskTableRow({
  heading,
  boldValue,
  value,
}: {
  heading: string;
  boldValue?: ReactNode;
  value: ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="py-4 pr-5 text-left align-top text-sm font-medium text-mustard-600"
      >
        {heading}
      </th>
      <td className="py-4 pl-5 text-sm text-sand-700">
        {boldValue ? <div className="font-medium">{boldValue}</div> : null}
        <div>{value}</div>
      </td>
    </tr>
  );
}
