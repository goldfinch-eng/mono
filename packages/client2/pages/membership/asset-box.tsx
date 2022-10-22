import clsx from "clsx";
import { parseUnits } from "ethers/lib/utils";
import { ReactNode, useEffect } from "react";
import { useForm } from "react-hook-form";

import {
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
interface AssetBoxProps {
  asset: Asset;
  omitWrapperStyle?: boolean;
  /**
   * Whether or not the native token amount should be the primary bolded one in this box
   */
  nativeAmountIsPrimary?: boolean;
  notice?: ReactNode;
  faded?: boolean;
}

export function AssetBox({
  asset,
  omitWrapperStyle = false,
  nativeAmountIsPrimary = false,
  notice,
  faded = false,
}: AssetBoxProps) {
  const { name, description, icon, tooltip, usdcAmount, nativeAmount } = asset;
  const wrapperStyle = clsx(
    "w-full rounded border border-white bg-white px-5 py-6",
    faded ? "opacity-50" : null
  );
  return (
    <div className={omitWrapperStyle ? "w-full" : wrapperStyle}>
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
      {notice ? (
        <div className="mt-6 rounded bg-tidepool-200 p-2 text-center text-xs font-medium">
          {notice}
        </div>
      ) : null}
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
