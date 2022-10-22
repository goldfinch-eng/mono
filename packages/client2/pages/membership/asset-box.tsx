import clsx from "clsx";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ReactNode, useEffect } from "react";
import { useForm } from "react-hook-form";

import {
  Button,
  Checkbox,
  DollarInput,
  Icon,
  IconNameType,
  InfoIconTooltip,
} from "@/components/design-system";
import { GFI_DECIMALS } from "@/constants";
import { formatCrypto } from "@/lib/format";
import { CryptoAmount, SupportedCrypto } from "@/lib/graphql/generated";
import { gfiToUsdc } from "@/lib/pools";

export interface Asset {
  name: ReactNode;
  description: string;
  tooltip?: string;
  icon?: IconNameType;
  usdcAmount: CryptoAmount;
  nativeAmount?: CryptoAmount;
}

export interface AssetGroup {
  groupName: string;
  assets: Asset[];
}

interface AssetGroupProps {
  className?: string;
  assetGroups: AssetGroup[];
  background: "sand" | "gold";
  heading: string;
  buttonText: string;
  onButtonClick: () => void;
  hideButton?: boolean;
}

export function AssetGroup({
  className,
  assetGroups,
  background,
  heading,
  buttonText,
  onButtonClick,
  hideButton = false,
}: AssetGroupProps) {
  const totalValue = assetGroups.reduce(
    (prev, current) =>
      prev.add(
        current.assets.reduce(
          (prev, current) => prev.add(current.usdcAmount.amount),
          BigNumber.from(0)
        )
      ),
    BigNumber.from(0)
  );
  return (
    <div
      className={clsx(
        className,
        "rounded-xl border",
        background === "sand"
          ? "border-sand-200 bg-sand-100"
          : "border-mustard-200 bg-mustard-200"
      )}
    >
      <div
        className={clsx(
          "flex items-center justify-between gap-8 p-5 text-lg font-medium",
          assetGroups.length > 0
            ? clsx(
                "border-b",
                background === "sand" ? "border-sand-300" : "border-mustard-300"
              )
            : null
        )}
      >
        <div>{heading}</div>
        <div>
          {formatCrypto(
            { amount: totalValue, token: SupportedCrypto.Usdc },
            { includeSymbol: true, includeToken: false }
          )}
        </div>
      </div>
      <div
        className={assetGroups.length !== 0 || !hideButton ? "p-5" : undefined}
      >
        {assetGroups.length === 0 ? (
          <div className="p-5">No assets available</div>
        ) : (
          <div className="flex flex-col items-stretch gap-6">
            {assetGroups.map((assetGroup) => (
              <div key={assetGroup.groupName}>
                <div className="mb-2 flex justify-between gap-4 text-sm">
                  <div>{assetGroup.groupName}</div>
                  <div>
                    {formatCrypto({
                      token: SupportedCrypto.Usdc,
                      amount: assetGroup.assets.reduce(
                        (prev, current) => prev.add(current.usdcAmount.amount),
                        BigNumber.from(0)
                      ),
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  {assetGroup.assets.map((asset, index) => (
                    <AssetBox key={`${asset.name}-${index}`} asset={asset} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {hideButton ? null : (
          <Button
            className="mt-4 w-full"
            colorScheme={background === "sand" ? "primary" : "mustard"}
            size="xl"
            onClick={onButtonClick}
          >
            {buttonText}
          </Button>
        )}
      </div>
    </div>
  );
}

interface AssetBoxProps {
  asset: Asset;
  omitWrapperStyle?: boolean;
  /**
   * Whether or not the native token amount should be the primary bolded one in this box
   */
  nativeAmountIsPrimary?: boolean;
}

export function AssetBox({
  asset,
  omitWrapperStyle = false,
  nativeAmountIsPrimary = false,
}: AssetBoxProps) {
  const { name, description, icon, tooltip, usdcAmount, nativeAmount } = asset;
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
        <div className="text-lg font-medium">
          {formatCrypto(
            nativeAmountIsPrimary && nativeAmount ? nativeAmount : usdcAmount
          )}
        </div>
      </div>
      <div className="flex justify-between gap-4 text-xs font-medium text-sand-400">
        <div>{description}</div>
        {nativeAmount ? (
          <div>
            {formatCrypto(nativeAmountIsPrimary ? usdcAmount : nativeAmount)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface AssetCheckboxProps {
  asset: Asset;
  checked: boolean;
  onChange: () => void;
}

export function AssetCheckbox({
  asset,
  checked = false,
  onChange,
}: AssetCheckboxProps) {
  const { name, tooltip, description, usdcAmount, nativeAmount } = asset;
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
          label={name as string}
          hideLabel
          tabIndex={-1}
        />
        <AssetBox
          asset={{
            name: (
              <button
                className="text-lg before:absolute before:inset-0"
                onClick={onChange}
              >
                {name}
              </button>
            ),
            description,
            tooltip,
            usdcAmount,
            nativeAmount,
          }}
          omitWrapperStyle
        />
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

export function GfiBox({ max, maxInUsdc, onChange, fiatPerGfi }: GfiBoxProps) {
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
        nativeAmountIsPrimary
        asset={{
          name: "GFI",
          description: "Governance Token",
          icon: "Gfi",
          usdcAmount: maxInUsdc,
          nativeAmount: max,
        }}
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
