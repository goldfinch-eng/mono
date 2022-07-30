import { gql } from "@apollo/client";
import { useMemo } from "react";

import { Heading, Stat, StatGrid } from "@/components/design-system";
import { useGfiPageQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import {
  GrantCard,
  GRANT_CARD_GRANT_FIELDS,
  GRANT_CARD_TOKEN_FIELDS,
  GrantWithToken,
} from "./grant-card";

gql`
  ${GRANT_CARD_GRANT_FIELDS}
  ${GRANT_CARD_TOKEN_FIELDS}

  query GfiPage($userId: String!) {
    viewer @client {
      gfiGrants {
        ...GrantCardGrantFields
      }
    }
    communityRewardsTokens(where: { user: $userId }) {
      ...GrantCardTokenFields
    }
  }
`;

export default function GfiPage() {
  const { account } = useWallet();
  const { data } = useGfiPageQuery({
    variables: {
      userId: account ? account.toLowerCase() : "",
    },
    skip: !account,
  });

  const grantsWithTokens = useMemo(() => {
    if (data?.viewer.gfiGrants && data?.communityRewardsTokens) {
      const gfiGrants = data.viewer.gfiGrants;
      const communityRewardsTokens = data.communityRewardsTokens;
      const grantsWithTokens: GrantWithToken[] = [];
      for (const g of gfiGrants) {
        const correspondingToken = communityRewardsTokens.find(
          (token) =>
            token.source.toString() === g.source.toString() &&
            token.index === g.index
        );
        if (correspondingToken) {
          grantsWithTokens.push({ ...g, token: correspondingToken });
        } else {
          grantsWithTokens.push({ ...g });
        }
      }
      return grantsWithTokens;
    }
  }, [data]);

  return (
    <div>
      <Heading level={1} className="mb-12 text-7xl">
        GFI
      </Heading>
      {!account ? (
        <div>You must connect your wallet to view GFI rewards</div>
      ) : (
        <div>
          <StatGrid className="mb-15">
            <Stat
              label="Total GFI (Claimable + Locked)"
              value="420.69 GFI ($999)"
              tooltip="Lorem ipsum"
            />
            <Stat label="Claimable GFI" value="0.04 GFI" />
            <Stat label="Locked GFI" value="0 GFI" />
          </StatGrid>
          <div
            className="mb-3 grid px-6 text-sand-500"
            style={{
              gridTemplateColumns: "40% 20% 20% 20%",
              alignItems: "center",
            }}
          >
            <div>Type</div>
            <div className="justify-self-end">Locked GFI</div>
            <div className="justify-self-end">Claimable GFI</div>
            <div></div>
          </div>
          <div className="space-y-3">
            {grantsWithTokens?.map((g, index) => (
              <GrantCard key={index} grant={g} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
