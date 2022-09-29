import { BigNumber } from "ethers";
import { ComponentProps } from "react";
import { useController, UseControllerProps } from "react-hook-form";
import { IMaskMixin } from "react-imask";

import {
  CURVE_LP_DECIMALS,
  FIDU_DECIMALS,
  GFI_DECIMALS,
  USDC_DECIMALS,
} from "@/constants";
import { formatCrypto, formatFiat } from "@/lib/format";
import { SupportedCrypto, SupportedFiat } from "@/lib/graphql/generated";

import { Input } from "./input";

const MaskedInput = IMaskMixin(({ inputRef, ...props }) => {
  // @ts-expect-error ref types don't match because of bad typing
  return <Input ref={inputRef} {...props} />;
});

type Unit = SupportedFiat | SupportedCrypto;

type DollarInputProps = ComponentProps<typeof Input> &
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UseControllerProps<any> & {
    unit?: Unit;
    /**
     * A BigNumber (or a promise that resolves to a BigNumber) that serves as the value used when the max button is clicked. Note that this is subject to the `unit` prop.
     */
    maxValue?: BigNumber | (() => Promise<BigNumber>);
    /**
     * A callback function that will be invoked after the MAX button is clicked. The argument provided to this function is `maxValue`
     */
    onMaxClick?: (n?: BigNumber) => void;
  };

const unitProperties: Record<Unit, { mask: string; scale: number }> = {
  [SupportedFiat.Usd]: { mask: "$amount", scale: 2 },
  [SupportedCrypto.Usdc]: { mask: "$amount USDC", scale: USDC_DECIMALS },
  [SupportedCrypto.Fidu]: { mask: "amount FIDU", scale: FIDU_DECIMALS },
  [SupportedCrypto.Gfi]: { mask: "amount GFI", scale: GFI_DECIMALS },
  [SupportedCrypto.CurveLp]: {
    mask: "amount FIDU-USDC-F",
    scale: CURVE_LP_DECIMALS,
  },
};

export function DollarInput({
  unit = SupportedCrypto.Usdc,
  maxValue,
  onMaxClick,
  name,
  rules,
  control,
  shouldUnregister,
  defaultValue,
  ...rest
}: DollarInputProps) {
  const {
    field: { onChange, ...controllerField },
  } = useController({
    name,
    rules,
    control,
    shouldUnregister,
    defaultValue,
  });

  return (
    <MaskedInput
      mask={unitProperties[unit].mask}
      blocks={{
        amount: {
          mask: Number,
          thousandsSeparator: ",",
          lazy: false,
          scale: unitProperties[unit].scale,
          radix: ".",
        },
      }}
      // @ts-expect-error unmask isn't typed properly in IMaskMixin for some reason
      unmask
      onAccept={onChange}
      lazy={false}
      decoration={
        maxValue || onMaxClick ? (
          <button
            type="button"
            onClick={async () => {
              if (maxValue) {
                const max =
                  typeof maxValue === "function" ? await maxValue() : maxValue;
                const formatted: string =
                  unit === SupportedFiat.Usd
                    ? formatFiat({ symbol: unit, amount: max.toNumber() })
                    : formatCrypto(
                        { token: unit, amount: max },
                        {
                          useMaximumPrecision: true,
                          includeSymbol: false,
                          includeToken: false,
                        }
                      );
                onChange(formatted.replaceAll(",", ""));
                onMaxClick?.(max);
              } else {
                onMaxClick?.();
              }
            }}
            className="block rounded-md border border-sky-500 p-2 text-[10px] uppercase leading-none"
          >
            Max
          </button>
        ) : undefined
      }
      {...rest}
      {...controllerField}
    />
  );
}
