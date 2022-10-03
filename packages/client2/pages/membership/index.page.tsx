import { gql } from "@apollo/client";
import { useState } from "react";

import { Button, Heading } from "@/components/design-system";
import { SEO } from "@/components/seo";
import { useMembershipPageQuery } from "@/lib/graphql/generated";
import { gfiToUsdc, sharesToUsdc } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import { Asset, AssetGroup } from "./asset-group";
import { Explainer } from "./explainer";

gql`
  query MembershipPage($userId: String!) {
    seniorPools {
      id
      latestPoolStatus {
        id
        sharePrice
      }
    }
    viewer @client {
      gfiBalance {
        token
        amount
      }
    }
    gfiPrice(fiat: USD) @client {
      price {
        amount
        symbol
      }
    }
    seniorPoolStakedPositions(
      where: { user: $userId, amount_gt: 0, positionType: Fidu }
      orderBy: startTime
      orderDirection: desc
    ) {
      id
      amount
    }
    tranchedPoolTokens(
      where: { user: $userId, principalAmount_gt: 0 }
      orderBy: mintedAt
      orderDirection: desc
    ) {
      id
      principalAmount
      tranchedPool {
        id
        name @client
      }
    }
  }
`;

export default function MembershipPage() {
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const { account } = useWallet();
  const { data, loading, error } = useMembershipPageQuery({
    variables: { userId: account?.toLocaleLowerCase() ?? "" },
    skip: !account,
  });

  const vaultableAssets: Asset[] = [];
  if (
    data &&
    data.viewer.gfiBalance &&
    !data.viewer.gfiBalance?.amount.isZero()
  ) {
    vaultableAssets.push({
      name: "GFI",
      description: "Goldfinch tokens",
      tooltip:
        "Your GFI tokens. These can be placed in the membership vault and they increase your rewards.",
      dollarValue: gfiToUsdc(data.viewer.gfiBalance, data.gfiPrice.price.amount)
        .amount,
    });
  }

  if (data && data.seniorPoolStakedPositions.length > 0) {
    const sharePrice = data.seniorPools[0].latestPoolStatus.sharePrice;
    data.seniorPoolStakedPositions.forEach((seniorPoolStakedPosition) => {
      vaultableAssets.push({
        name: "Senior Pool Position",
        description: "FIDU",
        tooltip: "Lorem ipsum",
        dollarValue: sharesToUsdc(seniorPoolStakedPosition.amount, sharePrice)
          .amount,
      });
    });
  }

  if (data && data.tranchedPoolTokens.length > 0) {
    data.tranchedPoolTokens.forEach((poolToken) => {
      vaultableAssets.push({
        name: "Backer Pool Position",
        description: poolToken.tranchedPool.name,
        tooltip: "Lorem ipsum",
        dollarValue: poolToken.principalAmount,
      });
    });
  }

  const vaultedAssets: Asset[] = [];

  return (
    <div>
      <SEO title="Membership" />
      <div className="mb-12 flex flex-wrap items-center justify-between gap-4">
        <Heading level={1}>Membership</Heading>
        <Button
          variant="rounded"
          colorScheme="secondary"
          iconRight="ArrowTopRight"
          onClick={() => setIsExplainerOpen(true)}
        >
          How does it work?
        </Button>
      </div>

      <Explainer
        isOpen={isExplainerOpen}
        onClose={() => setIsExplainerOpen(false)}
      />

      {!account && !loading ? (
        <div>You must connect your wallet to view your membership vault</div>
      ) : error ? (
        <div className="text-clay-500">Error: {error.message}</div>
      ) : !data || loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <div className="mb-16">Chart goes here</div>
          <div>
            <h2 className="mb-10 text-4xl">Vault</h2>
            <div className="flex flex-col items-start justify-between gap-10 lg:flex-row">
              <AssetGroup
                heading="Available assets"
                assets={vaultableAssets}
                background="sand"
                className="lg:w-1/2"
                buttonText="Add to vault"
                onButtonClick={() => alert("unimplemented")}
                hideButton={vaultableAssets.length === 0}
              />
              <AssetGroup
                heading="Assets in vault"
                assets={vaultedAssets}
                background="gold"
                className="lg:w-1/2"
                buttonText="Remove from vault"
                onButtonClick={() => alert("unimplemented")}
                hideButton={vaultedAssets.length === 0}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
