import { gql, useApolloClient } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Form,
  InfoIconTooltip,
  Modal,
} from "@/components/design-system";
import { getContract } from "@/lib/contracts";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import {
  SupportedCrypto,
  VaultedGfiFieldsFragment,
  VaultedStakedPositionFieldsFragment,
  VaultedPoolTokenFieldsFragment,
  CryptoAmount,
} from "@/lib/graphql/generated";
import {
  calculateNewMonthlyMembershipReward,
  estimateForfeiture,
} from "@/lib/membership";
import { gfiToUsdc, sharesToUsdc, sum } from "@/lib/pools";
import { toastTransaction } from "@/lib/toast";
import { useWallet } from "@/lib/wallet";

import { SectionHeading, Summary } from "./add-to-vault";
import {
  AssetBox,
  AssetBoxPlaceholder,
  AssetPicker,
  convertPoolTokenToAsset,
  GfiBox,
} from "./asset-box";
import { LegalAgreement } from "./legal-agreement";

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
      id
      amount
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
interface RemoveFromVaultProps {
  isOpen: boolean;
  onClose: () => void;
  vaultedGfi: VaultedGfiFieldsFragment[];
  fiatPerGfi: number;
  vaultedStakedPositions: VaultedStakedPositionFieldsFragment[];
  sharePrice: BigNumber;
  vaultedPoolTokens: VaultedPoolTokenFieldsFragment[];
}

export function RemoveFromVault({
  isOpen,
  onClose,
  vaultedGfi,
  fiatPerGfi,
  vaultedStakedPositions,
  sharePrice,
  vaultedPoolTokens,
}: RemoveFromVaultProps) {
  const [step, setStep] = useState<"select" | "review">("select");

  const rhfMethods = useForm<{
    stakedPositionsToUnvault: string[];
    poolTokensToUnvault: string[];
    gfiToUnvault: string;
  }>({
    mode: "onChange",
    defaultValues: { stakedPositionsToUnvault: [], poolTokensToUnvault: [] },
  });
  const {
    control,
    reset,
    watch,
    handleSubmit,
    trigger,
    formState: { errors, isSubmitting },
  } = rhfMethods;
  const gfiToUnvault = stringToCryptoAmount(
    watch("gfiToUnvault"),
    SupportedCrypto.Gfi
  );
  const stakedPositionsToUnvault = vaultedStakedPositions.filter((s) =>
    watch("stakedPositionsToUnvault").includes(s.id)
  );
  const poolTokensToUnvault = vaultedPoolTokens.filter((p) =>
    watch("poolTokensToUnvault").includes(p.id)
  );
  const capitalToBeRemoved = {
    token: SupportedCrypto.Usdc,
    amount: sum("usdcEquivalent", stakedPositionsToUnvault).add(
      sum("usdcEquivalent", poolTokensToUnvault)
    ),
  };

  const { account, provider } = useWallet();
  const apolloClient = useApolloClient();

  const [rewardProjection, setRewardProjection] = useState<{
    newMonthlyReward: CryptoAmount;
    diff: CryptoAmount;
  }>();
  const [forfeited, setForfeited] = useState<CryptoAmount>({
    token: SupportedCrypto.Fidu,
    amount: BigNumber.from(0),
  });
  useEffect(
    () => {
      const asyncEffect = async () => {
        if (!account || !provider) {
          return;
        }

        const estimatedForfeiture = await estimateForfeiture(
          account,
          provider,
          gfiToUnvault.amount.mul("-1"),
          capitalToBeRemoved.amount.mul("-1")
        );
        setForfeited({
          token: SupportedCrypto.Fidu,
          amount: estimatedForfeiture,
        });

        setRewardProjection(undefined);
        const projection = await calculateNewMonthlyMembershipReward(
          account,
          provider,
          gfiToUnvault.amount.mul("-1"),
          capitalToBeRemoved.amount.mul("-1")
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
      gfiToUnvault.amount.toString(),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      capitalToBeRemoved.amount.toString(),
    ]
  );

  const onSubmit = async () => {
    if (!account || !provider) {
      throw new Error("Wallet not connected properly");
    }
    const membershipContract = await getContract({
      name: "MembershipOrchestrator",
      provider,
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

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("select");
        reset();
      }, 250);
    }
  }, [isOpen, reset]);

  const [isAgreementRead, setIsAgreementRead] = useState(false);
  const markAgreementRead = useCallback(() => setIsAgreementRead(true), []);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="bg-mustard-300"
      title="Select assets to remove"
      divider={false}
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
                (gfiToUnvault.amount.isZero() &&
                  stakedPositionsToUnvault.length === 0 &&
                  poolTokensToUnvault.length === 0) ||
                (step === "review" && !isAgreementRead)
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
      <Form
        rhfMethods={rhfMethods}
        onSubmit={onSubmit}
        onKeyDown={(e) => {
          // Must prevent Enter from submitting or else the review step would get skipped
          if (e.key === "Enter") {
            e.preventDefault();
          }
        }}
      >
        <div className={step === "select" ? undefined : "hidden"}>
          <div className="mb-8">
            <SectionHeading
              leftText="Step 1: Choose an amount of GFI"
              rightText={formatCrypto({
                token: SupportedCrypto.Gfi,
                amount: sum("amount", vaultedGfi),
              })}
            />
            <GfiBox
              control={control}
              name="gfiToUnvault"
              maxGfi={{
                token: SupportedCrypto.Gfi,
                amount: sum("amount", vaultedGfi),
              }}
              fiatPerGfi={fiatPerGfi}
            />
          </div>
          <div className="mb-8">
            <SectionHeading leftText="Step 2: Choose an amount of capital" />
            <div className="space-y-2">
              <AssetPicker
                options={vaultedStakedPositions.map((vsp) => ({
                  id: vsp.id,
                  asset: {
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
                  },
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
        </div>
        <div className={step === "select" ? "hidden" : undefined}>
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
                  {formatCrypto(sharesToUsdc(forfeited.amount, sharePrice))}
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
            <div className="mt-6 text-sand-500">
              <LegalAgreement onRead={markAgreementRead} />
            </div>
          </div>
        </div>
      </Form>
    </Modal>
  );
}
