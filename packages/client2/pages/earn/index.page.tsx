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
  const { data, loading, error } = useExampleQuery();
  const seniorPool = data?.seniorPools[0];
  const tranchedPools = data?.tranchedPools.filter(
    (tranchedPool) => tranchedPool.name !== null
  );

  return (
    <div>
      <Heading level={1} className="mb-4">
        Pools
      </Heading>
      <Paragraph className="mb-12">Lorem ipsum</Paragraph>
      <Heading level={2} className="mb-4">
        Senior Pool
      </Heading>
      <div>
        {error ? (
          "Unable to load senior pool"
        ) : !seniorPool ? (
          "Loading"
        ) : (
          <PoolCard
            title={seniorPool.name}
            subtitle={seniorPool.category}
            icon={seniorPool.icon}
            href="/pools/senior"
          />
        )}
      </div>
      <Heading level={2} className="mb-4">
        Borrower Pools
      </Heading>
      <Paragraph className="mb-8">
        The more active, higher risk, higher return option. Earn higher APYs by
        vetting borrowers and supplying first-loss capital directly to
        individual pools.
      </Paragraph>
      {error ? (
        "Unable to load borrower pools"
      ) : loading ? (
        "Loading"
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
      <Paragraph className="mb-12">
        This is the Earn page, AKA the home page of the app
      </Paragraph>
      <Heading level={2}>Example Data</Heading>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
