import { gql } from "@apollo/client";
import { InferGetStaticPropsType } from "next";
import { useState } from "react";

import { Button, HelperText, Link } from "@/components/design-system";
import { formatPercent } from "@/lib/format";
import { apolloClient } from "@/lib/graphql/apollo";
import { useEarnPageQuery, EarnPageCmsQuery } from "@/lib/graphql/generated";
import {
  computeApyFromGfiInFiat,
  FUNDING_STATUS_LOAN_FIELDS,
  getLoanFundingStatus,
  getLoanRepaymentStatus,
  LoanFundingStatus,
  REPAYMENT_STATUS_LOAN_FIELDS,
} from "@/lib/pools";
import {
  GoldfinchPoolsMetrics,
  GoldfinchPoolsMetricsPlaceholder,
  PROTOCOL_METRICS_FIELDS,
} from "@/pages/earn/goldfinch-pools-metrics";
import {
  OpenDealCard,
  OpenDealCardPlaceholder,
} from "@/pages/earn/open-deal-card";

import { ClosedDealCard, ClosedDealCardPlaceholder } from "./closed-deal-card";

const visiblePoolOnFirstLoad = 4;

gql`
  ${PROTOCOL_METRICS_FIELDS}
  ${FUNDING_STATUS_LOAN_FIELDS}
  ${REPAYMENT_STATUS_LOAN_FIELDS}
  query EarnPage {
    seniorPools(first: 1) {
      id
      name @client
      category @client
      icon @client
      estimatedApy
      estimatedApyFromGfiRaw
      sharePrice
    }
    loans(orderBy: createdAt, orderDirection: desc) {
      id
      usdcApy
      rawGfiApy
      principalAmount
      termInDays
      termEndTime
      ...FundingStatusLoanFields
      ...RepaymentStatusLoanFields
    }
    protocols(first: 1) {
      id
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
  const { data, error } = useEarnPageQuery();

  const [showMoreClosedPools, setShowMoreClosedPools] = useState(false);

  const seniorPool = data?.seniorPools?.[0]?.estimatedApy
    ? data.seniorPools[0]
    : undefined;
  // Only display loans for which we have deal metadata
  const loans = data?.loans?.filter((loan) => !!dealMetadata[loan.id]);

  const protocol = data?.protocols[0];

  const fiatPerGfi = data?.gfiPrice?.price.amount;

  const openLoans =
    loans?.filter(
      (loan) => getLoanFundingStatus(loan) === LoanFundingStatus.Open
    ) ?? [];
  const closedLoans =
    loans?.filter(
      (loan) =>
        getLoanFundingStatus(loan) === LoanFundingStatus.Closed ||
        getLoanFundingStatus(loan) === LoanFundingStatus.Full
    ) ?? [];

  // +1 for Senior Pool
  const openDealsCount = openLoans ? openLoans.length + 1 : 0;

  const loading = !seniorPool || !fiatPerGfi || !loans || !protocol;

  return (
    <div>
      {error ? (
        <HelperText isError className="mb-12">
          There was a problem fetching data on pools. Shown data may be
          outdated.
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
            {openLoans?.map((loan) => {
              const dealDetails = dealMetadata[loan.id];

              const loanApyFromGfi = computeApyFromGfiInFiat(
                loan.rawGfiApy,
                fiatPerGfi
              );

              const seniorPoolApyFromGfi = computeApyFromGfiInFiat(
                seniorPool.estimatedApyFromGfiRaw,
                fiatPerGfi
              );

              const apyFromGfi = loan.rawGfiApy.isZero()
                ? loan.rawGfiApy
                : loanApyFromGfi.addUnsafe(seniorPoolApyFromGfi);

              const termLengthInMonths = Math.floor(loan.termInDays / 30);

              return (
                <OpenDealCard
                  key={loan.id}
                  icon={dealDetails.borrower.logo?.url}
                  title={dealDetails.name}
                  subtitle={dealDetails.category}
                  usdcApy={loan.usdcApy}
                  gfiApy={apyFromGfi}
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
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div>Backer liquidity mining GFI APY</div>
                          <div>{formatPercent(loanApyFromGfi)}</div>
                        </div>
                        <div className="flex justify-between">
                          <div>LP rewards match GFI APY</div>
                          <div>
                            {formatPercent(
                              loan.rawGfiApy.isZero() ? 0 : seniorPoolApyFromGfi
                            )}
                          </div>
                        </div>
                        <hr className="border-t border-sand-300" />
                        <div className="flex justify-between">
                          <div>Total Est. APY</div>
                          <div>{formatPercent(apyFromGfi)}</div>
                        </div>
                      </div>
                    </div>
                  }
                  termLengthInMonths={termLengthInMonths}
                  liquidity="End of loan term"
                  href={`/pools/${loan.id}`}
                />
              );
            })}
          </div>

          <EarnPageHeading>{`${closedLoans.length} Closed Deals`}</EarnPageHeading>
          <div className="space-y-2">
            {closedLoans.map((loan, i) => {
              const deal = dealMetadata[loan.id];
              const repaymentStatus = getLoanRepaymentStatus(loan);
              return (
                <ClosedDealCard
                  key={loan.id}
                  // For SEO purposes, using invisible to hide pools but keep them in DOM before user clicks "view more pools"
                  className={
                    !showMoreClosedPools && i >= visiblePoolOnFirstLoad
                      ? "hidden"
                      : undefined
                  }
                  borrowerName={deal.borrower.name}
                  icon={deal.borrower.logo?.url}
                  dealName={deal.name}
                  loanAmount={loan.principalAmount}
                  termEndTime={loan.termEndTime}
                  repaymentStatus={repaymentStatus}
                  href={`/pools/${loan.id}`}
                />
              );
            })}
          </div>
          {!showMoreClosedPools && closedLoans?.length > 4 && (
            <Button
              onClick={() => setShowMoreClosedPools(true)}
              className="mt-2 w-full"
              colorScheme="sand"
              size="lg"
            >
              {`View ${closedLoans?.length - 4} more closed pools`}
            </Button>
          )}
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
