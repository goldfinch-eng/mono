import { ComponentProps } from "react";
import { useController, UseControllerProps } from "react-hook-form";
import { IMaskMixin } from "react-imask";

import { Input } from "./input";

const MaskedInput = IMaskMixin(({ inputRef, ...props }) => {
  // @ts-expect-error ref types don't match because of bad typing
  return <Input ref={inputRef} {...props} />;
});

type DollarInputProps = ComponentProps<typeof Input> &
  UseControllerProps<any> & {
    /**
     * Note that mask must contain "amount" The hard-coded block in this mask revolves around the "amount" key. Example: $amount USDC
     */
    mask?: string;
  };

export function DollarInput({
  mask = "$amount USDC",
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
          scale: 2,
          radix: ".",
        },
      }}
      // @ts-expect-error unmask isn't typed properly in IMaskMixin for some reason
      unmask
      onAccept={onChange}
      lazy={false}
      {...rest}
      {...controllerField}
    />
  );
}
