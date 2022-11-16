import { gql, useApolloClient } from "@apollo/client";
import clsx from "clsx";
import { format } from "date-fns";
import { BigNumber } from "ethers";
import { Children, ReactNode, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Form,
  InfoIconTooltip,
  Link,
  Modal,
} from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import {
  CryptoAmount,
  MembershipPageQuery,
  SupportedCrypto,
} from "@/lib/graphql/generated";
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

import {
  AssetBox,
  GfiBox,
  AssetPicker,
  AssetBoxPlaceholder,
  convertPoolTokenToAsset,
} from "./asset-box";
import { BalancedIsBest, BuyGfiCta, LpInSeniorPoolCta } from "./ctas";

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

interface AddToVaultProps {
  isOpen: boolean;
  onClose: () => void;
  maxVaultableGfi: CryptoAmount;
  fiatPerGfi: number;
  vaultableStakedPositions: StakedPosition[];
  sharePrice: BigNumber;
  vaultablePoolTokens: PoolToken[];
  unstakedFidu: CryptoAmount;
  currentBlockTimestampMs: number;
}

export function AddToVault({
  isOpen,
  onClose,
  maxVaultableGfi,
  fiatPerGfi,
  vaultableStakedPositions,
  sharePrice,
  vaultablePoolTokens,
  unstakedFidu,
  currentBlockTimestampMs,
}: AddToVaultProps) {
  const availableCapitalTotal = {
    token: SupportedCrypto.Usdc,
    amount: sharesToUsdc(
      sum("amount", vaultableStakedPositions),
      sharePrice
    ).amount.add(sum("principalAmount", vaultablePoolTokens)),
  };
  const rhfMethods = useForm<{
    gfiToVault: string;
    stakedPositionsToVault: string[];
    poolTokensToVault: string[];
  }>({
    mode: "onChange",
    defaultValues: { stakedPositionsToVault: [], poolTokensToVault: [] },
  });
  const {
    control,
    reset,
    watch,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = rhfMethods;
  const gfiToVault = stringToCryptoAmount(
    watch("gfiToVault"),
    SupportedCrypto.Gfi
  );
  const stakedPositionsToVault = vaultableStakedPositions.filter((s) =>
    watch("stakedPositionsToVault").includes(s.id)
  );
  const poolTokensToVault = vaultablePoolTokens.filter((p) =>
    watch("poolTokensToVault").includes(p.id)
  );
  const selectedCapitalTotal = useMemo(
    () => ({
      token: SupportedCrypto.Usdc,
      amount: sharesToUsdc(
        sum("amount", stakedPositionsToVault),
        sharePrice
      ).amount.add(sum("principalAmount", poolTokensToVault)),
    }),
    [stakedPositionsToVault, poolTokensToVault, sharePrice]
  );

  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  const [rewardProjection, setRewardProjection] = useState<{
    newMonthlyReward: CryptoAmount;
    diff: CryptoAmount;
  }>();
  useEffect(
    () => {
      const asyncEffect = async () => {
        if (!account || !provider) {
          return;
        }
        setRewardProjection(undefined);
        const projection = await calculateNewMonthlyMembershipReward(
          account,
          provider,
          gfiToVault.amount,
          selectedCapitalTotal.amount
        );

        // Minimum wait time to smooth out the animation
        await new Promise((resolve) => setTimeout(resolve, 250));

        setRewardProjection(projection);
      };
      asyncEffect();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      account,
      provider,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      gfiToVault.amount.toString(),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      selectedCapitalTotal.amount.toString(),
    ]
  );

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
      pendingPrompt: "Depositing your assets into the vault",
      successPrompt: "Successfully deposited your assets into the vault",
    });
    await apolloClient.refetchQueries({
      include: "active",
      updateCache(cache) {
        cache.evict({ fieldName: "user" });
        cache.evict({ fieldName: "tranchedPoolTokens" });
        cache.evict({ fieldName: "seniorPoolStakedPositions" });
      },
    });
    onClose();
    setTimeout(() => {
      setStep("select");
      reset();
    }, 250);
  };

  const [step, setStep] = useState<"select" | "review">("select");
  useEffect(() => {
    // Reset to the first step when this modal is closed
    if (!isOpen) {
      setTimeout(() => {
        setStep("select");
        reset();
      }, 250);
    }
  }, [isOpen, reset]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="bg-sand-100"
      title={step === "select" ? "Select assets to add" : "Confirm transaction"}
      size="sm"
      divider
      footer={
        <div className="flex items-center justify-between">
          <div className="w-28">
            <Button
              colorScheme="secondary"
              onClick={step === "select" ? onClose : () => setStep("select")}
            >
              {step === "select" ? "Cancel" : "Back"}
            </Button>
          </div>
          <div className="text-xs">{step === "select" ? 1 : 2} of 2</div>
          <div className="w-28 text-right">
            <Button
              isLoading={isSubmitting}
              colorScheme="primary"
              disabled={
                isSubmitting ||
                Object.keys(errors).length > 0 ||
                (gfiToVault.amount.isZero() &&
                  stakedPositionsToVault.length === 0 &&
                  poolTokensToVault.length === 0)
              }
              onClick={
                step === "select"
                  ? async () => {
                      const isValid = await trigger();
                      if (isValid) {
                        setStep("review");
                      }
                    }
                  : handleSubmit(onSubmit)
              }
            >
              {step === "select" ? "Next" : "Submit"}
            </Button>
          </div>
        </div>
      }
    >
      <Form rhfMethods={rhfMethods} onSubmit={onSubmit}>
        <div className={step === "select" ? undefined : "hidden"}>
          <BalancedIsBest colorScheme="tidepool" className="mb-8" />
          <div className="mb-8">
            <SectionHeading
              leftText="Step 1: Choose an amount of GFI"
              rightText={`${formatCrypto(maxVaultableGfi)} available`}
            />
            {maxVaultableGfi.amount.isZero() ? (
              <BuyGfiCta />
            ) : (
              <GfiBox
                maxGfi={maxVaultableGfi}
                fiatPerGfi={fiatPerGfi}
                name="gfiToVault"
                control={control}
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
                    asset: {
                      name: "Staked FIDU",
                      description: "Goldfinch Senior Pool Position",
                      usdcAmount: sharesToUsdc(vsp.amount, sharePrice),
                      nativeAmount: {
                        token: SupportedCrypto.Fidu,
                        amount: vsp.amount,
                      },
                    },
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
                          FIDU must be staked before it can be added to the
                          Vault.
                        </div>
                        <Link href="/stake" iconRight="ArrowTopRight">
                          Stake FIDU
                        </Link>
                      </div>
                    }
                  />
                ) : null}
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
        </div>
        <div className={step === "review" ? undefined : "hidden"}>
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
                  asset={{
                    name: "Staked FIDU",
                    description: "Goldfinch Senior Pool Position",
                    usdcAmount: sharesToUsdc(s.amount, sharePrice),
                    nativeAmount: {
                      token: SupportedCrypto.Fidu,
                      amount: s.amount,
                    },
                  }}
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
            <div className="mt-2 text-xs">
              By clicking continue below, I agree to lorem ipsum dolor sit amet,
              consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
              labore et dolore magna aliqua. Ut enim ad minim veniam, quis
              nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
              consequat. Duis aute irure dolor in reprehenderit in voluptate
              velit esse cillum dolore eu fugiat nulla pariatur.
            </div>
          </div>
        </div>
      </Form>
    </Modal>
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
