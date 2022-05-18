import { gql } from "@apollo/client";

import { Heading, HelperText, Paragraph } from "@/components/design-system";
import { useExampleQuery } from "@/lib/graphql/generated";
import { computeApyFromGfiInFiat } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import {
  PoolCard,
  TranchedPoolCard,
  TRANCHED_POOL_CARD_FIELDS,
} from "./pool-card";
import { Portfolio } from "./portfolio";

gql`
  ${TRANCHED_POOL_CARD_FIELDS}
  query Example($userAccount: String!) {
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
      backers(where: { user: $userAccount }) {
        id
        balance
      }
    }
    gfiPrice(fiat: USD) @client {
      lastUpdated
      price {
        amount
        symbol
      }
    }
    user(id: $userAccount) {
      id
      seniorPoolDeposits {
        amount
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
  const { account } = useWallet();
  const { data, error } = useExampleQuery({
    variables: { userAccount: account?.toLowerCase() ?? "" },
    returnPartialData: true, // PATTERN: allow partial data so when this query re-runs due to `account` being populated, it doesn't wipe out the existing data
  });

  const seniorPool = data?.seniorPools[0];
  const tranchedPools = data?.tranchedPools.filter(
    (tranchedPool) => tranchedPool.name !== null
  );
  const fiatPerGfi = data?.gfiPrice.price.amount;

  return (
    <div className="grid grid-cols-12 gap-10">
      <div className="col-span-8">
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
          Price of GFI: ${fiatPerGfi ?? ""}
        </Paragraph>
        <Heading level={2} className="mb-4">
          Senior Pool
        </Heading>
        <div className="mb-12">
          {!seniorPool || !fiatPerGfi ? (
            <PoolCard isPlaceholder />
          ) : (
            <PoolCard
              title={seniorPool.name}
              subtitle={seniorPool.category}
              icon={seniorPool.icon}
              apy={seniorPool.latestPoolStatus.estimatedApy}
              apyFromGfi={computeApyFromGfiInFiat(
                seniorPool.latestPoolStatus.estimatedApyFromGfiRaw,
                fiatPerGfi
              )}
              href="/pools/senior"
            />
          )}
        </div>
        <Heading level={2} className="mb-4">
          Borrower Pools
        </Heading>
        <Paragraph className="mb-4">
          The more active, higher risk, higher return option. Earn higher APYs
          by vetting borrowers and supplying first-loss capital directly to
          individual pools.
        </Paragraph>
        <div className="flex flex-col space-y-4">
          {!tranchedPools ? (
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((nonce) => (
              <PoolCard key={nonce} isPlaceholder />
            ))
          ) : (
            <div className="flex flex-col space-y-4">
              {tranchedPools && fiatPerGfi
                ? tranchedPools.map((tranchedPool) => (
                    <TranchedPoolCard
                      key={tranchedPool.id}
                      tranchedPool={tranchedPool}
                      href={`/pools/${tranchedPool.id}`}
                      fiatPerGfi={fiatPerGfi}
                    />
                  ))
                : null}
            </div>
          )}
        </div>
      </div>
      <div className="relative col-span-4">
        <div className="sticky top-12 space-y-8">
          {seniorPool ? (
            <Portfolio
              fiduBalance={data?.viewer.fiduBalance ?? undefined}
              seniorPoolSharePrice={seniorPool.latestPoolStatus.sharePrice}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
