import { gql } from "@apollo/client";

import { Heading, HelperText, Paragraph } from "@/components/design-system";
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
        estimatedApy
        estimatedApyFromGfiRaw
        estimatedApyFromGfi @client
        tranchedPools {
          id
          ...TranchedPoolCardFields
        }
      }
    }
    tranchedPools(orderBy: createdAt, orderDirection: desc) {
      id
      ...TranchedPoolCardFields
    }
    gfi @client {
      price {
        usd
      }
    }
  }
`;

export default function EarnPage() {
  const { data, error } = useExampleQuery();
  const seniorPool = data?.seniorPools[0];
  const tranchedPools = data?.tranchedPools.filter(
    (tranchedPool) => tranchedPool.name !== null
  );

  return (
    <div>
      <Heading level={1} className="mb-4">
        Pools
      </Heading>
      <Paragraph className="mb-2">Lorem ipsum</Paragraph>
      {error ? (
        <HelperText isError className="mb-2">
          There was a problem fetching data on pools. Shown data may be
          outdated.
        </HelperText>
      ) : null}
      <Paragraph className="mb-12">
        Price of GFI: ${data?.gfi?.price.usd ?? ""}
      </Paragraph>
      <Heading level={2} className="mb-4">
        Senior Pool
      </Heading>
      <div className="mb-12">
        {!seniorPool ? (
          <PoolCard isPlaceholder />
        ) : (
          <PoolCard
            title={seniorPool.name}
            subtitle={seniorPool.category}
            icon={seniorPool.icon}
            apy={seniorPool.latestPoolStatus.estimatedApy}
            apyFromGfi={seniorPool.latestPoolStatus.estimatedApyFromGfi}
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
    </div>
  );
}
