import clsx from "clsx";
import { forwardRef, ReactNode, SelectHTMLAttributes } from "react";

import { HelperText, Icon } from "@/components/design-system";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /**
   * The options/values of the select element
   */
  children: ReactNode;
  /**
   * Label text that will appear above the select
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
   * Class that goes specifically on the input element, not on the wrapper. Makes it easier to override input-specific styles like placeholder
   */
  inputClassName?: string;
  /**
   * Class that goes specifically on the label element, not on the wrapper. Makes it easier to override label-specific styles.
   */
  labelClassName?: string;
  disabled?: boolean;
  textSize?: "sm" | "md" | "lg" | "xl";
  colorScheme?: "light" | "dark";
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      children,
      label,
      hideLabel = false,
      name,
      id,
      helperText,
      errorMessage,
      disabled = false,
      inputClassName,
      labelClassName,
      className,
      autoComplete = "off",
      colorScheme = "light",
      textSize = "md",
      ...rest
    },
    ref
  ) {
    const _id = id ?? name;
    const isError = !!errorMessage;
    return (
      <div
        className={clsx(
          "flex flex-col items-start justify-start",
          colorScheme === "light"
            ? "text-sand-700"
            : colorScheme === "dark"
            ? "text-white"
            : null,
          textSize === "sm"
            ? "text-sm"
            : textSize === "lg"
            ? "text-lg"
            : textSize === "xl"
            ? "text-2xl"
            : null,
          className
        )}
      >
        <div
          className={clsx(
            "mb-1.5 flex w-full items-center justify-between gap-4 leading-none",
            hideLabel && "sr-only",
            labelClassName
          )}
        >
          <label htmlFor={_id}>{label}</label>
        </div>
        <div className="relative w-full">
          <select
            className={clsx(
              "unfocused w-full appearance-none rounded",
              colorScheme === "light"
                ? [
                    "border bg-white focus:border-sand-600",
                    isError
                      ? "border-clay-100 placeholder:text-clay-700"
                      : "border-sand-200 placeholder:text-sand-500",
                  ]
                : colorScheme === "dark"
                ? [
                    "border bg-sky-900 focus:border-white",
                    isError
                      ? "border-clay-500 placeholder:text-clay-500"
                      : "border-transparent placeholder:text-sand-300",
                  ]
                : null,
              disabled && "opacity-50",
              textSize === "sm"
                ? "py-1.5 pl-3 pr-7"
                : textSize === "md"
                ? "py-2 pl-3 pr-7"
                : textSize === "lg"
                ? "py-3 pl-4 pr-8"
                : textSize === "xl"
                ? "py-4 pl-5 pr-9"
                : null,
              inputClassName
            )}
            ref={ref}
            name={name}
            id={_id}
            disabled={disabled}
            autoComplete={autoComplete}
            {...rest}
          >
            {children}
          </select>

          <Icon
            name="ChevronDown"
            className="absolute right-2 top-1/2 -translate-y-1/2"
          />
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
  }
);
