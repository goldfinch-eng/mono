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

interface AssetGroupProps {
  className?: string;
  assets: Asset[];
  background: "sand" | "gold";
  heading: string;
  buttonText: string;
  onButtonClick: () => void;
  hideButton?: boolean;
  beforeAssets?: ReactNode;
  afterAssets?: ReactNode;
}

export function AssetGroup({
  className,
  assets,
  background,
  heading,
  buttonText,
  onButtonClick,
  hideButton = false,
  beforeAssets = null,
  afterAssets = null,
}: AssetGroupProps) {
  const totalValue = assets.reduce(
    (prev, current) => prev.add(current.usdcAmount.amount),
    BigNumber.from(0)
  );
  return (
    <div
      className={clsx(
        className,
        "space-y-4 rounded-xl border p-5",
        background === "sand"
          ? "border-sand-200 bg-sand-100"
          : "border-mustard-200 bg-mustard-200"
      )}
    >
      <div className="flex items-center justify-between gap-8 text-lg font-semibold">
        <div>{heading}</div>
        <div>
          {formatCrypto(
            { amount: totalValue, token: SupportedCrypto.Usdc },
            { includeSymbol: true, includeToken: false }
          )}
        </div>
      </div>
      {beforeAssets}
      {assets.length === 0 ? null : (
        <div className="flex flex-col items-stretch gap-2">
          {assets.map((asset, index) => (
            <AssetBox key={`${asset.name}-${index}`} asset={asset} />
          ))}
        </div>
      )}
      {afterAssets}
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
  );
}

interface AssetBoxProps {
  asset: Asset;
  omitWrapperStyle?: boolean;
}

export function AssetBox({ asset, omitWrapperStyle = false }: AssetBoxProps) {
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
        <div className="text-lg font-medium">{formatCrypto(usdcAmount)}</div>
      </div>
      <div className="flex justify-between gap-4 text-xs font-medium text-sand-400">
        <div>{description}</div>
        {nativeAmount ? (
          <div>{formatCrypto(nativeAmount, { includeToken: true })}</div>
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
        asset={{
          name: "GFI",
          description: "Goldfinch Token",
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
