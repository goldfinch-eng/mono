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
      value: "On-chain capital for this deal comes from multiple sources",
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
                ? "First-loss capital"
                : "If the borrower has received other off-chain funding for this pool, on-chain capital will be prioritized first",
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
                ? "The borrower will receive other on-chain funding that is senior to the capital provided in this pool"
                : "If the borrower has received other on-chain funding for this pool, this capital will be prioritized first",
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
          Investors can access borrower-related updated via investment-gated{" "}
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
                  data room
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
