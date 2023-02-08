import { gql } from "@apollo/client";
import { GetStaticProps, InferGetStaticPropsType } from "next";

import {
  Heading,
  HelperText,
  Link,
  Paragraph,
} from "@/components/design-system";
import { formatPercent } from "@/lib/format";
import { apolloClient } from "@/lib/graphql/apollo";
import { useEarnPageQuery, EarnPageCmsQuery } from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat, PoolStatus } from "@/lib/pools";

import {
  PoolCard,
  PoolCardPlaceholder,
  TranchedPoolCard,
  TRANCHED_POOL_CARD_FIELDS,
  TRANCHED_POOL_CARD_DEAL_FIELDS,
} from "./pool-card";

gql`
  ${TRANCHED_POOL_CARD_FIELDS}
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
  const fiatPerGfi = data?.gfiPrice?.price.amount;

  return (
    <div>
      <Heading
        as="h1"
        level={2}
        className="mb-12 text-center !text-5xl md:!text-6xl lg:text-left"
      >
        Pools
      </Heading>
      {error ? (
        <HelperText isError className="mb-12">
          There was a problem fetching data on pools. Shown data may be
          outdated.
        </HelperText>
      ) : null}
      <Heading
        as="h2"
        level={4}
        className="mb-3 !font-serif !text-[2.5rem] !font-bold"
      >
        Senior Pool
      </Heading>
      <Paragraph className="mb-8 !text-lg">
        The simple option for automatically diversified yields. Capital is
        distributed across Borrower Pools, and is protected by Backer capital
        for lower-risk investment.
      </Paragraph>
      <div className="mb-15">
        {!seniorPool || !fiatPerGfi ? (
          <PoolCardPlaceholder />
        ) : (
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
                  The Senior Pool&rsquo;s total current estimated APY, including
                  the current USDC APY and est. GFI rewards APY. The GFI rewards
                  APY is volatile and changes based on several variables
                  including the price of GFI, the total capital deployed on
                  Goldfinch, and Senior Pool&rsquo;s utilization. Learn more in
                  the{" "}
                  <Link
                    href="https://docs.goldfinch.finance/goldfinch/protocol-mechanics/investor-incentives/senior-pool-liquidity-mining)"
                    openInNewTab
                  >
                    Goldfinch Documentation
                  </Link>
                  .
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
