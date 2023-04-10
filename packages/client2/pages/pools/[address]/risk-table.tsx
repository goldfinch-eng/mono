import { gql } from "@apollo/client";

import {
  Link,
  VerboseTable,
  VerboseTableRowProps,
} from "@/components/design-system";
import { RichText } from "@/components/rich-text";
import { formatPercent } from "@/lib/format";
import {
  RiskTableDealFieldsFragment,
  RiskTableLoanFieldsFragment,
} from "@/lib/graphql/generated";
import { HighValueInvestorNotice } from "@/pages/pools/high-value-investor-notice";

export const RISK_TABLE_DEAL_FIELDS = gql`
  fragment RiskTableDealFields on Deal {
    securitiesAndRecourse {
      value
      secured
      type
      description
      recourse
      recourseDescription
    }
    dealType
    agreement
    dataroom
    dueDiligenceContact
    onChainCapitalPriority
    offChainCapitalPriority
    collateralAssets
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
  const riskTableRows: VerboseTableRowProps[] = [
    ...(deal.securitiesAndRecourse?.value
      ? [
          {
            heading: "LTV ratio",
            boldValue: new Intl.NumberFormat("en-US", {
              style: "percent",
            }).format(deal.securitiesAndRecourse.value),
            value:
              deal.securitiesAndRecourse.value < 1
                ? "This deal is overcollateralized"
                : deal.securitiesAndRecourse.value > 1
                ? "This deal is undercollateralized"
                : null,
          },
        ]
      : []),
    {
      heading: "Deal structure",
      boldValue:
        deal.dealType === "multitranche"
          ? "Multitranche"
          : deal.dealType === "unitranche"
          ? "Unitranche"
          : null,
      value:
        deal.dealType === "multitranche"
          ? "On-chain capital for this pool is being raised into a multiple tranches"
          : "On-chain capital for this pool is being raised into a single tranche",
    },
    ...(loan.__typename === "TranchedPool" &&
    loan.estimatedLeverageRatio &&
    deal.dealType === "multitranche"
      ? [
          {
            heading: "Leverage ratio",
            boldValue: `${new Intl.NumberFormat("en-US", {
              maximumFractionDigits: 1,
            }).format(loan.estimatedLeverageRatio.toUnsafeFloat())}:1`,
            value: (
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
            ),
          },
        ]
      : []),
    ...(deal.onChainCapitalPriority
      ? [
          {
            heading: "On-chain capital priority",
            boldValue:
              deal.onChainCapitalPriority === "junior" ? "Junior" : "Senior",
            value:
              deal.onChainCapitalPriority === "junior"
                ? "The repayment of other on-chain loans are prioritized ahead of the repayment of the capital invested in this pool"
                : "The capital invested in this pool will be repaid pari passu with other senior debt, if any, raised by the company",
          },
        ]
      : []),
    ...(deal.offChainCapitalPriority
      ? [
          {
            heading: "Off-chain capital priority",
            boldValue:
              deal.offChainCapitalPriority === "junior" ? "Junior" : "Senior",
            value:
              deal.offChainCapitalPriority === "junior"
                ? "The repayment of other off-chain loans are prioritized ahead of the repayment of the capital invested in this pool"
                : "The capital invested in this pool will be repaid pari passu with other senior debt, if any, raised by the company",
          },
        ]
      : []),

    ...(deal.securitiesAndRecourse &&
    deal.securitiesAndRecourse.secured !== null
      ? [
          {
            heading: "Collateralization",
            boldValue: deal.securitiesAndRecourse.secured ? "Yes" : "No",
            value: (
              <RichText content={deal.securitiesAndRecourse.description} />
            ),
          },
        ]
      : []),
    ...(deal.collateralAssets
      ? [
          {
            heading: "Collateral assets",
            value: <RichText content={deal.collateralAssets} />,
          },
        ]
      : []),
    ...(deal.securitiesAndRecourse &&
    deal.securitiesAndRecourse.recourse !== null
      ? [
          {
            heading: "Recourse to borrower",
            boldValue: deal.securitiesAndRecourse.recourse ? "Yes" : "No",
            value: null,
          },
        ]
      : []),
    {
      heading: "Post-close reporting",
      value: (
        <div>
          Investors can access borrower-related updated via the investment-gated{" "}
          <Link
            href="https://discord.com/channels/793925570739044362/1034881143964717066"
            openInNewTab
          >
            Discord Channel
          </Link>
        </div>
      ),
    },
    ...(deal.agreement
      ? [
          {
            heading: "Legal recourse",
            boldValue: (
              <Link href={deal.agreement} openInNewTab>
                Loan agreement
              </Link>
            ),
            value:
              "Specifies the loan terms agreed to by the borrower and all investors; legally enforceable off-chain",
          },
        ]
      : []),
    ...(deal.dataroom
      ? [
          {
            heading: "Due diligence",
            value: (
              <div>
                Additional due diligence information can be viewed in the{" "}
                <Link href={deal.dataroom} openInNewTab>
                  dataroom
                </Link>{" "}
                or by contacting the borrower{" "}
                {deal.dueDiligenceContact ? (
                  <Link openInNewTab href={deal.dueDiligenceContact}>
                    directly
                  </Link>
                ) : (
                  "directly"
                )}
                .
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <VerboseTable rows={riskTableRows} className="mb-4" />
      <HighValueInvestorNotice />
    </>
  );
}
