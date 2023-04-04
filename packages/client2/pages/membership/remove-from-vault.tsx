import { gql, useApolloClient } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  FormStep,
  InfoIconTooltip,
  ModalStepper,
  useStepperContext,
  AssetBox,
  AssetBoxPlaceholder,
  AssetPicker,
  AssetInputBox,
} from "@/components/design-system";
import { getContract2 } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import {
  VaultedGfiFieldsFragment,
  VaultedStakedPositionFieldsFragment,
  VaultedPoolTokenFieldsFragment,
} from "@/lib/graphql/generated";
import {
  calculateNewMonthlyMembershipReward,
  estimateForfeiture,
} from "@/lib/membership";
import { gfiToUsdc, sharesToUsdc, sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet2 } from "@/lib/wallet";

import { SectionHeading, Summary } from "./add-to-vault";
import {
  convertPoolTokenToAsset,
  convertStakedPositionToAsset,
} from "./helpers";
import { Legalese } from "./legal-agreement";

export const VAULTED_GFI_FIELDS = gql`
  fragment VaultedGfiFields on VaultedGfi {
    id
    amount
  }
`;

export const VAULTED_STAKED_POSITION_FIELDS = gql`
  fragment VaultedStakedPositionFields on VaultedStakedPosition {
    id
    usdcEquivalent
    seniorPoolStakedPosition {
      ...StakedPositionFieldsForAssets
    }
  }
`;

export const VAULTED_POOL_TOKEN_FIELDS = gql`
  fragment VaultedPoolTokenFields on VaultedPoolToken {
    id
    usdcEquivalent
    poolToken {
      ...PoolTokenFieldsForAssets
    }
  }
`;
type RemoveFromVaultProps = {
  isOpen: boolean;
  onClose: () => void;
} & SelectionStepProps &
  ReviewStepProps;

export function RemoveFromVault({
  isOpen,
  onClose,
  vaultedGfi,
  fiatPerGfi,
  vaultedStakedPositions,
  sharePrice,
  vaultedPoolTokens,
  previousEpochRewardTotal,
}: RemoveFromVaultProps) {
  return (
    <ModalStepper
      isOpen={isOpen}
      onClose={onClose}
      className="bg-mustard-300"
      title="Select assets to remove"
      divider={false}
    >
      <SelectionStep
        vaultedGfi={vaultedGfi}
        fiatPerGfi={fiatPerGfi}
        vaultedStakedPositions={vaultedStakedPositions}
        sharePrice={sharePrice}
        vaultedPoolTokens={vaultedPoolTokens}
        previousEpochRewardTotal={previousEpochRewardTotal}
      />
      <ReviewStep
        vaultedGfi={vaultedGfi}
        fiatPerGfi={fiatPerGfi}
        sharePrice={sharePrice}
      />
    </ModalStepper>
  );
}

interface StepperDataType {
  gfiToUnvault: CryptoAmount<"GFI">;
  stakedPositionsToUnvault: VaultedStakedPositionFieldsFragment[];
  poolTokensToUnvault: VaultedPoolTokenFieldsFragment[];
  forfeited?: CryptoAmount<"FIDU">;
  rewardProjection?: {
    newMonthlyReward: CryptoAmount<"FIDU">;
    diff: CryptoAmount<"FIDU">;
  };
}

interface SelectionStepProps {
  vaultedGfi: VaultedGfiFieldsFragment[];
  fiatPerGfi: number;
  vaultedStakedPositions: VaultedStakedPositionFieldsFragment[];
  sharePrice: BigNumber;
  vaultedPoolTokens: VaultedPoolTokenFieldsFragment[];
  previousEpochRewardTotal?: BigNumber;
}

function SelectionStep({
  vaultedGfi,
  fiatPerGfi,
  vaultedStakedPositions,
  sharePrice,
  vaultedPoolTokens,
  previousEpochRewardTotal,
}: SelectionStepProps) {
  const rhfMethods = useForm<{
    stakedPositionsToUnvault: string[];
    poolTokensToUnvault: string[];
    gfiToUnvault: string;
  }>({
    defaultValues: { stakedPositionsToUnvault: [], poolTokensToUnvault: [] },
  });
  const { control, watch } = rhfMethods;
  const gfiToUnvault = stringToCryptoAmount(watch("gfiToUnvault"), "GFI");
  const stakedPositionsToUnvault = vaultedStakedPositions.filter((s) =>
    watch("stakedPositionsToUnvault").includes(s.id)
  );
  const poolTokensToUnvault = vaultedPoolTokens.filter((p) =>
    watch("poolTokensToUnvault").includes(p.id)
  );
  const capitalToBeRemoved = {
    token: "USDC",
    amount: sum("usdcEquivalent", stakedPositionsToUnvault).add(
      sum("usdcEquivalent", poolTokensToUnvault)
    ),
  };

  const { account, provider } = useWallet2();

  const [rewardProjection, setRewardProjection] = useState<{
    newMonthlyReward: CryptoAmount<"FIDU">;
    diff: CryptoAmount<"FIDU">;
  }>();
  const [forfeited, setForfeited] = useState<CryptoAmount>({
    token: "FIDU",
    amount: BigNumber.from(0),
  });
  const gfiToUnvaultAmount = gfiToUnvault.amount.mul("-1").toString();
  const capitalToBeRemovedAmount = capitalToBeRemoved.amount
    .mul("-1")
    .toString();
  useEffect(() => {
    const asyncEffect = async () => {
      if (!account || !provider) {
        return;
      }

      const estimatedForfeiture = await estimateForfeiture(
        account,
        provider,
        gfiToUnvaultAmount,
        capitalToBeRemovedAmount
      );
      setForfeited({
        token: "FIDU",
        amount: estimatedForfeiture,
      });

      setRewardProjection(undefined);
      const projection = await calculateNewMonthlyMembershipReward(
        account,
        gfiToUnvaultAmount,
        capitalToBeRemovedAmount,
        previousEpochRewardTotal
      );

      // Minimum wait time to smooth out the animation
      await new Promise((resolve) => setTimeout(resolve, 250));

      setRewardProjection(projection);
    };
    asyncEffect();
  }, [
    account,
    provider,
    gfiToUnvaultAmount,
    capitalToBeRemovedAmount,
    previousEpochRewardTotal,
  ]);

  const { setData } = useStepperContext();
  const onSubmit = async () => {
    if (gfiToUnvault.amount.isZero() && capitalToBeRemoved.amount.isZero()) {
      throw new Error("Must remove at least one of GFI or Capital");
    }
    if (!account || !provider) {
      throw new Error("Wallet connection is broken");
    }
    let f = undefined;
    try {
      f =
        forfeited ??
        (await estimateForfeiture(
          account,
          provider,
          gfiToUnvault.amount.mul("-1"),
          capitalToBeRemoved.amount.mul("-1")
        ));
    } catch (e) {
      // do nothing
    }
    let rp = undefined;
    try {
      rp =
        rewardProjection ??
        (await calculateNewMonthlyMembershipReward(
          account,
          gfiToUnvault.amount.mul("-1"),
          capitalToBeRemoved.amount.mul("-1")
        ));
    } catch (e) {
      // do nothing
    }
    setData({
      gfiToUnvault,
      stakedPositionsToUnvault,
      poolTokensToUnvault,
      forfeited: f,
      rewardProjection: rp,
    } as StepperDataType);
  };

  return (
    <FormStep
      rhfMethods={rhfMethods}
      onSubmit={onSubmit}
      submitButtonLabel="Review"
    >
      <div className="mb-8">
        <SectionHeading
          leftText="Step 1: Choose an amount of GFI"
          rightText={formatCrypto({
            token: "GFI",
            amount: sum("amount", vaultedGfi),
          })}
        />
        <AssetInputBox
          asset={{
            name: "GFI",
            description: "Goldfinch Token",
            nativeAmount: {
              token: "GFI",
              amount: sum("amount", vaultedGfi),
            },
            usdcAmount: gfiToUsdc(
              {
                token: "GFI",
                amount: sum("amount", vaultedGfi),
              },
              fiatPerGfi
            ),
          }}
          fiatPerGfi={fiatPerGfi}
          control={control}
          name="gfiToUnvault"
          label="GFI to Unvault"
        />
      </div>
      <div className="mb-8">
        <SectionHeading leftText="Step 2: Choose an amount of capital" />
        <div className="space-y-2">
          <AssetPicker
            options={vaultedStakedPositions.map((vsp) => ({
              id: vsp.id,
              asset: convertStakedPositionToAsset(
                vsp.seniorPoolStakedPosition,
                sharePrice
              ),
            }))}
            control={control}
            name="stakedPositionsToUnvault"
          />
          <AssetPicker
            options={vaultedPoolTokens.map((vpt) => ({
              id: vpt.id,
              asset: convertPoolTokenToAsset(vpt.poolToken),
            }))}
            control={control}
            name="poolTokensToUnvault"
          />
        </div>
      </div>
      <div className="mb-8">
        <SectionHeading leftText="Projected Member Rewards" />
        {rewardProjection ? (
          <AssetBox
            asset={{
              name: "Estimated Member Rewards",
              description: "(Monthly Average)",
              usdcAmount: sharesToUsdc(
                rewardProjection.newMonthlyReward.amount,
                sharePrice
              ),
              nativeAmount: rewardProjection.newMonthlyReward,
            }}
            changeAmount={rewardProjection.diff}
          />
        ) : (
          <AssetBoxPlaceholder
            asset={{
              name: "Estimated Member Rewards",
              description: "(Monthly Average)",
            }}
          />
        )}
      </div>
    </FormStep>
  );
}

interface ReviewStepProps {
  vaultedGfi: VaultedGfiFieldsFragment[];
  fiatPerGfi: number;
  sharePrice: BigNumber;
}

function ReviewStep({ vaultedGfi, fiatPerGfi, sharePrice }: ReviewStepProps) {
  const rhfMethods = useForm();
  const { data } = useStepperContext();
  const {
    gfiToUnvault,
    stakedPositionsToUnvault,
    poolTokensToUnvault,
    forfeited,
    rewardProjection,
  } = data as StepperDataType;
  const capitalToBeRemoved = {
    token: "USDC",
    amount: sum("usdcEquivalent", stakedPositionsToUnvault).add(
      sum("usdcEquivalent", poolTokensToUnvault)
    ),
  } as const;

  const { signer } = useWallet2();
  const apolloClient = useApolloClient();

  const onSubmit = async () => {
    if (!signer) {
      throw new Error("Wallet not connected properly");
    }
    const membershipContract = await getContract2({
      name: "MembershipOrchestrator",
      signer,
    });

    const gfiPositions: VaultedGfiFieldsFragment[] = [];
    for (const vaulted of vaultedGfi) {
      const remainingToWithdraw = gfiToUnvault.amount.sub(
        sum("amount", gfiPositions)
      );
      if (remainingToWithdraw.isZero()) {
        break;
      }
      const amountFromThisToken = vaulted.amount.gt(remainingToWithdraw)
        ? remainingToWithdraw
        : vaulted.amount;
      gfiPositions.push({ id: vaulted.id, amount: amountFromThisToken });
    }
    if (sum("amount", gfiPositions).lt(gfiToUnvault.amount)) {
      throw new Error("Insufficient balance to withdraw");
    }
    const capitalPositions = stakedPositionsToUnvault
      .map((s) => s.id)
      .concat(poolTokensToUnvault.map((p) => p.id));
    const transaction = membershipContract.withdraw({
      gfiPositions,
      capitalPositions,
    });
    await toastTransaction({
      transaction,
      pendingPrompt: "Withdrawing your assets from the vault.",
      successPrompt: "Successfully withdrew your assets from the vault.",
      errorPrompt: "Failed to withdraw your assets from the vault.",
    });
    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "user" });
        cache.evict({ fieldName: "poolTokens" });
        cache.evict({ fieldName: "seniorPoolStakedPositions" });
      },
    });
  };
  return (
    <FormStep
      rhfMethods={rhfMethods}
      onSubmit={onSubmit}
      submitButtonLabel="Submit"
      requireScrolled
    >
      <div className="mb-8">
        <SectionHeading
          leftText="GFI to be removed"
          rightText={formatCrypto(gfiToUsdc(gfiToUnvault, fiatPerGfi))}
        />
        <AssetBox
          asset={{
            name: "GFI",
            description: "Governance Token",
            nativeAmount: gfiToUnvault,
            usdcAmount: gfiToUsdc(gfiToUnvault, fiatPerGfi),
          }}
          nativeAmountIsPrimary
        />
      </div>
      <div className="mb-8">
        <SectionHeading
          leftText="Capital to be removed"
          rightText={formatCrypto(capitalToBeRemoved)}
        />
        <div className="space-y-2">
          {stakedPositionsToUnvault.map((vsp) => (
            <AssetBox
              key={vsp.id}
              asset={convertStakedPositionToAsset(
                vsp.seniorPoolStakedPosition,
                sharePrice
              )}
            />
          ))}
          {poolTokensToUnvault.map((vpt) => (
            <AssetBox
              key={vpt.id}
              asset={convertPoolTokenToAsset(vpt.poolToken)}
            />
          ))}
        </div>
      </div>
      <div>
        <SectionHeading leftText="Projected Member Rewards" />
        <Summary>
          {rewardProjection ? (
            <AssetBox
              omitWrapperStyle
              asset={{
                name: "Estimated Member Rewards",
                description: "(Monthly Average)",
                usdcAmount: sharesToUsdc(
                  rewardProjection.newMonthlyReward.amount,
                  sharePrice
                ),
                nativeAmount: rewardProjection.newMonthlyReward,
              }}
              changeAmount={rewardProjection.diff}
            />
          ) : (
            <AssetBoxPlaceholder
              asset={{
                name: "Estimated Member Rewards",
                description: "(Monthly Average)",
              }}
            />
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              Rewards forfeited
              <InfoIconTooltip content="The value of the rewards forfeited for withdrawing from the Member Vault during this weekly cycle. Withdrawing from a Vault before the end of a cycle forfeits all rewards for that cycle." />
            </div>
            <div className="text-lg font-medium text-clay-500">
              {forfeited
                ? formatCrypto(sharesToUsdc(forfeited.amount, sharePrice))
                : "Unable to calculate"}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              Changes go into effect
              <InfoIconTooltip content="Date that your capital will no longer be actively earning Member Rewards in the vault." />
            </div>
            <div className="text-lg font-medium">Immediately</div>
          </div>
        </Summary>
        <Legalese className="mt-6 text-sand-500" />
      </div>
    </FormStep>
  );
}
