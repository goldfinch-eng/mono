import { gql } from "@apollo/client";
import { ReactNode } from "react";

import { RiskTableDealFieldsFragment } from "@/lib/graphql/generated";

export const RISK_TABLE_DEAL_FIELDS = gql`
  fragment RiskTableDealFields on Deal {
    securitiesAndRecourse {
      value
    }
  }
`;

interface RiskTableProps {
  deal: RiskTableDealFieldsFragment;
}

export function RiskTable({ deal }: RiskTableProps) {
  return (
    <table>
      <tbody className="divide-y divide-sand-200">
        {deal.securitiesAndRecourse?.value ? (
          <RiskTableRow
            heading="Loan-to-value ratio"
            value={
              <div>
                <div>
                  {new Intl.NumberFormat("en-US", {
                    style: "percent",
                  }).format(deal.securitiesAndRecourse.value)}
                </div>
                {deal.securitiesAndRecourse.value > 1 ? (
                  <div>This deal is overcollateralized</div>
                ) : null}
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
  value,
}: {
  heading: string;
  value: ReactNode;
}) {
  return (
    <tr>
      <th
        scope="row"
        className="py-4 pr-5 align-top text-sm font-medium text-mustard-600"
      >
        {heading}
      </th>
      <td className="py-4 pl-5 text-sm text-sand-700">{value}</td>
    </tr>
  );
}
