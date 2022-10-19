import { gql } from "@apollo/client";
import clsx from "clsx";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ReactNode, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  Icon,
  IconNameType,
  InfoIconTooltip,
  Modal,
  ModalProps,
} from "@/components/design-system";
import { GFI_DECIMALS } from "@/constants";
import { formatCrypto } from "@/lib/format";
import {
  CryptoAmount,
  MembershipPageQuery,
  SupportedCrypto,
} from "@/lib/graphql/generated";
import { gfiToUsdc, sharesToUsdc, sum } from "@/lib/pools";

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

interface AddToVaultProps extends Omit<ModalProps, "children" | "title"> {
  maxVaultableGfi: CryptoAmount;
  fiatPerGfi: number;
  vaultableStakedPositions: StakedPosition[];
  sharePrice: BigNumber;
  vaultablePoolTokens: PoolToken[];
}

export function AddToVault({
  maxVaultableGfi,
  fiatPerGfi,
  vaultableStakedPositions,
  sharePrice,
  vaultablePoolTokens,
  ...rest
}: AddToVaultProps) {
  const gfiInUsdc = gfiToUsdc(maxVaultableGfi, fiatPerGfi);
  const nftTotal = {
    token: SupportedCrypto.Usdc,
    amount: sharesToUsdc(
      sum("amount", vaultableStakedPositions),
      sharePrice
    ).amount.add(sum("principalAmount", vaultablePoolTokens)),
  };
  const [gfiToVault, setGfiToVault] = useState("0");
  const gfiToVaultAsBigNumber = parseUnits(
    gfiToVault !== undefined && gfiToVault !== "" ? gfiToVault : "0",
    GFI_DECIMALS
  );
  const [stakedPositionsToVault, setStakedPositionsToVault] = useState<
    StakedPosition[]
  >([]);
  const [poolTokensToVault, setPoolTokensToVault] = useState<PoolToken[]>([]);
  const selectedNftTotal = {
    token: SupportedCrypto.Usdc,
    amount: sharesToUsdc(
      sum("amount", stakedPositionsToVault),
      sharePrice
    ).amount.add(sum("principalAmount", poolTokensToVault)),
  };

  const [step, setStep] = useState<0 | 1>(0);

  return (
    <Modal
      {...rest}
      className="bg-sand-100"
      title={step === 0 ? "Select assets to add" : "Confirm transaction"}
      size="sm"
      divider
      footer={
        <div className="flex items-center justify-between">
          <Button
            colorScheme="secondary"
            onClick={step === 0 ? rest.onClose : () => setStep(0)}
          >
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="text-xs">{step + 1} of 2</div>
          <Button
            colorScheme="primary"
            onClick={
              step === 0
                ? () => setStep(1)
                : () =>
                    alert(
                      `Confirming with GFI ${gfiToVault} staked positions ${stakedPositionsToVault
                        .map((s) => s.id)
                        .join(", ")}, pool tokens ${poolTokensToVault
                        .map((p) => p.id)
                        .join(", ")}`
                    )
            }
          >
            {step === 0 ? "Review" : "Confirm"}
          </Button>
        </div>
      }
    >
      <div className={step === 0 ? undefined : "hidden"}>
        <div className="mb-8">
          <SectionHeading
            leftText="Step 1: Choose an amount of GFI"
            rightText={formatCrypto(gfiInUsdc)}
          />
          <GfiBox
            max={maxVaultableGfi}
            maxInUsdc={gfiInUsdc}
            onChange={(s) => setGfiToVault(s)}
            fiatPerGfi={fiatPerGfi}
          />
        </div>
        <SectionHeading
          leftText="Step 2: Choose an amount of TVL"
          rightText={formatCrypto(nftTotal)}
        />
        <div className="mb-8 space-y-2">
          {vaultableStakedPositions.map((stakedPosition) => {
            const checked = stakedPositionsToVault.some(
              (s) => s.id === stakedPosition.id
            );
            return (
              <AssetCheckbox
                key={`staked-position-${stakedPosition.id}`}
                name="Senior Pool Staked Position"
                description="FIDU"
                usdcAmount={sharesToUsdc(stakedPosition.amount, sharePrice)}
                secondaryAmount={{
                  token: SupportedCrypto.Fidu,
                  amount: stakedPosition.amount,
                }}
                checked={checked}
                onChange={() => {
                  if (!checked) {
                    setStakedPositionsToVault([
                      ...stakedPositionsToVault,
                      stakedPosition,
                    ]);
                  } else {
                    setStakedPositionsToVault(
                      removeFromListById(
                        stakedPositionsToVault,
                        stakedPosition.id
                      )
                    );
                  }
                }}
              />
            );
          })}
          {vaultablePoolTokens.map((poolToken) => {
            const checked = poolTokensToVault.some(
              (p) => p.id === poolToken.id
            );
            return (
              <AssetCheckbox
                key={`pool-token-${poolToken.id}`}
                name="Backer Pool Position"
                description={poolToken.tranchedPool.name}
                usdcAmount={{
                  amount: poolToken.principalAmount,
                  token: SupportedCrypto.Usdc,
                }}
                checked={checked}
                onChange={() => {
                  if (!checked) {
                    setPoolTokensToVault([...poolTokensToVault, poolToken]);
                  } else {
                    setPoolTokensToVault(
                      removeFromListById(poolTokensToVault, poolToken.id)
                    );
                  }
                }}
              />
            );
          })}
        </div>
      </div>
      <div className={step === 1 ? undefined : "hidden"}>
        <div className="mb-8">
          <SectionHeading
            leftText="GFI to be added"
            rightText={formatCrypto(
              gfiToUsdc(
                {
                  amount: gfiToVaultAsBigNumber,
                  token: SupportedCrypto.Gfi,
                },
                fiatPerGfi
              )
            )}
          />
          <AssetBox
            name="GFI"
            icon="Gfi"
            description="Goldfinch Token"
            usdcAmount={gfiToUsdc(
              {
                amount: gfiToVaultAsBigNumber,
                token: SupportedCrypto.Gfi,
              },
              fiatPerGfi
            )}
            secondaryAmount={{
              token: SupportedCrypto.Gfi,
              amount: gfiToVaultAsBigNumber,
            }}
          />
        </div>
        <div className="mb-8">
          <SectionHeading
            leftText="TVL to be added"
            rightText={formatCrypto(selectedNftTotal)}
          />
          <div className="space-y-2">
            {stakedPositionsToVault.map((s) => (
              <AssetBox
                key={`senior-pool-position-${s.id}`}
                name="Senior Pool Position"
                description="FIDU"
                usdcAmount={sharesToUsdc(s.amount, sharePrice)}
                secondaryAmount={{
                  token: SupportedCrypto.Fidu,
                  amount: s.amount,
                }}
              />
            ))}
            {poolTokensToVault.map((p) => (
              <AssetBox
                key={`pool-token-${p.id}`}
                name="Backer Pool Position"
                description={p.tranchedPool.name}
                usdcAmount={{
                  token: SupportedCrypto.Usdc,
                  amount: p.principalAmount,
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mb-8">
        <div className="mb-2 text-sm">Vault earnings</div>
        <TwoGrid>
          <GridItem
            heading="Est. share of member rewards"
            value="0.69%"
            tooltip="Lorem ipsum"
          />
          <GridItem
            heading="Projected member rewards"
            value="$420.69"
            parenthesisText="Monthly avg."
            tooltip="Lorem ipsum"
          />
          {step === 1 ? (
            <>
              <GridItem
                heading="Assets active as of"
                value="October 4"
                tooltip="Lorem ipsum"
              />
              <GridItem
                heading="First distribution at this rate"
                value="October 11"
                tooltip="Lorem ipsum"
              />
            </>
          ) : null}
        </TwoGrid>
        {step === 1 ? (
          <div className="mt-2 text-xs">
            By clicking continue below, I agree to lorem ipsum dolor sit amet,
            consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
            labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
            exercitation ullamco laboris nisi ut aliquip ex ea commodo
            consequat. Duis aute irure dolor in reprehenderit in voluptate velit
            esse cillum dolore eu fugiat nulla pariatur.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

function removeFromListById<T extends { id: string }>(
  list: T[],
  idToRemove: string
): T[] {
  return list.filter((item) => item.id !== idToRemove);
}

function SectionHeading({
  leftText,
  rightText,
  className,
}: {
  leftText: string;
  rightText: string;
  className?: string;
}) {
  return (
    <div className={clsx("mb-2 flex justify-between gap-5 text-sm", className)}>
      <div>{leftText}</div>
      <div>{rightText}</div>
    </div>
  );
}

interface AssetCheckboxProps {
  name: string;
  tooltip?: string;
  description: string;
  usdcAmount: CryptoAmount;
  secondaryAmount?: CryptoAmount;
  checked: boolean;
  onChange: () => void;
}

function AssetCheckbox({
  name,
  tooltip,
  description,
  usdcAmount,
  secondaryAmount,
  checked = false,
  onChange,
}: AssetCheckboxProps) {
  return (
    <div
      className={clsx(
        "relative rounded border bg-white py-6 px-5",
        checked ? "border-black" : "border-white"
      )}
    >
      <div className="flex items-start gap-5">
        <Checkbox
          inputSize="md"
          checked={checked}
          onChange={onChange}
          label={name}
          hideLabel
          tabIndex={-1}
        />
        <AssetBox
          name={
            <button
              className="text-lg before:absolute before:inset-0"
              onClick={onChange}
            >
              {name}
            </button>
          }
          description={description}
          tooltip={tooltip}
          usdcAmount={usdcAmount}
          secondaryAmount={secondaryAmount}
          omitWrapperStyle
        />
      </div>
    </div>
  );
}

interface AssetBoxProps {
  name: ReactNode;
  description: string;
  icon?: IconNameType;
  tooltip?: string;
  usdcAmount: CryptoAmount;
  secondaryAmount?: CryptoAmount;
  leftNode?: ReactNode;
  omitWrapperStyle?: boolean;
}

function AssetBox({
  name,
  description,
  icon,
  tooltip,
  usdcAmount,
  secondaryAmount,
  omitWrapperStyle = false,
}: AssetBoxProps) {
  return (
    <div
      className={
        omitWrapperStyle
          ? "w-full"
          : "w-full rounded border border-white bg-white px-5 py-6"
      }
    >
      <div className="mb-1 flex justify-between gap-4">
        <div className="flex items-center gap-2">
          {icon ? <Icon size="md" name={icon} /> : null}
          <div className="text-lg">{name}</div>
          {tooltip ? <InfoIconTooltip content={tooltip} /> : null}
        </div>
        <div className="text-lg font-medium">{formatCrypto(usdcAmount)}</div>
      </div>
      <div className="flex justify-between gap-4 text-xs font-medium text-sand-400">
        <div>{description}</div>
        {secondaryAmount ? (
          <div>{formatCrypto(secondaryAmount, { includeToken: true })}</div>
        ) : null}
      </div>
    </div>
  );
}

interface GfiBoxProps {
  max: CryptoAmount;
  maxInUsdc: CryptoAmount;
  onChange: (s: string) => void;
  fiatPerGfi: number;
}

function GfiBox({ max, maxInUsdc, onChange, fiatPerGfi }: GfiBoxProps) {
  const { control, watch } = useForm<{ gfiToVault: string }>({
    defaultValues: { gfiToVault: "0" },
  });
  const gfiToVault = watch("gfiToVault");
  useEffect(() => {
    onChange(gfiToVault);
  }, [onChange, gfiToVault]);
  const gfiToVaultAsBigNumber = parseUnits(
    gfiToVault !== undefined && gfiToVault !== "" ? gfiToVault : "0",
    GFI_DECIMALS
  );
  return (
    <div
      className={clsx(
        "rounded border bg-white py-6 px-5",
        !gfiToVaultAsBigNumber.isZero() && !gfiToVaultAsBigNumber.isNegative()
          ? "border-black"
          : "border-white"
      )}
    >
      <AssetBox
        omitWrapperStyle
        name="GFI"
        description="Goldfinch Token"
        icon="Gfi"
        secondaryAmount={max}
        usdcAmount={maxInUsdc}
      />
      <DollarInput
        label="GFI Amount"
        hideLabel
        name="gfiToVault"
        control={control}
        className="mt-3"
        textSize="lg"
        unit={SupportedCrypto.Gfi}
        maxValue={max.amount}
        helperText={formatCrypto(
          gfiToUsdc(
            {
              amount: gfiToVaultAsBigNumber,
              token: SupportedCrypto.Gfi,
            },
            fiatPerGfi
          )
        )}
      />
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
