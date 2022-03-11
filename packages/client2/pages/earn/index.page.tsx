import { gql } from "@apollo/client";

import { Heading, Paragraph } from "@/components/typography";
import { useExampleQuery } from "@/lib/graphql/generated";

import {
  PoolCard,
  TranchedPoolCard,
  TRANCHED_POOL_CARD_FIELDS,
} from "./pool-card";

gql`
  ${TRANCHED_POOL_CARD_FIELDS}
  query Example {
    seniorPools(first: 1) {
      id
      name @client
      category @client
      icon @client
      latestPoolStatus {
        id
        totalPoolAssets
        estimatedApy
        tranchedPools {
          id
          ...TranchedPoolCardFields
        }
      }
    }
    tranchedPools {
      id
      ...TranchedPoolCardFields
    }
  }
`;

export default function EarnPage() {
  const { data, error } = useExampleQuery();
  const seniorPool = data?.seniorPools[0];
  const tranchedPools = data?.tranchedPools.filter(
    (tranchedPool) => tranchedPool.name !== null
  );

  // Proves these values are being parsed as the correct type
  // eslint-disable-next-line no-console
  console.log(seniorPool?.latestPoolStatus.estimatedApy);
  // eslint-disable-next-line no-console
  console.log(seniorPool?.latestPoolStatus.totalPoolAssets);

  return (
    <div>
      <Heading level={1} className="mb-4">
        Pools
      </Heading>
      <Paragraph className="mb-12">Lorem ipsum</Paragraph>
      <Heading level={2} className="mb-4">
        Senior Pool
      </Heading>
      <div className="mb-12">
        {error ? (
          "Unable to load senior pool"
        ) : !seniorPool ? (
          <PoolCard isPlaceholder />
        ) : (
          <PoolCard
            title={seniorPool.name}
            subtitle={seniorPool.category}
            icon={seniorPool.icon}
            apy={seniorPool.latestPoolStatus.estimatedApy}
            apyWithGfi={0.9999} // TODO this is a placeholder until senior pool APY from GFI is available
            href="/pools/senior"
          />
        )}
      </div>
      <Heading level={2} className="mb-4">
        Borrower Pools
      </Heading>
      <Paragraph className="mb-4">
        The more active, higher risk, higher return option. Earn higher APYs by
        vetting borrowers and supplying first-loss capital directly to
        individual pools.
      </Paragraph>
      {error ? (
        "Unable to load borrower pools"
      ) : (
        <div className="flex flex-col space-y-4">
          {!tranchedPools ? (
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((nonce) => (
              <PoolCard key={nonce} isPlaceholder />
            ))
          ) : (
            <div className="flex flex-col space-y-4">
              {tranchedPools?.map((tranchedPool) => (
                <TranchedPoolCard
                  key={tranchedPool.id}
                  tranchedPool={tranchedPool}
                  href={`/pools/${tranchedPool.id}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
