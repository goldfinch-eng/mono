import { gql } from "@apollo/client";
import { GetStaticProps, InferGetStaticPropsType } from "next";

import { Heading, HelperText, Paragraph } from "@/components/design-system";
import { formatPercent } from "@/lib/format";
import { apolloClient } from "@/lib/graphql/apollo";
import {
  useEarnPageQuery,
  EarnPageCmsQuery,
  TranchedPoolCardDealFieldsFragment,
} from "@/lib/graphql/generated";
import {
  computeApyFromGfiInFiat,
  getTranchedPoolStatus,
  PoolStatus,
} from "@/lib/pools";
import {
  GoldfinchPoolsMetrics,
  TRANCHED_POOL_ROSTERS_METRICS_FIELDS,
} from "@/pages/earn/goldfinch-pools-metrics";
import {
  OpenDealCard,
  OpenDealCardPlaceholder,
} from "@/pages/earn/open-deal-card";

import {
  PoolCard,
  PoolCardPlaceholder,
  TranchedPoolCard,
  TRANCHED_POOL_CARD_FIELDS,
  TRANCHED_POOL_CARD_DEAL_FIELDS,
} from "./pool-card";

gql`
  ${TRANCHED_POOL_CARD_FIELDS}
  ${TRANCHED_POOL_ROSTERS_METRICS_FIELDS}
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
    tranchedPools(orderBy: createdAt, orderDirection: desc) {
      id
      ...TranchedPoolCardFields
    }
    tranchedPoolRosters(first: 1) {
      id
      totalDrawdowns
      totalWritedowns
      totalReserveCollected
      totalInterestCollected
      totalPrincipalCollected
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
  ${TRANCHED_POOL_CARD_DEAL_FIELDS}
  query EarnPageCMS @api(name: cms) {
    Deals(limit: 100, where: { hidden: { not_equals: true } }) {
      docs {
        ...TranchedPoolCardDealFields
      }
    }
  }
`;

export default function EarnPage({
  dealMetadata,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { data, error } = useEarnPageQuery();

  const seniorPool = data?.seniorPools?.[0]?.estimatedApy
    ? data.seniorPools[0]
    : undefined;
  // Only display tranched pools for which we have deal metadata
  const tranchedPools = data?.tranchedPools?.filter(
    (tranchedPool) => !!dealMetadata[tranchedPool.id]
  );

  const tranchedPoolRoster = data?.tranchedPoolRosters?.[0];

  const fiatPerGfi = data?.gfiPrice?.price.amount;

  const openTranchedPools = tranchedPools?.filter(
    (tranchedPool) => getTranchedPoolStatus(tranchedPool) === PoolStatus.Open
  );
  // const closedTranchedPools = tranchedPools?.filter(
  //   (tranchedPool) => getTranchedPoolStatus(tranchedPool) !== PoolStatus.Open
  // );

  // + 1 for Senior Pool
  const openDealsCount = openTranchedPools ? openTranchedPools?.length + 1 : 0;

  return (
    <div>
      <Heading
        as="h1"
        level={2}
        className="mb-12 text-center !text-5xl md:!text-6xl lg:text-left"
      >
        Deals
      </Heading>
      {error ? (
        <HelperText isError className="mb-12">
          There was a problem fetching data on pools. Shown data may be
          outdated.
        </HelperText>
      ) : null}
      <div className="mb-15">
        {!seniorPool || !fiatPerGfi || !tranchedPools || !tranchedPoolRoster ? (
          <div>
            <div className="invisible mb-6 font-medium text-sand-700">
              Loading
            </div>
            <div className="mb-20 grid gap-5 xs:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <OpenDealCardPlaceholder />
              <OpenDealCardPlaceholder />
              <OpenDealCardPlaceholder />
            </div>
          </div>
        ) : (
          <div>
            {/* Goldfinch Pools metrics */}
            <div className="mb-6 font-medium text-sand-700">
              Goldfinch Pools metrics
            </div>
            <GoldfinchPoolsMetrics
              className="mb-20"
              tranchedPoolRoster={tranchedPoolRoster}
            />

            {/* Open Pools */}
            <div className="mb-6 font-medium text-sand-700">
              {`${openDealsCount} Open Deals`}
            </div>
            <div className="mb-20 grid gap-5 xs:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              <OpenDealCard
                owner="Goldfinch"
                icon={seniorPool.icon}
                title={seniorPool.name}
                description={
                  "Auto-diversified across the entire portfolio of Goldfinch direct lending pools. Request withdrawal of investment any time; withdrawal requests fulfilled on a 2 week-rolling window basis."
                }
                apy={seniorPool.estimatedApy}
                gfiApy={computeApyFromGfiInFiat(
                  seniorPool.estimatedApyFromGfiRaw,
                  fiatPerGfi
                )}
              />
              {openTranchedPools?.map((tranchedPool) => {
                const dealDetails = dealMetadata[
                  tranchedPool.id
                ] as TranchedPoolCardDealFieldsFragment;

                const tranchedPoolApyFromGfi = computeApyFromGfiInFiat(
                  tranchedPool.estimatedJuniorApyFromGfiRaw,
                  fiatPerGfi
                );

                const seniorPoolApyFromGfi = computeApyFromGfiInFiat(
                  seniorPool.estimatedApyFromGfiRaw,
                  fiatPerGfi
                );

                const apyFromGfi =
                  tranchedPool.estimatedJuniorApyFromGfiRaw.isZero()
                    ? tranchedPool.estimatedJuniorApyFromGfiRaw
                    : tranchedPoolApyFromGfi.addUnsafe(seniorPoolApyFromGfi);

                // TODO: better way to do this? Convert days to months
                const termLengthInMonths = Math.floor(
                  tranchedPool.creditLine.termInDays.toNumber() / 30
                );

                return (
                  <OpenDealCard
                    key={tranchedPool.id}
                    owner={dealDetails?.borrower?.name}
                    icon={dealDetails?.borrower?.logo?.url}
                    title={dealDetails?.name}
                    description={
                      "Auto-diversified across the entire portfolio of Goldfinch direct lending pools. Request withdrawal of investment any time; withdrawal requests fulfilled on a 2 week-rolling window basis."
                    }
                    apy={tranchedPool.estimatedJuniorApy}
                    gfiApy={apyFromGfi}
                    termLengthInMonths={termLengthInMonths}
                    dealType={dealDetails?.dealType}
                  />
                );
              })}
            </div>

            {/* Tranched Pools */}
            <PoolCard
              title={seniorPool.name}
              subtitle={seniorPool.category}
              icon={seniorPool.icon}
              apy={seniorPool.estimatedApy}
              apyWithGfi={seniorPool.estimatedApy.addUnsafe(
                computeApyFromGfiInFiat(
                  seniorPool.estimatedApyFromGfiRaw,
                  fiatPerGfi
                )
              )}
              apyTooltipContent={
                <div>
                  <div className="mb-4">
                    The Senior Pool&apos;s total current estimated APY,
                    including the current USDC APY and est. GFI rewards APY.
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <div>Senior Pool APY</div>
                      <div>{formatPercent(seniorPool.estimatedApy)}</div>
                    </div>
                    <div className="flex justify-between">
                      <div>GFI Distribution APY</div>
                      <div>
                        {formatPercent(
                          computeApyFromGfiInFiat(
                            seniorPool.estimatedApyFromGfiRaw,
                            fiatPerGfi
                          )
                        )}
                      </div>
                    </div>
                    <hr className="my-3 border-t border-sand-300" />
                    <div className="flex justify-between">
                      <div>Total Est. APY</div>
                      <div>
                        {formatPercent(
                          seniorPool.estimatedApy.addUnsafe(
                            computeApyFromGfiInFiat(
                              seniorPool.estimatedApyFromGfiRaw,
                              fiatPerGfi
                            )
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              }
              href="/pools/senior"
              poolStatus={PoolStatus.Open}
            />
          </div>
        )}
      </div>
      <Heading level={2} className="mb-3 !font-serif !text-[2.5rem] !font-bold">
        Borrower Pools
      </Heading>
      <Paragraph className="mb-8 !text-lg">
        The more active option for higher yields. Earn higher APYs by vetting
        Borrowers and supplying first-loss capital directly to individual Pools.
      </Paragraph>
      <div className="flex flex-col space-y-4">
        {seniorPool && tranchedPools && fiatPerGfi
          ? tranchedPools.map((tranchedPool) => (
              <TranchedPoolCard
                key={tranchedPool.id}
                details={dealMetadata[tranchedPool.id]}
                tranchedPool={tranchedPool}
                href={`/pools/${tranchedPool.id}`}
                fiatPerGfi={fiatPerGfi}
                seniorPoolApyFromGfiRaw={seniorPool.estimatedApyFromGfiRaw}
              />
            ))
          : !tranchedPools
          ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((nonce) => (
              <PoolCardPlaceholder key={nonce} />
            ))
          : null}
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async () => {
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
