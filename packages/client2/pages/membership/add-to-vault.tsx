import { gql } from "@apollo/client";
import clsx from "clsx";
import { BigNumber } from "ethers";
import { ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Form,
  InfoIconTooltip,
  Link,
  Modal,
} from "@/components/design-system";
import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import {
  CryptoAmount,
  MembershipPageQuery,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { gfiToUsdc, sharesToUsdc, sum } from "@/lib/pools";

import { AssetBox, GfiBox, AssetPicker } from "./asset-box";

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
}: AddToVaultProps) {
  const capitalTotal = {
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
    formState: { errors },
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
  const selectedCapitalTotal = {
    token: SupportedCrypto.Usdc,
    amount: sharesToUsdc(
      sum("amount", stakedPositionsToVault),
      sharePrice
    ).amount.add(sum("principalAmount", poolTokensToVault)),
  };

  const onSubmit = () => {
    alert(
      `Confirming with ${formatCrypto(
        gfiToVault
      )} staked positions ${stakedPositionsToVault
        .map((s) => s.id)
        .join(", ")}, pool tokens ${poolTokensToVault
        .map((p) => p.id)
        .join(", ")}`
    );
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
              colorScheme="primary"
              disabled={Object.keys(errors).length > 0}
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
          <div className="mb-8">
            <SectionHeading
              leftText="Step 1: Choose an amount of GFI"
              rightText={`${formatCrypto(maxVaultableGfi)} available`}
            />
            <GfiBox
              maxGfi={maxVaultableGfi}
              fiatPerGfi={fiatPerGfi}
              name="gfiToVault"
              control={control}
            />
          </div>
          <div className="mb-8">
            <SectionHeading
              leftText="Step 2: Choose an amount of Capital"
              rightText={`${formatCrypto(capitalTotal)} available`}
            />
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
                  asset: {
                    name: "Borrower Pool Position",
                    description: vpt.tranchedPool.name,
                    usdcAmount: {
                      amount: vpt.principalAmount,
                      token: SupportedCrypto.Usdc,
                    },
                  },
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
            </div>
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
                  asset={{
                    name: "Borrower Pool Position",
                    description: p.tranchedPool.name,
                    usdcAmount: {
                      token: SupportedCrypto.Usdc,
                      amount: p.principalAmount,
                    },
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mb-8">
          <SectionHeading leftText="Vault earnings" />
          <TwoGrid>
            <GridItem
              heading="Est. share of member rewards"
              value="0.69%"
              tooltip="The estimated percentage of overall Member Rewards you will receive this cycle, based on what percentage of the Member Vault's overall balance your position represents."
            />
            <GridItem
              heading="Projected member rewards"
              value="$420.69"
              parenthesisText="Monthly avg."
              tooltip="The estimated value of Member Rewards you will receive on an average monthly basis, based on weekly cycle estimates."
            />
            {step === "review" ? (
              <>
                <GridItem
                  heading="Assets active as of"
                  value="October 4"
                  tooltip="The date that your capital will start actively earning Member Rewards in the vault."
                />
                <GridItem
                  heading="First distribution at this rate"
                  value="October 11"
                  tooltip="Lorem ipsum"
                />
              </>
            ) : null}
          </TwoGrid>
          {step === "review" ? (
            <div className="mt-2 text-xs">
              By clicking continue below, I agree to lorem ipsum dolor sit amet,
              consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
              labore et dolore magna aliqua. Ut enim ad minim veniam, quis
              nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
              consequat. Duis aute irure dolor in reprehenderit in voluptate
              velit esse cillum dolore eu fugiat nulla pariatur.
            </div>
          ) : null}
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

function TwoGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-sand-200 bg-sand-200">
      {children}
    </div>
  );
}

function GridItem({
  heading,
  value,
  tooltip,
  parenthesisText,
}: {
  heading: string;
  value: string;
  tooltip?: string;
  parenthesisText?: string;
}) {
  return (
    <div className="bg-white py-6 px-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="text-sm text-sand-600">{heading}</div>
        {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
      </div>
      <div>
        <span className="text-lg font-medium">{value}</span>
        {parenthesisText ? (
          <>
            {" "}
            <span className="text-sm text-sand-500">({parenthesisText})</span>
          </>
        ) : null}
      </div>
    </div>
  );
}
