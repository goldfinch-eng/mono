import { gql } from "@apollo/client";
import { useEffect, useState } from "react";

import { Heading, Stat, StatGrid } from "@/components/design-system";
import { GrantWithSource, GrantWithToken } from "@/lib/gfi-rewards";
import { useGfiPageQuery } from "@/lib/graphql/generated";
import { useWallet } from "@/lib/wallet";

import { GrantCard } from "./grant-card";

gql`
  query GfiPage($userId: ID!) {
    user(id: $userId) {
      id
      communityRewardsTokens {
        id
        index
        source
        totalGranted
        totalClaimed
        vestingInterval
        cliffLength
        grantedAt
        revokedAt
      }
    }
  }
`;

export default function GfiPage() {
  const { account } = useWallet();
  const [unacceptedGrants, setUnacceptedGrants] = useState<GrantWithSource[]>();
  const { data } = useGfiPageQuery({
    variables: { userId: account ? account.toLowerCase() : "" },
    skip: !account,
  });
  const [hydratedGrants, setHydratedGrants] = useState<GrantWithToken[]>();

  useEffect(() => {
    if (!account) {
      return;
    }
    const asyncEffect = async () => {
      const response = await fetch(`/api/gfi-grants?account=${account}`);
      const body = await response.json();
      setUnacceptedGrants(body.matchingGrants);
    };
    asyncEffect();
  }, [account]);

  useEffect(() => {
    if (unacceptedGrants && data?.user?.communityRewardsTokens) {
      const communityRewardsTokens = data.user.communityRewardsTokens;
      const hydratedGrants: GrantWithToken[] = [];
      for (const g of unacceptedGrants) {
        const correspondingToken = communityRewardsTokens.find(
          (token) => token.source === g.source && token.index === g.index
        );
        if (correspondingToken) {
          hydratedGrants.push({ ...g, token: correspondingToken });
        } else {
          hydratedGrants.push({ ...g });
        }
      }
      setHydratedGrants(hydratedGrants);
    }
  }, [unacceptedGrants, data]);

  return (
    <div>
      <Heading level={1} className="mb-12 text-7xl">
        GFI
      </Heading>
      {!account ? (
        <div>You must connect your wallet to view GFI rewards</div>
      ) : (
        <div>
          <StatGrid>
            <Stat
              label="Total GFI (Claimable + Locked)"
              value="420.69 GFI ($999)"
              tooltip="Lorem ipsum"
            />
            <Stat label="Claimable GFI" value="0.04 GFI" />
            <Stat label="Locked GFI" value="0 GFI" />
          </StatGrid>
          <div>
            {hydratedGrants?.map((g, index) => (
              <GrantCard key={index} grant={g} />
            ))}
          </div>
          <pre>{JSON.stringify(unacceptedGrants, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
