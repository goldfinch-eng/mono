import { gql } from "@apollo/client";
import { BigNumber } from "ethers";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Form,
  InfoIconTooltip,
  Modal,
} from "@/components/design-system";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import {
  SupportedCrypto,
  VaultedGfiFieldsFragment,
} from "@/lib/graphql/generated";
import { gfiToUsdc, sum } from "@/lib/pools";

import { SectionHeading, Summary } from "./add-to-vault";
import { AssetBox, AssetPicker, GfiBox } from "./asset-box";

export const VAULTED_GFI_FIELDS = gql`
  fragment VaultedGfiFields on VaultedGfi {
    id
    amount
  }
`;

type VaultedStakedPosition = {
  id: string; // positionId
  usdcEquivalent: BigNumber;
  seniorPoolStakedPosition: {
    id: string;
    amount: BigNumber; // FIDU
  };
};

type VaultedPoolToken = {
  id: string;
  usdcEquivalent: BigNumber;
  poolToken: {
    id: string;
    tranchedPool: {
      id: string;
      name: string;
    };
  };
};
interface RemoveFromVaultProps {
  isOpen: boolean;
  onClose: () => void;
  vaultedGfi: VaultedGfiFieldsFragment[];
  fiatPerGfi: number;
  vaultedStakedPositions: VaultedStakedPosition[];
  vaultedPoolTokens: VaultedPoolToken[];
}

export function RemoveFromVault({
  isOpen,
  onClose,
  vaultedGfi,
  fiatPerGfi,
  vaultedStakedPositions,
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
    formState: { errors },
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
  const fakeFidu = {
    token: SupportedCrypto.Fidu,
    amount: gfiToUnvault.amount
      .add(sum("usdcEquivalent", stakedPositionsToUnvault).mul("1000000000000"))
      .add(sum("usdcEquivalent", poolTokensToUnvault).mul("1000000000000")),
  };

  const onSubmit = () => {
    alert(
      `Confirming with ${formatCrypto(
        gfiToUnvault
      )} staked positions ${stakedPositionsToUnvault
        .map((s) => s.id)
        .join(", ")}, pool tokens ${poolTokensToUnvault
        .map((p) => p.id)
        .join(", ")}`
    );
  };

  useEffect(() => {
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
              colorScheme="primary"
              disabled={
                Object.keys(errors).length > 0 ||
                (gfiToUnvault.amount.isZero() &&
                  stakedPositionsToUnvault.length === 0 &&
                  poolTokensToUnvault.length === 0)
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
                  asset: {
                    name: "Borrower Pool Position",
                    description: vpt.poolToken.tranchedPool.name,
                    usdcAmount: {
                      token: SupportedCrypto.Usdc,
                      amount: vpt.usdcEquivalent,
                    },
                  },
                }))}
                control={control}
                name="poolTokensToUnvault"
              />
            </div>
          </div>
          <div className="mb-8">
            <SectionHeading leftText="Projected Member Rewards" />
            <AssetBox
              asset={{
                name: "Estimated Member Rewards",
                description: "(Monthly average)",
                nativeAmount: fakeFidu,
                usdcAmount: {
                  token: SupportedCrypto.Usdc,
                  amount: BigNumber.from(0),
                },
              }}
              changeAmount={{
                token: SupportedCrypto.Usdc,
                amount: BigNumber.from("-100000000"),
              }}
            />
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
              rightText={formatCrypto({
                token: SupportedCrypto.Usdc,
                amount: sum("usdcEquivalent", stakedPositionsToUnvault).add(
                  sum("usdcEquivalent", poolTokensToUnvault)
                ),
              })}
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
                  asset={{
                    name: "Borrower Pool Position",
                    description: vpt.poolToken.tranchedPool.name,
                    usdcAmount: {
                      token: SupportedCrypto.Usdc,
                      amount: vpt.usdcEquivalent,
                    },
                  }}
                />
              ))}
            </div>
          </div>
          <div>
            <SectionHeading leftText="Projected Member Rewards" />
            <Summary>
              <AssetBox
                omitWrapperStyle
                asset={{
                  name: "Estimated Member Rewards",
                  description: "(Monthly average)",
                  nativeAmount: fakeFidu,
                  usdcAmount: {
                    token: SupportedCrypto.Usdc,
                    amount: BigNumber.from(0),
                  },
                }}
                changeAmount={{
                  token: SupportedCrypto.Usdc,
                  amount: BigNumber.from("-100000000"),
                }}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  Rewards forfeited
                  <InfoIconTooltip content="The value of the rewards forfeited for withdrawing from the Member Vault during this weekly cycle. Withdrawing from a Vault before the end of a cycle forfeits all rewards for that cycle." />
                </div>
                <div className="text-lg font-medium text-clay-500">$420.69</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  Changes go into effect
                  <InfoIconTooltip content="Date that your capital will no longer be actively earning Member Rewards in the vault." />
                </div>
                <div className="text-lg font-medium">Immediately</div>
              </div>
            </Summary>
            <div className="mt-2 text-xs">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
              enim ad minim veniam, quis nostrud exercitation ullamco laboris
              nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in
              reprehenderit in voluptate velit esse cillum dolore eu fugiat
              nulla pariatur. Excepteur sint occaecat cupidatat non proident,
              sunt in culpa qui officia deserunt mollit anim id est laborum.
            </div>
          </div>
        </div>
      </Form>
    </Modal>
  );
}
