import { ParsedUrlQuery } from "querystring";

import { gql } from "@apollo/client";
import { GetStaticPaths, GetStaticProps } from "next";
import NextLink from "next/link";

import {
  Button,
  Banner,
  ScrollingSectionedContainer,
} from "@/components/design-system";
import { BannerPortal } from "@/components/layout";
import { SEO } from "@/components/seo";
import { apolloClient } from "@/lib/graphql/apollo";
import {
  useSingleTranchedPoolDataQuery,
  SingleDealQuery,
  AllDealsQuery,
  SingleDealQueryVariables,
} from "@/lib/graphql/generated";
import {
  PoolStatus,
  getTranchedPoolStatus,
  TRANCHED_POOL_STATUS_FIELDS,
  getTranchedPoolFundingStatus,
  TranchedPoolFundingStatus,
} from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import {
  BORROWER_PROFILE_FIELDS,
  BORROWER_OTHER_POOL_FIELDS,
} from "./borrower-profile";
import { CMS_TEAM_MEMBER_FIELDS } from "./borrower-team";
import ComingSoonPanel from "./coming-soon-panel";
import { CREDIT_MEMO_FIELDS } from "./credit-memos";
import {
  SECURITIES_RECOURSE_TABLE_FIELDS,
  BORROWER_FINANCIALS_TABLE_FIELDS,
  BORROWER_PERFORMANCE_TABLE_FIELDS,
} from "./deal-tables";
import { DOCUMENT_FIELDS } from "./documents-list";
import RepaymentProgressPanel from "./repayment-progress-panel";
import { TRANCHED_POOL_STAT_GRID_FIELDS } from "./status-section";
import {
  ClaimPanel,
  CLAIM_PANEL_POOL_TOKEN_FIELDS,
} from "./v2-components/claim-panel";
import {
  InvestAndWithdrawTabs,
  SUPPLY_PANEL_USER_FIELDS,
  WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS,
} from "./v2-components/invest-and-withdraw-tabs";
import { LoanSummary } from "./v2-components/loan-summary";

gql`
  ${TRANCHED_POOL_STATUS_FIELDS}
  ${TRANCHED_POOL_STAT_GRID_FIELDS}
  ${SUPPLY_PANEL_USER_FIELDS}
  ${WITHDRAWAL_PANEL_POOL_TOKEN_FIELDS}
  ${CLAIM_PANEL_POOL_TOKEN_FIELDS}
  ${BORROWER_OTHER_POOL_FIELDS}
  query SingleTranchedPoolData(
    $tranchedPoolId: ID!
    $tranchedPoolAddress: String!
    $userId: ID!
    $borrowerOtherPools: [ID!]
  ) {
    tranchedPool(id: $tranchedPoolId) {
      id
      allowedUidTypes
      estimatedJuniorApy
      estimatedJuniorApyFromGfiRaw
      estimatedLeverageRatio
      fundableAt
      isPaused
      numBackers
      juniorTranches {
        lockedUntil
      }
      juniorDeposited
      creditLine {
        id
        limit
        maxLimit
        id
        isLate @client
        termInDays
        paymentPeriodInDays
        nextDueTime
        interestAprDecimal
        borrowerContract {
          id
        }
        lateFeeApr
      }
      initialInterestOwed
      principalAmountRepaid
      interestAmountRepaid
      ...TranchedPoolStatusFields
    }
    borrowerOtherPools: tranchedPools(
      where: { id_in: $borrowerOtherPools, id_not: $tranchedPoolId }
    ) {
      ...BorrowerOtherPoolFields
    }
    seniorPools(first: 1) {
      id
      estimatedApyFromGfiRaw
      sharePrice
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
      tranchedPoolTokens(where: { tranchedPool: $tranchedPoolAddress }) {
        ...WithdrawalPanelPoolTokenFields
        ...ClaimPanelPoolTokenFields
      }
      vaultedPoolTokens(where: { tranchedPool: $tranchedPoolAddress }) {
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

const singleDealQuery = gql`
  ${DOCUMENT_FIELDS}
  ${CMS_TEAM_MEMBER_FIELDS}
  ${SECURITIES_RECOURSE_TABLE_FIELDS}
  ${BORROWER_FINANCIALS_TABLE_FIELDS}
  ${BORROWER_PERFORMANCE_TABLE_FIELDS}
  ${BORROWER_PROFILE_FIELDS}
  ${CREDIT_MEMO_FIELDS}
  query SingleDeal($id: String!) @api(name: cms) {
    Deal(id: $id) {
      id
      name
      dealType
      category
      borrower {
        ...BorrowerProfileFields
      }
      overview
      details
      agreement
      dataroom
      securitiesAndRecourse {
        ...SecuritiesRecourseTableFields
      }
      defaultInterestRate
      transactionStructure {
        filename
        fileNameOverride
        alt
        url
        mimeType
      }
      documents {
        ...DocumentFields
      }
      creditMemos {
        ...CreditMemoFields
      }
    }
  }
`;

interface PoolPageProps {
  dealDetails: NonNullable<SingleDealQuery["Deal"]>;
}

export default function PoolPage({ dealDetails }: PoolPageProps) {
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
      borrowerOtherPools: otherPoolsFromThisBorrower,
    },
    returnPartialData: true,
  });

  const tranchedPool = data?.tranchedPool;
  const seniorPool = data?.seniorPools?.[0];
  const user = data?.user ?? null;
  const fiatPerGfi = data?.gfiPrice.price.amount;

  if (error) {
    return (
      <div className="text-2xl">
        Unable to load the specified tranched pool.
      </div>
    );
  }

  const poolStatus = tranchedPool ? getTranchedPoolStatus(tranchedPool) : null;
  const fundingStatus = tranchedPool
    ? getTranchedPoolFundingStatus(tranchedPool)
    : null;

  // Spec for this logic: https://linear.app/goldfinch/issue/GFI-638/as-unverified-user-we-display-this-pool-is-only-for-non-us-persons
  let initialBannerContent = "";
  let expandedBannerContent = "";
  const poolSupportsUs =
    tranchedPool?.allowedUidTypes.includes("US_ACCREDITED_INDIVIDUAL") ||
    tranchedPool?.allowedUidTypes.includes("US_ENTITY");
  const noUid =
    !user?.isNonUsEntity &&
    !user?.isNonUsIndividual &&
    !user?.isUsAccreditedIndividual &&
    !user?.isUsEntity &&
    !user?.isUsNonAccreditedIndividual;
  const uidIsUs =
    user?.isUsAccreditedIndividual ||
    user?.isUsEntity ||
    user?.isUsNonAccreditedIndividual;
  const uidIsNonUs = user?.isNonUsEntity || user?.isNonUsIndividual;
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
                content: <div className="h-80" />,
              },
              {
                navTitle: "Highlights",
                title: "Highlights",
                content: <div className="h-80" />,
              },
              {
                navTitle: "Analysis",
                title: "Analysis",
                content: <div className="h-80" />,
              },
              {
                navTitle: "Repayment",
                title: "Repayment terms",
                content: <div className="h-80" />,
              },
              {
                navTitle: "Borrower",
                title: "Borrower details",
                content: <div className="h-80" />,
              },
              {
                navTitle: "Risk",
                title: "Risk mitigation",
                content: <div className="h-80" />,
              },
            ]}
            navAddons={
              dealDetails.dataroom
                ? [{ text: "Dataroom", href: dealDetails.dataroom }]
                : undefined
            }
          />
        </div>

        <div className="flex flex-col" style={{ gridArea: "widgets" }}>
          <NextLink href="/earn" passHref>
            <Button
              as="a"
              variant="rounded"
              size="lg"
              colorScheme="secondary"
              iconLeft="ArrowLeft"
              className="mb-10 self-start"
            >
              Back to Open Deals
            </Button>
          </NextLink>

          <div className="relative flex grow flex-col">
            {/* This spacer exists to force the rest of the content to the bottom of the widget div. This allows sticky + bottom to work as intended */}
            <div className="grow" />
            <div className="sticky bottom-2">
              <div className="self-stretch rounded-3xl bg-mustard-100">
                {tranchedPool && seniorPool && fiatPerGfi ? (
                  <>
                    <div className="p-5 lg:p-10">
                      <LoanSummary
                        loan={tranchedPool}
                        deal={dealDetails}
                        seniorPoolEstimatedApyFromGfiRaw={
                          seniorPool.estimatedApyFromGfiRaw
                        }
                        fiatPerGfi={fiatPerGfi}
                      />
                    </div>
                    {fundingStatus === TranchedPoolFundingStatus.Open ||
                    fundingStatus === TranchedPoolFundingStatus.Cancelled ? (
                      <div className="border-t border-mustard-200 p-5 lg:p-10">
                        <InvestAndWithdrawTabs
                          tranchedPool={tranchedPool}
                          user={user}
                          deal={dealDetails}
                          poolTokens={user?.tranchedPoolTokens ?? []}
                        />
                      </div>
                    ) : fundingStatus === TranchedPoolFundingStatus.Closed &&
                      user &&
                      (user.tranchedPoolTokens.length > 0 ||
                        user.vaultedPoolTokens.length > 0) ? (
                      <div className="border-t border-mustard-200 p-5 lg:p-10">
                        <ClaimPanel
                          poolTokens={user.tranchedPoolTokens}
                          vaultedPoolTokens={user.vaultedPoolTokens}
                          fiatPerGfi={fiatPerGfi}
                          tranchedPool={tranchedPool}
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {tranchedPool && seniorPool && fiatPerGfi ? (
            <div className="flex flex-col items-stretch gap-8">
              {tranchedPool &&
              (poolStatus === PoolStatus.Full ||
                poolStatus === PoolStatus.Repaid) ? (
                <RepaymentProgressPanel
                  poolStatus={poolStatus}
                  tranchedPool={tranchedPool}
                  userPoolTokens={user?.tranchedPoolTokens ?? []}
                />
              ) : null}

              {poolStatus === PoolStatus.ComingSoon ? (
                <ComingSoonPanel fundableAt={tranchedPool?.fundableAt} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

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
    query: singleDealQuery,
    variables: {
      id: address,
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
