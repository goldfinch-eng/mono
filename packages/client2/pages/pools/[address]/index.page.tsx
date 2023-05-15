import { ParsedUrlQuery } from "querystring";

import { gql } from "@apollo/client";
import clsx from "clsx";
import { GetStaticPaths, GetStaticProps } from "next";

import { AdaptiveStickyContainer } from "@/components/adaptive-sticky-container";
import {
  Banner,
  ScrollingSectionedContainer,
} from "@/components/design-system";
import { BannerPortal } from "@/components/layout";
import { BacktoOpenDealsButton } from "@/components/pools/back-to-open-deals-button";
import { SEO } from "@/components/seo";
import { apolloClient } from "@/lib/graphql/apollo";
import {
  useSingleTranchedPoolDataQuery,
  SingleDealQuery,
  AllDealsQuery,
  SingleDealQueryVariables,
  SingleDealDocument,
} from "@/lib/graphql/generated";
import {
  getLoanFundingStatus,
  getLoanRepaymentStatus,
  LoanFundingStatus,
} from "@/lib/pools";
import { useWallet } from "@/lib/wallet";
import { NextPageWithLayout } from "@/pages/_app.page";

import { AmountStats } from "./amount-stats";
import { BorrowerProfile } from "./borrower-profile";
import { ClaimPanel } from "./claim-panel";
import { ComingSoonPanel } from "./coming-soon-panel";
import { CreditMemoAnalysisCard } from "./credit-memo-analysis-card";
import { DealHighlights } from "./deal-highlights";
import { FundingStats } from "./funding-stats";
import { InvestAndWithdrawTabs } from "./invest-and-withdraw/invest-and-withdraw-tabs";
import { LoanSummary, LoanSummaryPlaceholder } from "./loan-summary";
import {
  RepaymentTermsSchedule,
  RepaymentTermsSchedulePlaceholder,
} from "./repayment-terms/repayment-terms-schedule";
import {
  RepaymentTermsStats,
  RepaymentTermsStatsPlaceholder,
} from "./repayment-terms/repayment-terms-stats";
import { RiskTable } from "./risk-table";
import { TransactionTable } from "./transaction-table";

gql`
  query SingleTranchedPoolData(
    $tranchedPoolId: ID!
    $tranchedPoolAddress: String!
    $userId: ID!
    $borrowerAllPools: [ID!]
  ) {
    loan(id: $tranchedPoolId) {
      __typename
      id
      allowedUidTypes
      usdcApy
      rawGfiApy
      fundableAt
      ...LoanSummaryFields
      ...FundingStatusLoanFields
      ...SupplyPanelLoanFields
      ...ClaimPanelLoanFields
      ...RepaymentTermsStatsFields
      ...AmountStatsFields
      ...RepaymentTableLoanFields
    }
    borrowerAllPools: tranchedPools(
      where: { id_in: $borrowerAllPools, principalAmount_not: 0 }
      orderBy: createdAt
      orderDirection: desc
    ) {
      ...BorrowerAllPoolFields
    }
    seniorPools(first: 1) {
      id
      estimatedApyFromGfiRaw
    }
    gfiPrice(fiat: USD) @client {
      price {
        amount
        symbol
      }
    }
    user(id: $userId) {
      id
      ...SupplyPanelUserFields
      poolTokens(where: { loan: $tranchedPoolAddress }) {
        ...WithdrawalPanelPoolTokenFields
        ...ClaimPanelPoolTokenFields
      }
      vaultedPoolTokens(where: { loan: $tranchedPoolAddress }) {
        id
        poolToken {
          ...WithdrawalPanelPoolTokenFields
          ...ClaimPanelPoolTokenFields
        }
      }
    }

    currentBlock @client {
      timestamp
    }
  }
`;

gql`
  query SingleDeal($id: String!) @api(name: cms) {
    Deal(id: $id) {
      id
      name
      dealType
      category
      borrower {
        ...LoanSummaryBorrowerFields
        ...BorrowerProfileFields
        deals {
          id
        }
      }
      overview
      highlights {
        ...DealHighlightFields
      }
      details
      agreement
      dataroom
      defaultInterestRate
      transactionStructure {
        filename
        fileNameOverride
        alt
        url
        mimeType
      }
      creditMemos {
        ...CreditMemoFields
      }
      ...SupplyPanelDealFields
      ...RiskTableDealFields
    }
  }
`;

interface PoolPageProps {
  dealDetails: NonNullable<SingleDealQuery["Deal"]>;
}

const PoolPage: NextPageWithLayout<PoolPageProps> = ({
  dealDetails,
}: PoolPageProps) => {
  const { account } = useWallet();

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const borrower = dealDetails.borrower!;
  const otherPoolsFromThisBorrower = (borrower.deals || []).map(
    (deal) => deal.id
  );

  const { data, error } = useSingleTranchedPoolDataQuery({
    variables: {
      tranchedPoolId: dealDetails?.id as string,
      tranchedPoolAddress: dealDetails?.id as string,
      userId: account?.toLowerCase() ?? "",
      borrowerAllPools: otherPoolsFromThisBorrower,
    },
  });

  const tranchedPool = data?.loan;
  const seniorPool = data?.seniorPools?.[0];
  const user = data?.user ?? null;
  const fiatPerGfi = data?.gfiPrice.price.amount;

  if (error) {
    return (
      <div className="text-2xl">
        Unable to load the specified loan. {error.message}
      </div>
    );
  }

  const fundingStatus = tranchedPool
    ? getLoanFundingStatus(tranchedPool, data.currentBlock.timestamp)
    : null;

  // Spec for this logic: https://linear.app/goldfinch/issue/GFI-638/as-unverified-user-we-display-this-pool-is-only-for-non-us-persons
  let initialBannerContent = "";
  let expandedBannerContent = "";
  const poolSupportsUs =
    tranchedPool?.allowedUidTypes?.includes("US_ACCREDITED_INDIVIDUAL") ||
    tranchedPool?.allowedUidTypes?.includes("US_ENTITY");
  const noUid = !user?.uidType;
  const uidIsUs =
    user?.uidType === "US_ACCREDITED_INDIVIDUAL" ||
    user?.uidType === "US_ENTITY" ||
    user?.uidType === "US_NON_ACCREDITED_INDIVIDUAL";
  const uidIsNonUs =
    user?.uidType === "NON_US_ENTITY" || user?.uidType === "NON_US_INDIVIDUAL";
  if (poolSupportsUs && noUid) {
    initialBannerContent =
      "This offering is only available to non-U.S. persons or U.S. accredited investors.";
    expandedBannerContent =
      "Eligibility to participate in this offering is determined by your (i) investor accreditation status and (ii) your residency. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, and may not be offered or sold to a U.S. person that is not an accredited investor, absent registration or an applicable exemption from the registration requirements. Log in with your address and claim your UID to see if you're eligible to participate.";
  } else if (poolSupportsUs && uidIsUs) {
    initialBannerContent =
      "This offering is only available to U.S. accredited investors.";
    expandedBannerContent =
      "This offering is only available to U.S. accredited investors. This offering has not been registered under the U.S. Securities Act of 1933 (”Securities Act”), as amended, or under the securities laws of certain states. This offering may not be offered, sold or otherwise transferred, pledged or hypothecated except as permitted under the Securities Act and applicable state securities laws pursuant to an effective registration statement or an exemption therefrom.";
  } else if (poolSupportsUs && uidIsNonUs) {
    initialBannerContent =
      "This offering is only available to non-U.S. persons.";
    expandedBannerContent =
      "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements.";
  } else if (!poolSupportsUs) {
    initialBannerContent =
      "This offering is only available to non-U.S. persons.";
    expandedBannerContent =
      "This offering is only available to non-U.S. persons. This offering has not been registered under the U.S. Securities Act of 1933 (“Securities Act”), as amended, and may not be offered or sold in the United States or to a U.S. person (as defined in Regulation S promulgated under the Securities Act) absent registration or an applicable exemption from the registration requirements.";
  }

  return (
    <>
      <SEO title={dealDetails.name} />

      {initialBannerContent && expandedBannerContent ? (
        <BannerPortal>
          <Banner
            initialContent={initialBannerContent}
            expandedContent={expandedBannerContent}
          />
        </BannerPortal>
      ) : null}

      <div className="pool-layout">
        <div style={{ gridArea: "info" }}>
          <ScrollingSectionedContainer
            sections={[
              {
                navTitle: "Overview",
                title: "Overview",
                content: !tranchedPool ? (
                  <div className="h-60 rounded-xl border border-sand-200" />
                ) : fundingStatus === LoanFundingStatus.Open ? (
                  <FundingStats
                    loan={tranchedPool}
                    deal={dealDetails}
                    currentBlockTimestamp={data.currentBlock.timestamp}
                  />
                ) : (
                  <AmountStats loan={tranchedPool} />
                ),
              },
              ...(dealDetails.highlights && dealDetails.highlights.length > 0
                ? [
                    {
                      navTitle: "Highlights",
                      title: "Highlights",
                      content: (
                        <DealHighlights highlights={dealDetails.highlights} />
                      ),
                    },
                  ]
                : []),
              ...(dealDetails.creditMemos && dealDetails.creditMemos.length > 0
                ? [
                    {
                      navTitle: "Analysis",
                      title: "Analysis",
                      subtitle:
                        "Analysis and summary of this deal completed by independent credit experts",
                      content: dealDetails.creditMemos.map((creditMemo) => (
                        <CreditMemoAnalysisCard
                          key={creditMemo.id}
                          creditMemo={creditMemo}
                          className="mb-1.5"
                        />
                      )),
                    },
                  ]
                : []),
              {
                navTitle: "Repayment",
                title: "Repayment terms",
                content: (
                  <div className="space-y-6">
                    {tranchedPool ? (
                      <>
                        <RepaymentTermsStats loan={tranchedPool} />
                        <RepaymentTermsSchedule
                          loan={tranchedPool}
                          repaymentStatus={getLoanRepaymentStatus(tranchedPool)}
                          currentBlockTimestamp={data.currentBlock.timestamp}
                        />
                      </>
                    ) : (
                      <>
                        <RepaymentTermsStatsPlaceholder />
                        <RepaymentTermsSchedulePlaceholder />
                      </>
                    )}
                  </div>
                ),
              },
              {
                navTitle: "Borrower",
                title: "Borrower details",
                content: (
                  <BorrowerProfile
                    borrower={borrower}
                    borrowerAllPools={data?.borrowerAllPools ?? []}
                    currentPoolAddress={tranchedPool?.id ?? ""}
                  />
                ),
              },
              {
                navTitle: "Risk",
                title: "Risk mitigation",
                subtitle:
                  "Information on deal structure, collateral used to secure this loan, and options in the case of a default on repayment by the borrower",
                content:
                  dealDetails && tranchedPool ? (
                    <RiskTable deal={dealDetails} loan={tranchedPool} />
                  ) : (
                    <div className="h-96" />
                  ),
              },
            ]}
            navAddons={
              dealDetails.dataroom
                ? [{ text: "Dataroom", href: dealDetails.dataroom }]
                : undefined
            }
          />

          <h2 className="mb-6 font-semibold">Recent activity</h2>
          {tranchedPool ? (
            <TransactionTable loanAddress={tranchedPool.id} />
          ) : null}
        </div>

        <div className="flex flex-col" style={{ gridArea: "widgets" }}>
          <BacktoOpenDealsButton />

          <AdaptiveStickyContainer>
            <div
              className={clsx(
                "divide-y divide-mustard-200 self-stretch rounded-3xl border [&>*]:p-5 [&>*]:lg:p-10",
                fundingStatus === LoanFundingStatus.Closed
                  ? "border-sand-200 bg-white"
                  : "border-transparent bg-mustard-100"
              )}
            >
              {tranchedPool && seniorPool && fiatPerGfi ? (
                <>
                  <LoanSummary
                    loan={tranchedPool}
                    deal={dealDetails}
                    borrower={borrower}
                    fiatPerGfi={fiatPerGfi}
                  />
                  {fundingStatus === LoanFundingStatus.Open ||
                  fundingStatus === LoanFundingStatus.Cancelled ? (
                    <InvestAndWithdrawTabs
                      tranchedPool={tranchedPool}
                      user={user}
                      deal={dealDetails}
                      poolTokens={user?.poolTokens ?? []}
                    />
                  ) : fundingStatus === LoanFundingStatus.Closed &&
                    user &&
                    (user.poolTokens.length > 0 ||
                      user.vaultedPoolTokens.length > 0) ? (
                    <ClaimPanel
                      poolTokens={user.poolTokens}
                      vaultedPoolTokens={user.vaultedPoolTokens}
                      fiatPerGfi={fiatPerGfi}
                      loan={tranchedPool}
                    />
                  ) : fundingStatus === LoanFundingStatus.ComingSoon ? (
                    <ComingSoonPanel fundableAt={tranchedPool?.fundableAt} />
                  ) : null}
                </>
              ) : (
                <LoanSummaryPlaceholder />
              )}
            </div>
          </AdaptiveStickyContainer>
        </div>
      </div>
    </>
  );
};

PoolPage.layout = "mustard-background";

export default PoolPage;

interface StaticParams extends ParsedUrlQuery {
  address: string;
}

const allDealsQuery = gql`
  query AllDeals @api(name: cms) {
    Deals(limit: 100) {
      docs {
        id
      }
    }
  }
`;

export const getStaticPaths: GetStaticPaths<StaticParams> = async () => {
  const res = await apolloClient.query<AllDealsQuery>({
    query: allDealsQuery,
  });

  const paths =
    res.data.Deals?.docs?.map((pool) => ({
      params: {
        address: pool?.id || "",
      },
    })) || [];

  return {
    paths,
    fallback: "blocking",
  };
};

export const getStaticProps: GetStaticProps<
  PoolPageProps,
  StaticParams
> = async (context) => {
  const address = context.params?.address;
  if (!address) {
    throw new Error("No address param in getStaticProps");
  }
  const res = await apolloClient.query<
    SingleDealQuery,
    SingleDealQueryVariables
  >({
    query: SingleDealDocument,
    variables: {
      id: address.toLowerCase(),
    },
    fetchPolicy: "network-only",
  });

  const poolDetails = res.data.Deal;
  if (!poolDetails) {
    return { notFound: true };
  }

  return {
    props: {
      dealDetails: poolDetails,
    },
  };
};
