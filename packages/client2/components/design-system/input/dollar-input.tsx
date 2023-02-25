import clsx from "clsx";
import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { ComponentProps } from "react";
import { useController, UseControllerProps } from "react-hook-form";
import { IMaskMixin } from "react-imask";

import {
  CURVE_LP_DECIMALS,
  FIDU_DECIMALS,
  GFI_DECIMALS,
  USDC_DECIMALS,
} from "@/constants";
import { formatFiat } from "@/lib/format";
import { SupportedCrypto, SupportedFiat } from "@/lib/graphql/generated";

import { Input } from "./input";

const MaskedInput = IMaskMixin(({ inputRef, ...props }) => {
  // @ts-expect-error ref types don't match because of bad typing
  return <Input ref={inputRef} {...props} />;
});

type Unit = SupportedFiat | SupportedCrypto;

export type DollarInputProps = ComponentProps<typeof Input> &
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UseControllerProps<any> & {
    unit?: Unit;
    /**
     * A BigNumber (or a promise that resolves to a BigNumber) that serves as the value used when the max button is clicked. Note that this is subject to the `unit` prop, and more importantly, this doesn't provide validation. Form validation is still handled through typical React Hook Form functions.
     */
    maxValue?: BigNumber | (() => Promise<BigNumber>);
    /**
     * A callback function that will be invoked after the MAX button is clicked. The argument provided to this function is `maxValue`.
     */
    onMaxClick?: (n?: BigNumber) => void;
    onChange?: (s: string) => void;
  };

const unitProperties: Record<Unit, { mask: string; scale: number }> = {
  USD: { mask: "$amount", scale: 2 },
  USDC: { mask: "$amount USDC", scale: USDC_DECIMALS },
  FIDU: { mask: "amount FIDU", scale: FIDU_DECIMALS },
  GFI: { mask: "amount GFI", scale: GFI_DECIMALS },
  CURVE_LP: {
    mask: "amount FIDU-USDC-F",
    scale: CURVE_LP_DECIMALS,
  },
};

export function DollarInput({
  unit = "USDC",
  maxValue,
  onMaxClick,
  onChange: callbackOnChange,
  name,
  rules,
  control,
  shouldUnregister,
  defaultValue,
  ...rest
}: DollarInputProps) {
  const {
    field: { onChange: rhfOnChange, ref, ...controllerField },
  } = useController({
    name,
    rules,
    control,
    shouldUnregister,
    defaultValue,
  });

  const onChange = (s: string) => {
    rhfOnChange(s);
    callbackOnChange?.(s);
  };

  const refAssigner = (node: { element: HTMLInputElement }) => {
    if (node) {
      ref(node.element);
    }
  };

  return (
    <MaskedInput
      // this is wack man
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={refAssigner as any}
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
                  unit === "USD"
                    ? formatFiat({ symbol: unit, amount: max.toNumber() })
                    : formatUnits(max, unitProperties[unit].scale);
                onChange(formatted);
                onMaxClick?.(max);
              } else {
                onMaxClick?.();
              }
            }}
            className={clsx(
              "block rounded border p-2 text-[10px] font-semibold uppercase leading-none text-white transition-colors",
              rest.colorScheme === "dark"
                ? "border-twilight-500 bg-twilight-700 hover:bg-twilight-800 active:bg-twilight-900"
                : "border-transparent bg-sand-700 hover:bg-sand-800 active:bg-sand-900"
            )}
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
