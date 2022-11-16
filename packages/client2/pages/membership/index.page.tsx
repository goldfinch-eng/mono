import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState } from "react";

import { Button, Heading, Link } from "@/components/design-system";
import { SEO } from "@/components/seo";
import { formatCrypto } from "@/lib/format";
import {
  SupportedCrypto,
  useMembershipPageQuery,
} from "@/lib/graphql/generated";
import { gfiToUsdc, sharesToUsdc, sum } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import { AddToVault } from "./add-to-vault";
import {
  AssetBox,
  Asset,
  AssetBoxPlaceholder,
  POOL_TOKEN_FIELDS_FOR_ASSETS,
  convertPoolTokenToAsset,
} from "./asset-box";
import {
  AssetGroup,
  AssetGroupSubheading,
  AssetGroupButton,
} from "./asset-group";
import { BuyGfiCta, LpInSeniorPoolCta, BalancedIsBest } from "./ctas";
import { Explainer } from "./explainer";
import {
  RemoveFromVault,
  VAULTED_GFI_FIELDS,
  VAULTED_STAKED_POSITION_FIELDS,
  VAULTED_POOL_TOKEN_FIELDS,
} from "./remove-from-vault";
import { RewardClaimer } from "./reward-claimer";
import {
  CHART_DISBURSEMENT_FIELDS,
  YourRewards,
  YourRewardsPlaceholder,
} from "./your-rewards";

gql`
  ${VAULTED_GFI_FIELDS}
  ${VAULTED_STAKED_POSITION_FIELDS}
  ${VAULTED_POOL_TOKEN_FIELDS}
  ${CHART_DISBURSEMENT_FIELDS}
  ${POOL_TOKEN_FIELDS_FOR_ASSETS}
  query MembershipPage($userId: String!) {
    seniorPools {
      id
      latestPoolStatus {
        id
        sharePrice
      }
    }
    viewer @client(always: true) {
      gfiBalance {
        token
        amount
      }
      fiduBalance {
        token
        amount
      }
      claimableMembershipRewards {
        token
        amount
      }
      accruedMembershipRewardsThisEpoch {
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
      ...PoolTokenFieldsForAssets
    }

    currentBlock @client {
      timestamp
    }

    vaultedGfis(where: { user: $userId, amount_gt: 0 }) {
      id
      amount
      ...VaultedGfiFields
    }
    vaultedStakedPositions(where: { user: $userId }) {
      id
      ...VaultedStakedPositionFields
    }
    vaultedPoolTokens(where: { user: $userId }) {
      id
      ...VaultedPoolTokenFields
    }

    membershipRewardDisbursements(
      where: { user: $userId }
      orderBy: epoch
      orderDirection: asc
    ) {
      id
      ...ChartDisbursementFields
    }

    memberships(where: { user: $userId }) {
      id
      eligibleScore
      nextEpochScore
    }
  }
`;

export default function MembershipPage() {
  const [isExplainerOpen, setIsExplainerOpen] = useState(false);
  const { account, isActivating } = useWallet();
  const { data, loading, error } = useMembershipPageQuery({
    variables: { userId: account?.toLocaleLowerCase() ?? "" },
    skip: !account,
  });
  const showLoadingState = isActivating || loading || !data;
  const userHasVaultPosition =
    data &&
    (data.vaultedGfis.length > 0 ||
      data.vaultedPoolTokens.length > 0 ||
      data.vaultedStakedPositions.length > 0);
  const userHasDepositedForNextEpoch =
    data?.memberships?.[0] &&
    data.memberships[0].nextEpochScore.gt(data.memberships[0].eligibleScore);

  const vaultableCapitalAssets: Asset[] = [];
  const sharePrice =
    data?.seniorPools[0].latestPoolStatus.sharePrice ?? BigNumber.from(0);
  if (data && data.seniorPoolStakedPositions.length > 0) {
    data.seniorPoolStakedPositions.forEach((seniorPoolStakedPosition) => {
      vaultableCapitalAssets.push({
        name: "Staked FIDU",
        description: "Goldfinch Senior Pool Position",
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
      if (
        !poolToken.principalAmount.sub(poolToken.principalRedeemed).isZero()
      ) {
        vaultableCapitalAssets.push(convertPoolTokenToAsset(poolToken));
      }
    });
  }

  const [isAddToVaultOpen, setIsAddToVaultOpen] = useState(false);

  const vaultedGfi = {
    token: SupportedCrypto.Gfi,
    amount: sum("amount", data?.vaultedGfis),
  };

  const [isRemoveFromVaultOpen, setIsRemoveFromVaultOpen] = useState(false);

  const additionDisabled =
    (userHasVaultPosition &&
      data.viewer.gfiBalance?.amount.isZero() &&
      vaultableCapitalAssets.length === 0) ||
    (!userHasVaultPosition &&
      (data?.viewer.gfiBalance?.amount.isZero() ||
        vaultableCapitalAssets.length === 0));

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

      {error ? (
        <div className="text-clay-500">Error: {error.message}</div>
      ) : !account && !isActivating ? (
        <div>You must connect your wallet to view your membership vault</div>
      ) : (
        <>
          {data?.viewer.claimableMembershipRewards &&
          !data.viewer.claimableMembershipRewards.amount.isZero() ? (
            <RewardClaimer
              sharePrice={sharePrice}
              className="mb-4"
              claimable={data.viewer.claimableMembershipRewards}
            />
          ) : null}
          {showLoadingState ? (
            <YourRewardsPlaceholder className="mb-16" />
          ) : data.viewer.accruedMembershipRewardsThisEpoch &&
            userHasVaultPosition ? (
            <YourRewards
              className="mb-16"
              disbursements={data.membershipRewardDisbursements}
              currentBlockTimestamp={data.currentBlock.timestamp}
              sharePrice={sharePrice}
              accruedThisEpoch={data.viewer.accruedMembershipRewardsThisEpoch}
              showNextEpochNotice={userHasDepositedForNextEpoch}
            />
          ) : null}
          {!userHasVaultPosition ? (
            <div
              className="mb-16 rounded-lg border border-sand-200 p-8"
              style={{ aspectRatio: "2272 / 752" }}
            >
              <h2 className="mb-10 text-2xl">
                How it works: Goldfinch Membership Vaults
              </h2>
              <video autoPlay muted loop>
                <source
                  src="/membership/intro-animation.mp4"
                  type="video/mp4"
                />
              </video>
              <div className="flex flex-col justify-evenly gap-5 text-center lg:flex-row">
                <div className="lg:w-1/4">
                  <div className="mb-3 text-lg font-medium">
                    Deposit GFI and Capital
                  </div>
                  <div>
                    Put both GFI and Capital (FIDU, Backer NFT) in the Vault to
                    become a Member. You can withdraw from the Vault at any
                    time.
                  </div>
                </div>
                <div className="lg:w-1/4">
                  <div className="mb-3 text-lg font-medium">
                    Receive Boosted Yields
                  </div>
                  <div>
                    Enhance your yields with Member Rewards, a percentage of the
                    Goldfinch Treasury distributed pro-rata based on your Member
                    Vault position.
                  </div>
                </div>
                <div className="lg:w-1/4">
                  <div className="mb-3 text-lg font-medium">
                    Claim Rewards Weekly
                  </div>
                  <div>
                    Member Rewards are distributed weekly in FIDU, increasing
                    your exposure to the Senior Pool. Withdrawing during a
                    weekly cycle will forfeit rewards for that cycle.
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <div>
            <h2 className="mb-10 text-4xl">Vault</h2>
            <div className="flex flex-col items-stretch justify-between gap-10 lg:flex-row lg:items-start">
              <div className="space-y-4 lg:w-1/2">
                <BalancedIsBest />
                <AssetGroup headingLeft="Available assets">
                  {showLoadingState ? (
                    [0, 1, 2].map((nonce) => (
                      <AssetBoxPlaceholder key={nonce} />
                    ))
                  ) : (
                    <div>
                      {data.viewer.gfiBalance?.amount.isZero() &&
                      vaultableCapitalAssets.length === 0 ? (
                        <div className="mb-6">
                          <div className="mb-1 text-lg font-medium">
                            You don&apos;t have any available assets to be added
                          </div>
                          <div className="text-sm">
                            To optimize Member rewards, aim to have balanced
                            amounts of GFI and Capital in your Vault at all
                            times.
                          </div>
                        </div>
                      ) : null}
                      <div className="mb-4">
                        <AssetGroupSubheading
                          left="GFI"
                          right={
                            data.viewer.gfiBalance
                              ? formatCrypto(data.viewer.gfiBalance)
                              : undefined
                          }
                        />
                        {data.viewer.gfiBalance ? (
                          data.viewer.gfiBalance.amount.isZero() ? (
                            <BuyGfiCta />
                          ) : (
                            <AssetBox
                              nativeAmountIsPrimary
                              asset={{
                                name: "GFI",
                                icon: "Gfi",
                                description: "Governance Token",
                                usdcAmount: gfiToUsdc(
                                  data.viewer.gfiBalance,
                                  data.gfiPrice.price.amount
                                ),
                                nativeAmount: data.viewer.gfiBalance,
                              }}
                            />
                          )
                        ) : null}
                      </div>
                      <div className="mb-4">
                        <AssetGroupSubheading
                          left="Capital"
                          right={formatCrypto({
                            token: SupportedCrypto.Usdc,
                            amount: vaultableCapitalAssets.reduce(
                              (prev, current) =>
                                prev.add(current.usdcAmount.amount),
                              BigNumber.from(0)
                            ),
                          })}
                        />
                        <div className="space-y-2">
                          {vaultableCapitalAssets.length === 0 ? (
                            <LpInSeniorPoolCta />
                          ) : (
                            vaultableCapitalAssets.map((asset, index) => (
                              <AssetBox
                                key={`capital-${index}`}
                                asset={asset}
                              />
                            ))
                          )}
                          {data?.viewer.fiduBalance &&
                          !data.viewer.fiduBalance.amount.isZero() ? (
                            <AssetBox
                              asset={{
                                name: "Unstaked FIDU",
                                description: "Goldfinch Senior Pool Position",
                                nativeAmount: data.viewer.fiduBalance,
                                usdcAmount: sharesToUsdc(
                                  data.viewer.fiduBalance.amount,
                                  sharePrice
                                ),
                              }}
                              notice={
                                <div className="flex items-center justify-between gap-2 text-left">
                                  <div className="whitespace-nowrap">
                                    FIDU must be staked before it can be added
                                    to the Vault.
                                  </div>
                                  <Link
                                    href="/stake"
                                    iconRight="ArrowSmRight"
                                    className="whitespace-nowrap text-mustard-900"
                                  >
                                    Stake FIDU
                                  </Link>
                                </div>
                              }
                            />
                          ) : null}
                        </div>
                      </div>
                      <AssetGroupButton
                        disabled={additionDisabled}
                        onClick={() => setIsAddToVaultOpen(true)}
                      >
                        Select assets to add
                      </AssetGroupButton>
                      {!userHasVaultPosition && additionDisabled ? (
                        <div className="mt-2 text-center text-sm leading-none text-sand-700">
                          You must have both GFI and Capital to be eligible for
                          Membership
                        </div>
                      ) : null}
                    </div>
                  )}
                </AssetGroup>
              </div>

              <AssetGroup
                headingLeft="Assets in vault"
                className="lg:w-1/2"
                colorScheme="gold"
              >
                <div className="mb-6">
                  <AssetGroupSubheading
                    left="GFI"
                    right={formatCrypto({
                      token: SupportedCrypto.Gfi,
                      amount: vaultedGfi.amount,
                    })}
                  />
                  {showLoadingState ? (
                    <AssetBoxPlaceholder
                      asset={{
                        name: "GFI",
                        description: "Governance Token",
                        icon: "Gfi",
                      }}
                    />
                  ) : (
                    <AssetBox
                      faded={vaultedGfi.amount.isZero()}
                      nativeAmountIsPrimary
                      asset={{
                        name: "GFI",
                        description: "Governance Token",
                        icon: "Gfi",
                        nativeAmount: {
                          token: SupportedCrypto.Gfi,
                          amount: vaultedGfi.amount,
                        },
                        usdcAmount: gfiToUsdc(
                          {
                            token: SupportedCrypto.Gfi,
                            amount: vaultedGfi.amount,
                          },
                          data.gfiPrice.price.amount
                        ),
                      }}
                    />
                  )}
                </div>
                <div className="mb-6">
                  <AssetGroupSubheading
                    left="Capital"
                    right={
                      data
                        ? formatCrypto({
                            token: SupportedCrypto.Usdc,
                            amount: sum("usdcEquivalent", [
                              ...data.vaultedStakedPositions,
                              ...data.vaultedPoolTokens,
                            ]),
                          })
                        : undefined
                    }
                  />
                  {showLoadingState ? (
                    [0, 1, 2].map((nonce) => (
                      <AssetBoxPlaceholder key={nonce} />
                    ))
                  ) : data.vaultedStakedPositions.length > 0 ||
                    data.vaultedPoolTokens.length > 0 ? (
                    <div className="space-y-2">
                      {data.vaultedStakedPositions.map((vsp) => (
                        <AssetBox
                          key={vsp.id}
                          asset={{
                            name: "Staked FIDU",
                            description: "Goldfinch Senior Pool Position",
                            nativeAmount: {
                              token: SupportedCrypto.Fidu,
                              amount: vsp.seniorPoolStakedPosition.amount,
                            },
                            usdcAmount: {
                              token: SupportedCrypto.Usdc,
                              amount: vsp.usdcEquivalent,
                            },
                          }}
                        />
                      ))}
                      {data.vaultedPoolTokens.map((vpt) => (
                        <AssetBox
                          key={vpt.id}
                          asset={convertPoolTokenToAsset(vpt.poolToken)}
                        />
                      ))}
                    </div>
                  ) : (
                    <AssetBox
                      faded
                      asset={{
                        name: "Capital",
                        description: "Vaulted capital",
                        usdcAmount: {
                          token: SupportedCrypto.Usdc,
                          amount: BigNumber.from(0),
                        },
                      }}
                    />
                  )}
                </div>
                <AssetGroupButton
                  colorScheme="mustard"
                  onClick={() => setIsRemoveFromVaultOpen(true)}
                  disabled={
                    showLoadingState ||
                    (vaultedGfi.amount.isZero() &&
                      data.vaultedStakedPositions.length === 0 &&
                      data.vaultedPoolTokens.length === 0)
                  }
                >
                  Select assets to remove
                </AssetGroupButton>
              </AssetGroup>
            </div>
            {data ? (
              <>
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
                  vaultablePoolTokens={data.tranchedPoolTokens.filter(
                    (poolToken) =>
                      !poolToken.principalAmount
                        .sub(poolToken.principalRedeemed)
                        .isZero()
                  )}
                  vaultableStakedPositions={data.seniorPoolStakedPositions}
                  sharePrice={sharePrice}
                  unstakedFidu={
                    data.viewer.fiduBalance ?? {
                      token: SupportedCrypto.Fidu,
                      amount: BigNumber.from(0),
                    }
                  }
                  currentBlockTimestampMs={data.currentBlock.timestamp * 1000}
                />
                <RemoveFromVault
                  isOpen={isRemoveFromVaultOpen}
                  onClose={() => setIsRemoveFromVaultOpen(false)}
                  vaultedGfi={data.vaultedGfis}
                  fiatPerGfi={data.gfiPrice.price.amount}
                  vaultedStakedPositions={data.vaultedStakedPositions}
                  sharePrice={sharePrice}
                  vaultedPoolTokens={data.vaultedPoolTokens}
                />
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
