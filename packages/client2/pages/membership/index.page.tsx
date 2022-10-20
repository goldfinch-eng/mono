import { gql } from "@apollo/client";
import clsx from "clsx";
import { BigNumber } from "ethers";
import { useState } from "react";

import {
  Button,
  Heading,
  Icon,
  IconNameType,
} from "@/components/design-system";
import { SEO } from "@/components/seo";
import {
  SupportedCrypto,
  useMembershipPageQuery,
} from "@/lib/graphql/generated";
import { gfiToUsdc, sharesToUsdc } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import { AddToVault } from "./add-to-vault";
import { AssetGroup } from "./asset-group";
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

  const vaultableAssets: AssetGroup[] = [];
  if (
    data &&
    data.viewer.gfiBalance &&
    !data.viewer.gfiBalance?.amount.isZero()
  ) {
    vaultableAssets.push({
      groupName: "GFI",
      assets: [
        {
          name: "GFI",
          description: "Goldfinch tokens",
          tooltip:
            "Your GFI tokens. These can be placed in the membership vault and they increase your rewards.",
          usdcAmount: gfiToUsdc(
            data.viewer.gfiBalance,
            data.gfiPrice.price.amount
          ),
          nativeAmount: data.viewer.gfiBalance,
        },
      ],
    });
  }

  const tvlAssetGroup: AssetGroup = {
    groupName: "TVL",
    assets: [],
  };
  const sharePrice =
    data?.seniorPools[0].latestPoolStatus.sharePrice ?? BigNumber.from(0);
  if (data && data.seniorPoolStakedPositions.length > 0) {
    data.seniorPoolStakedPositions.forEach((seniorPoolStakedPosition) => {
      tvlAssetGroup.assets.push({
        name: "Senior Pool Position",
        description: "FIDU",
        tooltip: "Lorem ipsum",
        usdcAmount: sharesToUsdc(seniorPoolStakedPosition.amount, sharePrice),
        nativeAmount: {
          token: SupportedCrypto.Fidu,
          amount: seniorPoolStakedPosition.amount,
        },
      });
    });
  }

  if (data && data.tranchedPoolTokens.length > 0) {
    data.tranchedPoolTokens.forEach((poolToken) => {
      tvlAssetGroup.assets.push({
        name: "Backer Pool Position",
        description: poolToken.tranchedPool.name,
        tooltip: "Lorem ipsum",
        usdcAmount: {
          token: SupportedCrypto.Usdc,
          amount: poolToken.principalAmount,
        },
      });
    });
  }
  vaultableAssets.push(tvlAssetGroup);

  const [isAddToVaultOpen, setIsAddToVaultOpen] = useState(false);

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
            <div className="flex flex-col items-stretch justify-between gap-10 lg:flex-row lg:items-start">
              <div className="space-y-8 lg:w-1/2">
                <AssetGroup
                  heading="Available assets"
                  assetGroups={vaultableAssets}
                  background="sand"
                  buttonText="Select assets to add"
                  onButtonClick={() => setIsAddToVaultOpen(true)}
                  hideButton={vaultableAssets.length === 0}
                />
                <div className="rounded-xl border border-sand-200 bg-sand-100 p-5">
                  <div className="mb-3 flex items-center gap-2 text-lg font-medium">
                    <Icon name="LightningBolt" className="text-mustard-400" />
                    Balanced is best
                  </div>
                  <div className="mb-6">
                    To optimize Member rewards, aim to have balanced amounts of
                    TVL and GFI in your vault at all times.
                  </div>
                  <div className="space-y-2">
                    <CallToAction
                      mainText="Buy GFI"
                      icon="Gfi"
                      buttonText="Buy now"
                      href="https://coinmarketcap.com/currencies/goldfinch-protocol/markets/"
                    />
                    <CallToAction
                      mainText="LP in the Senior Pool for FIDU"
                      buttonText="Invest"
                      href="/pools/senior"
                    />
                  </div>
                </div>
              </div>

              <AssetGroup
                heading="Assets in vault"
                assetGroups={[]}
                background="gold"
                className="lg:w-1/2"
                buttonText="Remove from vault"
                onButtonClick={() => alert("unimplemented")}
                hideButton
              />
            </div>
            <AddToVault
              isOpen={isAddToVaultOpen}
              onClose={() => setIsAddToVaultOpen(false)}
              maxVaultableGfi={
                data.viewer.gfiBalance ?? {
                  token: SupportedCrypto.Gfi,
                  amount: BigNumber.from(0),
                }
              }
              fiatPerGfi={data.gfiPrice.price.amount}
              vaultablePoolTokens={data.tranchedPoolTokens}
              vaultableStakedPositions={data.seniorPoolStakedPositions}
              sharePrice={sharePrice}
            />
          </div>
        </>
      )}
    </div>
  );
}

function CallToAction({
  className,
  mainText,
  icon,
  buttonText,
  href,
}: {
  className?: string;
  mainText: string;
  icon?: IconNameType;
  buttonText: string;
  href: string;
}) {
  const isExternal = href.startsWith("http");
  return (
    <div
      className={clsx(
        className,
        "flex items-center justify-between rounded-lg border border-sand-200 bg-white p-4"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="text-lg">{mainText}</div>
        {icon ? <Icon name={icon} size="md" /> : null}
      </div>
      <Button
        colorScheme="mustard"
        variant="rounded"
        size="lg"
        as="a"
        href={href}
        rel={isExternal ? "noopener noreferrer" : undefined}
        target={isExternal ? "_blank" : undefined}
        iconRight={isExternal ? "ArrowTopRight" : "ArrowSmRight"}
      >
        {buttonText}
      </Button>
    </div>
  );
}
