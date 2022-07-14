import { useEffect, useState } from "react";

import { Heading, Stat, StatGrid } from "@/components/design-system";
import { GrantWithSource } from "@/lib/gfi-rewards";
import { useWallet } from "@/lib/wallet";

import { GrantCard } from "./grant-card";

export default function GfiPage() {
  const { account } = useWallet();
  const [userGrants, setUserGrants] = useState<GrantWithSource[]>([]);
  useEffect(() => {
    if (!account) {
      return;
    }
    const asyncEffect = async () => {
      const response = await fetch(`/api/gfi-grants?account=${account}`);
      const body = await response.json();
      setUserGrants(body.matchingGrants);
    };
    asyncEffect();
  }, [account]);
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
            {userGrants.map((g, index) => (
              <GrantCard key={index} grant={g} />
            ))}
          </div>
          <pre>{JSON.stringify(userGrants, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
