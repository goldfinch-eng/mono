import clsx from "clsx";
import { forwardRef, InputHTMLAttributes } from "react";

import { Icon, IconNameType, HelperText } from "@/components/design-system";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Label text that will appear above the input
   */
  label: string;
  /**
   * Visually hide the label. Screen readers will still read it.
   */
  hideLabel?: boolean;
  /**
   * The `name` attribute of the input element. This is important to the functionality of standard HTML forms.
   */
  name: string;
  /**
   * The `id` attribute of the input element. This is optional because it will match the `name` prop if not given.
   */
  id?: string;
  /**
   * Helper text that will appear below the input.
   */
  helperText?: string;
  /**
   * Error message that replaces the `helperText` when supplied
   */
  errorMessage?: string;
  /**
   * Class that goes specifically on the <input>, not on the wrapper. Makes it easier to override input-specific styles like placeholder
   */
  inputClassName?: string;
  disabled?: boolean;
  icon?: IconNameType;
  colorScheme?: "light" | "dark";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hideLabel = false,
    name,
    id,
    type = "text",
    helperText,
    errorMessage,
    disabled = false,
    icon,
    inputClassName,
    className,
    autoComplete = "off",
    colorScheme = "light",
    ...rest
  },
  ref
) {
  const _id = id ?? name;
  const isError = !!errorMessage;
  return (
    <div className={clsx("flex flex-col items-start justify-start", className)}>
      <label
        htmlFor={_id}
        className={clsx(
          "mb-1.5 leading-none",
          colorScheme === "light"
            ? "text-sand-700"
            : colorScheme === "dark"
            ? "text-white"
            : null,
          hideLabel && "sr-only"
        )}
      >
        {label}
      </label>
      <div className="relative w-full">
        <input
          className={clsx(
            "unfocused w-full rounded py-2 px-3", // unfocused because the color schemes supply a border color as a focus style
            colorScheme === "light"
              ? [
                  "border bg-white text-sand-700 focus:border-sand-600",
                  isError
                    ? "border-clay-100 placeholder:text-clay-700"
                    : "border-sand-200 placeholder:text-sand-500",
                ]
              : colorScheme === "dark"
              ? [
                  "border bg-sky-900 text-white focus:border-white",
                  isError
                    ? "border-clay-500 placeholder:text-clay-500"
                    : "border-transparent placeholder:text-sand-300",
                ]
              : null,
            disabled && "opacity-50",
            icon ? "pr-8" : null,
            inputClassName
          )}
          ref={ref}
          name={name}
          id={_id}
          type={type}
          disabled={disabled}
          autoComplete={autoComplete}
          {...rest}
        />
        {icon ? (
          <Icon
            name={icon}
            className="absolute right-3.5 top-1/2 -translate-y-1/2"
          />
        ) : null}
      </div>
      {helperText || errorMessage ? (
        <HelperText
          className={clsx(
            isError
              ? "text-clay-500"
              : colorScheme === "light"
              ? "text-sand-500"
              : colorScheme === "dark"
              ? "text-sand-300"
              : null,
            "mt-1 text-sm leading-none"
          )}
        >
          {errorMessage ? errorMessage : helperText}
        </HelperText>
      ) : null}
    </div>
  );
});
