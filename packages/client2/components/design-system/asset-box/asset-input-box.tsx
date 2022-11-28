import clsx from "clsx";
import { BigNumber } from "ethers";
import { useFormContext } from "react-hook-form";

import { formatCrypto, stringToCryptoAmount } from "@/lib/format";
import { SupportedCrypto } from "@/lib/graphql/generated";
import { gfiToUsdc, sharesToUsdc } from "@/lib/pools";

import { DollarInputProps, DollarInput } from "../input";
import { AssetBox, Asset } from "./asset-box";

type AssetInputBoxProps = Omit<DollarInputProps, "hideLabel" | "unit"> & {
  asset: Asset;
  /**
   * Including this optional prop while the asset's nativeAmount is in GFI will cause the helperText to show how much has been entered as a USDC amount
   */
  sharePrice?: BigNumber;
  /**
   * Including this optional prop while the asset's nativeAmount is in FIDU will cause the helperText to show how much has been entered as a USDC amount
   */
  fiatPerGfi?: number;
};

export function AssetInputBox({
  asset,
  sharePrice,
  fiatPerGfi,
  ...rest
}: AssetInputBoxProps) {
  const unit = asset.nativeAmount?.token ?? SupportedCrypto.Usdc;
  const maxValue =
    rest.maxValue ?? asset.nativeAmount?.amount ?? asset.usdcAmount.amount;
  const formContext = useFormContext();
  if (!formContext) {
    throw new Error(
      "AssetInputBox expects to be used inside a FormContext Place it inside a <Form>."
    );
  }
  const { watch } = formContext;
  const parsedValue = stringToCryptoAmount(watch(rest.name), unit);

  const helperText =
    fiatPerGfi && unit === SupportedCrypto.Gfi
      ? formatCrypto(gfiToUsdc(parsedValue, fiatPerGfi as number))
      : sharePrice && unit === SupportedCrypto.Fidu
      ? formatCrypto(sharesToUsdc(parsedValue.amount, sharePrice))
      : undefined;

  const validate = async (value: string) => {
    const parsed = stringToCryptoAmount(value, unit);
    if (parsed.amount.isNegative()) {
      return "Cannot be negative";
    }
    const _maxValue =
      typeof maxValue === "function" ? await maxValue() : maxValue;
    if (parsed.amount.gt(_maxValue)) {
      return "Exceeds maximum amount";
    }
  };
  return (
    <div
      className={clsx(
        "rounded border bg-white py-6 px-5",
        parsedValue.amount.isZero() ? "border-white" : "border-black"
      )}
    >
      <AssetBox omitWrapperStyle nativeAmountIsPrimary asset={asset} />
      <DollarInput
        hideLabel
        className="mt-3"
        textSize="lg"
        unit={unit}
        maxValue={maxValue}
        helperText={helperText}
        {...rest}
        rules={{
          ...rest.rules,
          validate: {
            ASSET_INPUT_BOX_INTERNAL_VALIDATION: validate,
            ...rest.rules?.validate,
          },
        }}
      />
    </div>
  );
}
