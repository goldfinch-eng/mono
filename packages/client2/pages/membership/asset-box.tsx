import clsx from "clsx";
import { BigNumber } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { ReactNode, useState } from "react";
import { useController, UseControllerProps } from "react-hook-form";

import {
  Checkbox,
  DollarInput,
  DollarInputProps,
  Icon,
  IconNameType,
  InfoIconTooltip,
  Shimmer,
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
  changeAmount?: CryptoAmount;
}

export function AssetBox({
  asset,
  omitWrapperStyle = false,
  nativeAmountIsPrimary = false,
  notice,
  faded = false,
  changeAmount,
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
        <div className="flex items-center">
          <div className="text-lg font-medium">
            {formatCrypto(
              nativeAmountIsPrimary && nativeAmount ? nativeAmount : usdcAmount
            )}
          </div>
          {changeAmount && !changeAmount.amount.isZero() ? (
            <div
              className={clsx(
                "ml-1 text-sm",

                changeAmount.amount.isNegative()
                  ? "text-clay-500"
                  : "text-mint-450"
              )}
            >
              ({formatCrypto(changeAmount)})
              <Icon
                size="xs"
                name={
                  changeAmount.amount.isNegative() ? "ArrowDown" : "ArrowUp"
                }
              />
            </div>
          ) : null}
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

export function AssetBoxPlaceholder({
  asset = {},
}: {
  asset?: Partial<Asset>;
}) {
  const { name, description, usdcAmount, nativeAmount } = asset;
  return (
    <div className="w-full rounded border border-white bg-white px-5 py-6">
      <div className="mb-1 flex justify-between gap-4">
        {name ? (
          <div className="text-lg">{name}</div>
        ) : (
          <Shimmer style={{ width: "16ch" }} />
        )}
        {usdcAmount ? (
          <div className="text-lg font-medium">{formatCrypto(usdcAmount)}</div>
        ) : (
          <Shimmer style={{ width: "10ch" }} />
        )}
      </div>
      <div className="flex justify-between gap-4 text-xs font-medium text-sand-400">
        {description ? (
          <div>{description}</div>
        ) : (
          <Shimmer style={{ width: "32ch" }} />
        )}
        {nativeAmount ? (
          <div>{formatCrypto(nativeAmount)}</div>
        ) : (
          <Shimmer style={{ width: "16ch" }} />
        )}
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
                type="button"
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

type GfiBoxProps = Omit<
  DollarInputProps,
  "label" | "hideLabel" | "textSize" | "unit"
> & {
  maxGfi: CryptoAmount;
  fiatPerGfi: number;
};

export function GfiBox({ maxGfi, fiatPerGfi, ...rest }: GfiBoxProps) {
  const [usdcEquivalent, setUsdcEquivalent] = useState<CryptoAmount>({
    token: SupportedCrypto.Usdc,
    amount: BigNumber.from(0),
  });
  const validate = (value: string) => {
    const gfi = parseUnits(!value || value === "" ? "0" : value, GFI_DECIMALS);
    if (gfi.isNegative()) {
      return "Cannot be negative";
    }
    if (gfi.gt(maxGfi.amount)) {
      return "Exceeds maximum amount";
    }
  };
  return (
    <div
      className={clsx(
        "rounded border bg-white py-6 px-5",
        usdcEquivalent.amount.isZero() ? "border-white" : "border-black"
      )}
    >
      <AssetBox
        omitWrapperStyle
        nativeAmountIsPrimary
        asset={{
          name: "GFI",
          description: "Governance Token",
          icon: "Gfi",
          usdcAmount: gfiToUsdc(maxGfi, fiatPerGfi),
          nativeAmount: maxGfi,
        }}
      />
      <DollarInput
        label="GFI Amount"
        hideLabel
        className="mt-3"
        textSize="lg"
        unit={SupportedCrypto.Gfi}
        maxValue={maxGfi.amount}
        helperText={formatCrypto(usdcEquivalent)}
        onChange={(s) =>
          setUsdcEquivalent(
            gfiToUsdc(
              {
                token: SupportedCrypto.Gfi,
                amount: parseUnits(
                  (s as string) === "" ? "0" : (s as string),
                  GFI_DECIMALS
                ),
              },
              fiatPerGfi
            )
          )
        }
        {...rest}
        rules={{ validate }}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AssetPickerProps = UseControllerProps<any> & {
  options: { id: string; asset: Asset }[];
};

export function AssetPicker({
  options,
  ...useControllerProps
}: AssetPickerProps) {
  const {
    field: { onChange, value },
  } = useController<Record<string, string[]>>({
    defaultValue: [],
    ...useControllerProps,
  });
  return (
    <div className="space-y-2">
      {options.map((option) => {
        const checked = value.includes(option.id);
        return (
          <AssetCheckbox
            key={option.id}
            asset={option.asset}
            checked={checked}
            onChange={() => {
              if (!checked) {
                onChange([...value, option.id]);
              } else {
                onChange(value.filter((v) => v !== option.id));
              }
            }}
          />
        );
      })}
    </div>
  );
}
