import { ComponentProps } from "react";
import { useController, UseControllerProps } from "react-hook-form";
import { IMaskMixin } from "react-imask";

import { USDC_DECIMALS } from "@/constants";

import { Input } from "./input";

const MaskedInput = IMaskMixin(({ inputRef, ...props }) => {
  // @ts-expect-error ref types don't match because of bad typing
  return <Input ref={inputRef} {...props} />;
});

type DollarInputProps = ComponentProps<typeof Input> &
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  UseControllerProps<any> & {
    /**
     * Note that mask must contain "amount" The hard-coded block in this mask revolves around the "amount" key. Example: $amount USDC
     */
    mask?: string;
    /**
     * If this prop is included, a "MAX" button will be included on the input. When that button is clicked, this callback will be invoked.
     */
    onMaxClick?: () => void;
  };

export function DollarInput({
  mask = "$amount USDC",
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
      mask={mask}
      blocks={{
        amount: {
          mask: Number,
          thousandsSeparator: ",",
          lazy: false,
          scale: USDC_DECIMALS,
          radix: ".",
        },
      }}
      // @ts-expect-error unmask isn't typed properly in IMaskMixin for some reason
      unmask
      onAccept={onChange}
      lazy={false}
      decoration={
        onMaxClick ? (
          <button
            type="button"
            onClick={onMaxClick}
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
