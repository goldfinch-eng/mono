import { gql } from "@apollo/client";
import { ReactNode } from "react";

import { Icon, Link } from "@/components/design-system";
import { RichText } from "@/components/rich-text";
import { formatPercent } from "@/lib/format";
import {
  RiskTableDealFieldsFragment,
  RiskTableLoanFieldsFragment,
} from "@/lib/graphql/generated";

export const RISK_TABLE_DEAL_FIELDS = gql`
  fragment RiskTableDealFields on Deal {
    securitiesAndRecourse {
      value
      secured
      type
      description
      recourse
      recourseDescription
      covenants
    }
    dealType
    agreement
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
    <div>
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
                        1 -
                          1 / (loan.estimatedLeverageRatio.toUnsafeFloat() + 1)
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
          <RiskTableRow
            heading="On-chain capital priority"
            boldValue="Junior"
            value="First-loss capital"
          />
          <RiskTableRow
            heading="Off-chain capital priority"
            boldValue="Senior"
            value="If the borrower has received other off-chain funding for this pool, this capital will be prioritized first"
          />
          <RiskTableRow
            heading="Post-close reporting"
            value={
              <div>
                Investors can access borrower-related updated via
                investment-gated Discord Channel
              </div>
            }
          />
          {deal.securitiesAndRecourse &&
          deal.securitiesAndRecourse.secured !== null ? (
            <RiskTableRow
              heading="Securitization"
              boldValue={
                deal.securitiesAndRecourse.secured
                  ? `Yes${
                      deal.securitiesAndRecourse.type
                        ? ` (${deal.securitiesAndRecourse.type})`
                        : ""
                    }`
                  : "No"
              }
              value={
                <RichText content={deal.securitiesAndRecourse.description} />
              }
            />
          ) : null}
          {deal.securitiesAndRecourse &&
          deal.securitiesAndRecourse.recourse !== null ? (
            <RiskTableRow
              heading="Recourse to borrower"
              boldValue={deal.securitiesAndRecourse.recourse ? "Yes" : "No"}
              value={
                <RichText
                  content={deal.securitiesAndRecourse.recourseDescription}
                />
              }
            />
          ) : null}
          {deal.securitiesAndRecourse &&
          deal.securitiesAndRecourse.covenants ? (
            <RiskTableRow
              heading="Covenants"
              value={
                <RichText content={deal.securitiesAndRecourse.covenants} />
              }
            />
          ) : null}
        </tbody>
      </table>
      <div className="flex justify-between gap-2 rounded-lg bg-mustard-200 p-3 text-xs text-mustard-800">
        <div className="flex items-center gap-2">
          <Icon name="DollarSolid" className="text-mustard-500" size="sm" />
          <div>
            Investors depositing <span className="font-medium">$250,000+</span>{" "}
            should get in touch for additional information
          </div>
        </div>
        <Link
          href="mailto:hi@goldfinch.finance"
          iconRight="ArrowTopRight"
          className="whitespace-nowrap"
        >
          Learn more
        </Link>
      </div>
    </div>
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
