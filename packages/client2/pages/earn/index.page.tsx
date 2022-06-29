import { gql } from "@apollo/client";

import { Heading, HelperText, Paragraph } from "@/components/design-system";
import { formatPercent } from "@/lib/format";
import { useEarnPageQuery } from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat, PoolStatus } from "@/lib/pools";

import {
  PoolCard,
  PoolCardPlaceholder,
  TranchedPoolCard,
  TRANCHED_POOL_CARD_FIELDS,
} from "./pool-card";

gql`
  ${TRANCHED_POOL_CARD_FIELDS}
  query EarnPage {
    seniorPools(first: 1) {
      id
      name @client
      category @client
      icon @client
      latestPoolStatus {
        id
        estimatedApy
        estimatedApyFromGfiRaw
        sharePrice
      }
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
      fiduBalance {
        token
        amount
      }
    }
  }
`;

export default function EarnPage() {
  const { data, error } = useEarnPageQuery();

  const seniorPool = data?.seniorPools?.[0]?.latestPoolStatus?.estimatedApy
    ? data.seniorPools[0]
    : undefined;
  const tranchedPools = data?.tranchedPools?.filter(
    (tranchedPool) => tranchedPool.name !== null
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
            apy={seniorPool.latestPoolStatus.estimatedApy}
            apyWithGfi={seniorPool.latestPoolStatus.estimatedApy.addUnsafe(
              computeApyFromGfiInFiat(
                seniorPool.latestPoolStatus.estimatedApyFromGfiRaw,
                fiatPerGfi
              )
            )}
            apyTooltipContent={
              <div>
                <div className="mb-4">
                  The Senior Pool&apos;s total current estimated APY, including
                  the current USDC APY and est. GFI rewards APY.
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div>Senior Pool APY</div>
                    <div>
                      {formatPercent(seniorPool.latestPoolStatus.estimatedApy)}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <div>GFI Distribution APY</div>
                    <div>
                      {formatPercent(
                        computeApyFromGfiInFiat(
                          seniorPool.latestPoolStatus.estimatedApyFromGfiRaw,
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
                        seniorPool.latestPoolStatus.estimatedApy.addUnsafe(
                          computeApyFromGfiInFiat(
                            seniorPool.latestPoolStatus.estimatedApyFromGfiRaw,
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
                tranchedPool={tranchedPool}
                href={`/pools/${tranchedPool.id}`}
                fiatPerGfi={fiatPerGfi}
                seniorPoolApyFromGfiRaw={
                  seniorPool.latestPoolStatus.estimatedApyFromGfiRaw
                }
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
