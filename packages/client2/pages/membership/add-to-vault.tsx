import { gql, useApolloClient } from "@apollo/client";
import clsx from "clsx";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { Children, ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  FormStep,
  InfoIconTooltip,
  Link,
  ModalStepper,
  useStepperContext,
  AssetPicker,
  AssetBox,
  AssetBoxPlaceholder,
  AssetInputBox,
} from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import { MembershipPageQuery } from "@/lib/graphql/generated";
import {
  calculateNewMonthlyMembershipReward,
  epochFinalizedDate,
} from "@/lib/membership";
import {
  approveErc20IfRequired,
  approveErc721IfRequired,
  gfiToUsdc,
  sharesToUsdc,
  sum,
} from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

import { BalancedIsBest, BuyGfiCta, LpInSeniorPoolCta } from "./ctas";
import {
  convertStakedPositionToAsset,
  convertPoolTokenToAsset,
} from "./helpers";
import { Legalese } from "./legal-agreement";

type StakedPosition = MembershipPageQuery["seniorPoolStakedPositions"][number];
type PoolToken = MembershipPageQuery["tranchedPoolTokens"][number];

export const ADD_TO_VAULT_POOL_TOKEN_FIELDS = gql`
  fragment AddToVaultPoolTokenFields on TranchedPoolToken {
    id
    principalAmount
    tranchedPool {
      id
      name @client
    }
  }
`;

type AddToVaultProps = {
  isOpen: boolean;
  onClose: () => void;
} & SelectionStepProps &
  ReviewStepProps;

export function AddToVault({
  isOpen,
  onClose,
  maxVaultableGfi,
  fiatPerGfi,
  vaultableStakedPositions,
  sharePrice,
  vaultablePoolTokens,
  unstakedFidu,
  ineligiblePoolTokens,
  currentBlockTimestampMs,
  previousEpochRewardTotal,
}: AddToVaultProps) {
  return (
    <ModalStepper
      isOpen={isOpen}
      onClose={onClose}
      className="bg-sand-100"
      title="Select assets to add"
      divider
    >
      <SelectionStep
        maxVaultableGfi={maxVaultableGfi}
        fiatPerGfi={fiatPerGfi}
        vaultableStakedPositions={vaultableStakedPositions}
        sharePrice={sharePrice}
        vaultablePoolTokens={vaultablePoolTokens}
        unstakedFidu={unstakedFidu}
        ineligiblePoolTokens={ineligiblePoolTokens}
        previousEpochRewardTotal={previousEpochRewardTotal}
      />
      <ReviewStep
        fiatPerGfi={fiatPerGfi}
        sharePrice={sharePrice}
        currentBlockTimestampMs={currentBlockTimestampMs}
      />
    </ModalStepper>
  );
}

interface StepperDataType {
  gfiToVault: CryptoAmount<"GFI">;
  stakedPositionsToVault: StakedPosition[];
  poolTokensToVault: PoolToken[];
  rewardProjection?: {
    newMonthlyReward: CryptoAmount<"FIDU">;
    diff: CryptoAmount<"FIDU">;
  };
}

interface SelectionStepProps {
  maxVaultableGfi: CryptoAmount<"GFI">;
  fiatPerGfi: number;
  vaultableStakedPositions: StakedPosition[];
  sharePrice: BigNumber;
  vaultablePoolTokens: PoolToken[];
  unstakedFidu: CryptoAmount<"FIDU">;
  ineligiblePoolTokens: PoolToken[];
  previousEpochRewardTotal?: BigNumber;
}

function SelectionStep({
  maxVaultableGfi,
  fiatPerGfi,
  vaultableStakedPositions,
  sharePrice,
  vaultablePoolTokens,
  ineligiblePoolTokens,
  unstakedFidu,
  previousEpochRewardTotal,
}: SelectionStepProps) {
  const availableCapitalTotal = {
    token: "USDC",
    amount: sharesToUsdc(
      sum("amount", vaultableStakedPositions),
      sharePrice
    ).amount.add(sum("principalAmount", vaultablePoolTokens)),
  } as const;
  const rhfMethods = useForm<{
    gfiToVault: string;
    stakedPositionsToVault: string[];
    poolTokensToVault: string[];
  }>({
    defaultValues: { stakedPositionsToVault: [], poolTokensToVault: [] },
  });
  const { control, watch } = rhfMethods;
  const gfiToVault = stringToCryptoAmount(watch("gfiToVault"), "GFI");
  const stakedPositionsToVault = vaultableStakedPositions.filter((s) =>
    watch("stakedPositionsToVault").includes(s.id)
  );
  const poolTokensToVault = vaultablePoolTokens.filter((p) =>
    watch("poolTokensToVault").includes(p.id)
  );
  const selectedCapitalTotal = useMemo(
    () => ({
      token: "USDC",
      amount: sharesToUsdc(
        sum("amount", stakedPositionsToVault),
        sharePrice
      ).amount.add(sum("principalAmount", poolTokensToVault)),
    }),
    [stakedPositionsToVault, poolTokensToVault, sharePrice]
  );

  const { account, provider } = useWallet();
  const [rewardProjection, setRewardProjection] = useState<{
    newMonthlyReward: CryptoAmount;
    diff: CryptoAmount;
  }>();
  const gfiToVaultAmount = gfiToVault.amount.toString();
  const selectedCapitalTotalAmount = selectedCapitalTotal.amount.toString();
  useEffect(() => {
    const asyncEffect = async () => {
      if (!account || !provider) {
        return;
      }
      setRewardProjection(undefined);
      const projection = await calculateNewMonthlyMembershipReward(
        account,
        provider,
        gfiToVaultAmount,
        selectedCapitalTotalAmount,
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
    gfiToVaultAmount,
    selectedCapitalTotalAmount,
    previousEpochRewardTotal,
  ]);
  const { setData } = useStepperContext();
  const onSubmit = async () => {
    if (gfiToVault.amount.isZero() && selectedCapitalTotal.amount.isZero()) {
      throw new Error("Must deposit at least one of GFI or Capital");
    }
    if (!account || !provider) {
      throw new Error("Wallet connection is broken");
    }
    let rp = undefined;
    try {
      rp =
        rewardProjection ??
        (await calculateNewMonthlyMembershipReward(
          account,
          provider,
          gfiToVault.amount,
          selectedCapitalTotal.amount
        ));
    } catch (e) {
      // do nothing
    }

    setData({
      gfiToVault,
      stakedPositionsToVault,
      poolTokensToVault,
      rewardProjection: rp,
    });
  };
  return (
    <FormStep
      rhfMethods={rhfMethods}
      submitButtonLabel="Review"
      onSubmit={onSubmit}
    >
      <BalancedIsBest colorScheme="tidepool" className="mb-8" />
      <div className="mb-8">
        <SectionHeading
          leftText="Step 1: Choose an amount of GFI"
          rightText={`${formatCrypto(maxVaultableGfi)} available`}
        />
        {maxVaultableGfi.amount.isZero() ? (
          <BuyGfiCta />
        ) : (
          <AssetInputBox
            asset={{
              name: "GFI",
              description: "Goldfinch Token",
              nativeAmount: maxVaultableGfi,
              usdcAmount: gfiToUsdc(maxVaultableGfi, fiatPerGfi),
            }}
            fiatPerGfi={fiatPerGfi}
            control={control}
            name="gfiToVault"
            label="GFI to Vault"
          />
        )}
      </div>
      <div className="mb-8">
        <SectionHeading
          leftText="Step 2: Choose an amount of Capital"
          rightText={`${formatCrypto(availableCapitalTotal)} available`}
        />
        {availableCapitalTotal.amount.isZero() ? (
          <LpInSeniorPoolCta />
        ) : (
          <div className="space-y-2">
            <AssetPicker
              name="stakedPositionsToVault"
              control={control}
              options={vaultableStakedPositions.map((vsp) => ({
                id: vsp.id,
                asset: convertStakedPositionToAsset(vsp, sharePrice),
              }))}
            />
            <AssetPicker
              name="poolTokensToVault"
              control={control}
              options={vaultablePoolTokens.map((vpt) => ({
                id: vpt.id,
                asset: convertPoolTokenToAsset(vpt),
              }))}
            />
            {!unstakedFidu.amount.isZero() ? (
              <AssetBox
                asset={{
                  name: "Unstaked FIDU",
                  description: "Goldfinch Senior Pool Position",
                  nativeAmount: unstakedFidu,
                  usdcAmount: sharesToUsdc(unstakedFidu.amount, sharePrice),
                }}
                notice={
                  <div className="flex items-center justify-between">
                    <div>
                      FIDU must be staked before it can be added to the Vault.
                    </div>
                    <Link href="/stake" iconRight="ArrowTopRight">
                      Stake FIDU
                    </Link>
                  </div>
                }
              />
            ) : null}
            {ineligiblePoolTokens.map((pt) => (
              <AssetBox
                key={`ineligible-pool-token-${pt.id}`}
                asset={convertPoolTokenToAsset(pt)}
                notice="You cannot vault this pool token because the borrower has not yet drawn down from this pool."
              />
            ))}
          </div>
        )}
      </div>
      <div>
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
  fiatPerGfi: number;
  sharePrice: BigNumber;
  currentBlockTimestampMs: number;
}

function ReviewStep({
  fiatPerGfi,
  sharePrice,
  currentBlockTimestampMs,
}: ReviewStepProps) {
  const rhfMethods = useForm();
  const { data } = useStepperContext();
  const {
    gfiToVault,
    stakedPositionsToVault,
    poolTokensToVault,
    rewardProjection,
  } = data as StepperDataType;
  const selectedCapitalTotal = useMemo(
    () =>
      ({
        token: "USDC",
        amount: sharesToUsdc(
          sum("amount", stakedPositionsToVault),
          sharePrice
        ).amount.add(sum("principalAmount", poolTokensToVault)),
      } as const),
    [stakedPositionsToVault, poolTokensToVault, sharePrice]
  );

  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  const onSubmit = async () => {
    if (!provider || !account) {
      throw new Error("Wallet not connected properly");
    }
    const membershipContract = await getContract({
      name: "MembershipOrchestrator",
      provider,
    });
    const gfiContract = await getContract({ name: "GFI", provider });
    const stakingRewardsContract = await getContract({
      name: "StakingRewards",
      provider,
    });
    const poolTokensContract = await getContract({
      name: "PoolTokens",
      provider,
    });

    if (!gfiToVault.amount.isZero()) {
      await approveErc20IfRequired({
        account,
        spender: membershipContract.address,
        erc20Contract: gfiContract,
        amount: gfiToVault.amount,
      });
    }
    if (stakedPositionsToVault.length > 0) {
      for (const stakedPosition of stakedPositionsToVault) {
        await approveErc721IfRequired({
          to: membershipContract.address,
          tokenId: stakedPosition.id,
          erc721Contract: stakingRewardsContract,
        });
      }
    }
    if (poolTokensToVault.length > 0) {
      for (const poolToken of poolTokensToVault) {
        await approveErc721IfRequired({
          to: membershipContract.address,
          tokenId: poolToken.id,
          erc721Contract: poolTokensContract,
        });
      }
    }

    const capitalDeposits = stakedPositionsToVault
      .map((s) => ({
        assetAddress: stakingRewardsContract.address,
        id: s.id,
      }))
      .concat(
        poolTokensToVault.map((p) => ({
          assetAddress: poolTokensContract.address,
          id: p.id,
        }))
      );
    const transaction = membershipContract.deposit({
      gfi: gfiToVault.amount,
      capitalDeposits,
    });
    await toastTransaction({
      transaction,
      pendingPrompt: "Depositing your assets into the vault.",
      successPrompt: "Successfully deposited your assets into the vault.",
    });
    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "user" });
        cache.evict({ fieldName: "tranchedPoolTokens" });
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
          leftText="GFI to be added"
          rightText={formatCrypto(gfiToVault)}
        />
        <AssetBox
          asset={{
            name: "GFI",
            icon: "Gfi",
            description: "Governance Token",
            usdcAmount: gfiToUsdc(gfiToVault, fiatPerGfi),
            nativeAmount: gfiToVault,
          }}
          nativeAmountIsPrimary
        />
      </div>
      <div className="mb-8">
        <SectionHeading
          leftText="Capital to be added"
          rightText={formatCrypto(selectedCapitalTotal)}
        />
        <div className="space-y-2">
          {stakedPositionsToVault.map((s) => (
            <AssetBox
              key={`staked-fidu-${s.id}`}
              asset={convertStakedPositionToAsset(s, sharePrice)}
            />
          ))}
          {poolTokensToVault.map((p) => (
            <AssetBox
              key={`pool-token-${p.id}`}
              asset={convertPoolTokenToAsset(p)}
            />
          ))}
        </div>
      </div>
      <div className="mb-8">
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
              Your next Member Rewards cycle begins
              <InfoIconTooltip content="The date that your capital will start actively earning Member Rewards in the vault." />
            </div>
            <div className="text-lg font-medium">
              {format(
                epochFinalizedDate(currentBlockTimestampMs),
                "LLLL d, yyyy"
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              Your next Member Rewards distribution
              <InfoIconTooltip content="Date that your Member Reward distribution will reflect rewards earned by the new assets you are adding to the vault." />
            </div>
            <div className="text-lg font-medium">
              {format(
                epochFinalizedDate(currentBlockTimestampMs, 2),
                "LLLL d, yyyy"
              )}
            </div>
          </div>
        </Summary>
        <Legalese className="mt-6 text-sand-400" />
      </div>
    </FormStep>
  );
}

export function SectionHeading({
  leftText,
  rightText,
  className,
}: {
  leftText: string;
  rightText?: string;
  className?: string;
}) {
  return (
    <div className={clsx("mb-2 flex justify-between gap-5 text-sm", className)}>
      <div>{leftText}</div>
      {rightText ? <div>{rightText}</div> : null}
    </div>
  );
}

export function Summary({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-sand-200 rounded border border-sand-200 bg-white">
      {Children.map(children, (child) => (
        <div className="px-5 py-6">{child}</div>
      ))}
    </div>
  );
}
