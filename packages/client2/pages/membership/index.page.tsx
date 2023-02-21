import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState } from "react";

import {
  Button,
  Heading,
  Link,
  AssetBox,
  Asset,
  AssetBoxPlaceholder,
} from "@/components/design-system";
import { SEO } from "@/components/seo";
import { formatCrypto } from "@/lib/format";
import { useMembershipPageQuery } from "@/lib/graphql/generated";
import { gfiToUsdc, sharesToUsdc, sum } from "@/lib/pools";
import { useWallet } from "@/lib/wallet";

import { AddToVault } from "./add-to-vault";
import {
  AssetGroup,
  AssetGroupSubheading,
  AssetGroupButton,
} from "./asset-group";
import { BuyGfiCta, LpInSeniorPoolCta, BalancedIsBest } from "./ctas";
import { Explainer } from "./explainer";
import {
  convertPoolTokenToAsset,
  convertStakedPositionToAsset,
} from "./helpers";
import { IntroVideoSection } from "./intro-video-section";
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
  fragment StakedPositionFieldsForAssets on SeniorPoolStakedPosition {
    id
    amount
  }
  fragment PoolTokenFieldsForAssets on TranchedPoolToken {
    id
    principalAmount
    principalRedeemed
    tranchedPool {
      id
      name @client
    }
  }
  query MembershipPage($userId: String!) {
    seniorPools {
      id
      sharePrice
    }
    viewer @client(always: true) {
      gfiBalance
      fiduBalance
      claimableMembershipRewards
      accruedMembershipRewardsThisEpoch
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
      ...StakedPositionFieldsForAssets
    }
    tranchedPoolTokens(
      where: {
        user: $userId
        principalAmount_gt: 0
        tranche_: { lockedUntil_gt: 0 }
      }
      orderBy: mintedAt
      orderDirection: desc
    ) {
      ...PoolTokenFieldsForAssets
    }
    ineligiblePoolTokens: tranchedPoolTokens(
      where: {
        user: $userId
        principalAmount_gt: 0
        tranche_: { lockedUntil: 0 }
      }
      orderBy: mintedAt
      orderDirection: desc
    ) {
      ...PoolTokenFieldsForAssets
    }

    currentBlock @client {
      timestamp
    }

    vaultedGfis(
      where: { user: $userId, amount_gt: 0 }
      orderBy: vaultedAt
      orderDirection: desc # It's important that these come in descending order by timestamp. When vaulted GFI is unvaulted, it should be done with the most recent ones first, to minimize removal penalty. (https://github.com/warbler-labs/mono/pull/1015#discussion_r1027590062)
    ) {
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

    membershipEpoches(orderBy: epoch, orderDirection: desc, first: 8) {
      epoch
      totalRewards
    }
  }
`;

const assumedRewards = BigNumber.from("12500000000000000000000");
const sampleSize = 8; // This should match the number of epochs being fetched in the graphQL query
function averagePriorRewards(priorRewards?: BigNumber[]) {
  if (!priorRewards) {
    return assumedRewards;
  }
  // If there's not enough to form a full sample, fill the sample with the assumed reward amount (12.5k FIDU)
  const backfilledRewards =
    priorRewards.length >= sampleSize
      ? priorRewards
      : [
          ...priorRewards,
          ...new Array<BigNumber>(sampleSize - priorRewards.length).fill(
            assumedRewards
          ),
        ];
  return backfilledRewards
    .reduce((prev, current) => prev.add(current), BigNumber.from(0))
    .div(backfilledRewards.length);
}

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
  const previousEpochRewardTotal = averagePriorRewards(
    data?.membershipEpoches?.map((e) => e.totalRewards)
  );

  const vaultableCapitalAssets: Asset[] = [];
  const sharePrice = data?.seniorPools[0].sharePrice ?? BigNumber.from(0);
  if (data && data.seniorPoolStakedPositions.length > 0) {
    data.seniorPoolStakedPositions.forEach((seniorPoolStakedPosition) => {
      vaultableCapitalAssets.push(
        convertStakedPositionToAsset(seniorPoolStakedPosition, sharePrice)
      );
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
    token: "GFI",
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
            <IntroVideoSection className="mb-16" />
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
                            token: "USDC",
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
                          {data.ineligiblePoolTokens.map((pt) => (
                            <AssetBox
                              key={pt.id}
                              asset={convertPoolTokenToAsset(pt)}
                              notice="You cannot vault this pool token because the borrower has not yet drawn down from this pool."
                            />
                          ))}
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
                      token: "GFI",
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
                          token: "GFI",
                          amount: vaultedGfi.amount,
                        },
                        usdcAmount: gfiToUsdc(
                          {
                            token: "GFI",
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
                            token: "USDC",
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
                          asset={convertStakedPositionToAsset(
                            vsp.seniorPoolStakedPosition,
                            sharePrice
                          )}
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
                          token: "USDC",
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
                      token: "GFI",
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
                      token: "FIDU",
                      amount: BigNumber.from(0),
                    }
                  }
                  ineligiblePoolTokens={data.ineligiblePoolTokens}
                  currentBlockTimestampMs={data.currentBlock.timestamp * 1000}
                  previousEpochRewardTotal={previousEpochRewardTotal}
                />
                <RemoveFromVault
                  isOpen={isRemoveFromVaultOpen}
                  onClose={() => setIsRemoveFromVaultOpen(false)}
                  vaultedGfi={data.vaultedGfis}
                  fiatPerGfi={data.gfiPrice.price.amount}
                  vaultedStakedPositions={data.vaultedStakedPositions}
                  sharePrice={sharePrice}
                  vaultedPoolTokens={data.vaultedPoolTokens}
                  previousEpochRewardTotal={previousEpochRewardTotal}
                />
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
