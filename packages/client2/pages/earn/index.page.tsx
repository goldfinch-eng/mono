import { gql, NetworkStatus } from "@apollo/client";
import { InferGetStaticPropsType } from "next";

import { Button, HelperText, Link } from "@/components/design-system";
import { apolloClient } from "@/lib/graphql/apollo";
import { useEarnPageQuery, EarnPageCmsQuery } from "@/lib/graphql/generated";
import {
  computeApyFromGfiInFiat,
  getLoanFundingStatus,
  getLoanRepaymentStatus,
  LoanFundingStatus,
} from "@/lib/pools";
import {
  GoldfinchPoolsMetrics,
  GoldfinchPoolsMetricsPlaceholder,
} from "@/pages/earn/goldfinch-pools-metrics";
import {
  OpenDealCard,
  OpenDealCardPlaceholder,
} from "@/pages/earn/open-deal-card";

import { ClosedDealCard, ClosedDealCardPlaceholder } from "./closed-deal-card";

gql`
  query EarnPage($numClosedPools: Int!) {
    seniorPools(first: 1) {
      id
      name @client
      category @client
      icon @client
      estimatedApy
      estimatedApyFromGfiRaw
      sharePrice
    }
    openPools: loans(
      orderBy: createdAt
      orderDirection: desc
      where: { termStartTime: 0 }
    ) {
      __typename
      id
      usdcApy
      rawGfiApy
      termInSeconds
      ...FundingStatusLoanFields
    }
    closedPools: loans(
      orderBy: createdAt
      orderDirection: desc
      where: { termStartTime_not: 0 }
      first: $numClosedPools
    ) {
      id
      principalAmount
      termEndTime
      ...RepaymentStatusLoanFields
    }
    protocols(first: 1) {
      id
      numLoans
      ...ProtocolMetricsFields
    }
    gfiPrice(fiat: USD) @client {
      lastUpdated
      price {
        amount
        symbol
      }
    }
    viewer @client {
      fiduBalance
    }
    currentBlock @client {
      timestamp
    }
  }
`;

const earnCmsQuery = gql`
  query EarnPageCMS @api(name: cms) {
    Deals(limit: 100, where: { hidden: { not_equals: true } }) {
      docs {
        id
        name
        category
        dealType
        borrower {
          id
          name
          logo {
            url
          }
        }
      }
    }
  }
`;

export default function EarnPage({
  dealMetadata,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { data, error, networkStatus, fetchMore } = useEarnPageQuery({
    variables: { numClosedPools: 3 },
    notifyOnNetworkStatusChange: true,
  });

  const seniorPool = data?.seniorPools?.[0]?.estimatedApy
    ? data.seniorPools[0]
    : undefined;

  const protocol = data?.protocols[0];
  const numLoans = protocol?.numLoans ?? 0;

  const fiatPerGfi = data?.gfiPrice?.price.amount;

  const openLoans =
    data?.openPools.filter(
      (tranchedPool) =>
        (!!dealMetadata[tranchedPool.id] &&
          getLoanFundingStatus(tranchedPool, data.currentBlock.timestamp) ===
            LoanFundingStatus.Open) ||
        getLoanFundingStatus(tranchedPool, data.currentBlock.timestamp) ===
          LoanFundingStatus.ComingSoon
    ) ?? [];
  const closedLoans = data?.closedPools ?? [];

  // +1 for Senior Pool
  const openDealsCount = openLoans ? openLoans.length + 1 : 0;

  const loading = !seniorPool || !fiatPerGfi || !protocol;

  return (
    <div>
      {error ? (
        <HelperText isError className="mb-12">
          There was a problem fetching data on pools. Shown data may be
          outdated. {error.message}
        </HelperText>
      ) : null}
      {loading ? (
        <>
          <GoldfinchPoolsMetricsPlaceholder className="mb-20" />
          <EarnPageHeading>Open Deals</EarnPageHeading>
          <div className="mb-15 grid gap-5 xs:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <OpenDealCardPlaceholder key={i} />
            ))}
          </div>
          <EarnPageHeading>Closed Deals</EarnPageHeading>
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <ClosedDealCardPlaceholder key={i} />
            ))}
          </div>
        </>
      ) : (
        <>
          <GoldfinchPoolsMetrics protocol={protocol} className="mb-20" />
          <EarnPageHeading>
            {`${openDealsCount} Open Deal${openDealsCount > 1 ? "s" : ""}`}
          </EarnPageHeading>
          <div className="mb-15 grid gap-5 xs:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {openLoans?.map((loan) => {
              const dealDetails = dealMetadata[loan.id];

              const loanApyFromGfi = computeApyFromGfiInFiat(
                loan.rawGfiApy,
                fiatPerGfi
              );

              return (
                <OpenDealCard
                  key={loan.id}
                  icon={dealDetails.borrower.logo?.url}
                  title={dealDetails.name}
                  subtitle={dealDetails.category}
                  usdcApy={loan.usdcApy}
                  gfiApy={loanApyFromGfi}
                  gfiApyTooltip={
                    <div>
                      <div className="mb-4">
                        The Pool&rsquo;s total current estimated APY, including
                        the current USDC APY and est. GFI rewards APY. The GFI
                        rewards APY is volatile and changes based on several
                        variables including the price of GFI, the total capital
                        deployed on Goldfinch, and Senior Pool&rsquo;s
                        utilization. Learn more in the{" "}
                        <Link
                          href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/investor-incentives/backer-incentives"
                          openInNewTab
                        >
                          Goldfinch Documentation
                        </Link>
                        .
                      </div>
                    </div>
                  }
                  termLengthInMs={loan.termInSeconds * 1000}
                  liquidity={
                    loan.__typename === "TranchedPool"
                      ? "End of loan term"
                      : "Callable loan"
                  }
                  href={`/pools/${loan.id}`}
                />
              );
            })}

            <OpenDealCard
              icon={seniorPool.icon}
              title={seniorPool.name}
              subtitle={seniorPool.category}
              usdcApy={seniorPool.estimatedApy}
              gfiApy={computeApyFromGfiInFiat(
                seniorPool.estimatedApyFromGfiRaw,
                fiatPerGfi
              )}
              gfiApyTooltip={
                <div className="mb-4">
                  The Senior Pool&rsquo;s total current estimated APY, including
                  the current USDC APY and est. GFI rewards APY. The GFI rewards
                  APY is volatile and changes based on several variables
                  including the price of GFI, the total capital deployed on
                  Goldfinch, and Senior Pool&rsquo;s utilization. Learn more in
                  the{" "}
                  <Link
                    href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/investor-incentives/senior-pool-liquidity-mining"
                    openInNewTab
                  >
                    Goldfinch Documentation
                  </Link>
                  .
                </div>
              }
              liquidity="2 week withdraw requests"
              href="/pools/senior"
            />
          </div>

          <EarnPageHeading>{`${
            protocol.numLoans - data.openPools.length
          } Closed Deals`}</EarnPageHeading>
          <div className="space-y-2">
            {closedLoans.map((loan) => {
              const deal = dealMetadata[loan.id];
              const repaymentStatus = getLoanRepaymentStatus(loan);
              return (
                deal && (
                  <ClosedDealCard
                    key={loan.id}
                    borrowerName={deal.borrower.name}
                    icon={deal.borrower.logo?.url}
                    dealName={deal.name}
                    loanAmount={loan.principalAmount}
                    termEndTime={loan.termEndTime}
                    repaymentStatus={repaymentStatus}
                    href={`/pools/${loan.id}`}
                  />
                )
              );
            })}
          </div>
          {data.openPools.length + data.closedPools.length < numLoans ? (
            <Button
              onClick={() => fetchMore({ variables: { numClosedPools: 1000 } })}
              className="mt-2 w-full"
              colorScheme="sand"
              size="lg"
              isLoading={networkStatus === NetworkStatus.fetchMore}
            >
              {`View ${
                numLoans - data.openPools.length - data.closedPools.length
              } more closed pools`}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

export const getStaticProps = async () => {
  const res = await apolloClient.query<EarnPageCmsQuery>({
    query: earnCmsQuery,
    fetchPolicy: "network-only",
  });

  const deals = res.data.Deals?.docs;
  if (!deals) {
    throw new Error("No metadata found for any deals");
  }

  // This type is a crime against humanity. Blame PayloadCMS for having way too many nullable fields in the schema (https://github.com/payloadcms/payload/issues/1148)
  const dealMetadata: Record<
    string,
    NonNullable<
      NonNullable<NonNullable<EarnPageCmsQuery["Deals"]>["docs"]>[number]
    >
  > = {};
  deals.forEach((d) => {
    if (d && d.id) {
      dealMetadata[d.id] = d;
    }
  });

  return {
    props: {
      dealMetadata,
    },
  };
};

function EarnPageHeading({ children }: { children: string }) {
  return <div className="mb-6 font-medium">{children}</div>;
}
