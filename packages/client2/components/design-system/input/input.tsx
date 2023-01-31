import clsx from "clsx";
import { forwardRef, InputHTMLAttributes, ReactNode } from "react";
import { useFormContext } from "react-hook-form";

import { Icon, IconNameType, HelperText } from "@/components/design-system";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /**
   * Label text that will appear above the input
   */
  label: ReactNode;
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
   * Error message that replaces the `helperText` when supplied. Please note that this component has special behaviour when it appears inside of a `<Form>` component: it will automatically display error messages associated with its `name`
   */
  errorMessage?: string;
  /**
   * Indicates the severity of the error message. Severity will be automatically determined if this component is in a `<Form>` component. Will be determined to be `warn` if the `type` of the error
   */
  errorSeverity?: "error" | "warn";
  /**
   * Class that goes specifically on the input element, not on the wrapper. Makes it easier to override input-specific styles like placeholder
   */
  inputClassName?: string;
  /**
   * Class that goes specifically on the label element, not on the wrapper. Makes it easier to override label-specific styles.
   */
  labelClassName?: string;
  disabled?: boolean;
  /**
   * An element that will render on the right side of the input. Can be used to create things like a "reveal password" button, or a "max" button
   */
  decoration?: IconNameType | ReactNode;
  /**
   * An element that will render on the right side of the label. Can be used to add extra contextual information like a tooltip.
   */
  labelDecoration?: ReactNode;
  textSize?: "sm" | "md" | "lg" | "xl";
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
    errorSeverity,
    disabled = false,
    decoration,
    labelDecoration,
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
  const formContext = useFormContext();
  const _errorMessage: InputProps["errorMessage"] =
    errorMessage ?? (formContext?.formState.errors[name]?.message as string);
  const _errorSeverity: InputProps["errorSeverity"] = !_errorMessage
    ? undefined
    : errorSeverity
    ? errorSeverity
    : formContext?.formState.errors[name]?.type === "warn"
    ? "warn"
    : "error";

  const _id = id ?? name;
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
          "mb-1.5 flex items-end justify-between gap-4 self-stretch leading-none",
          hideLabel && "sr-only",
          labelClassName
        )}
      >
        <label htmlFor={_id}>{label}</label>
        {labelDecoration ? labelDecoration : null}
      </div>
      <div className="relative w-full">
        <input
          className={clsx(
            "unfocused w-full rounded", // unfocused because the color schemes supply a border color as a focus style
            colorScheme === "light"
              ? [
                  "border bg-white focus:border-sand-600",
                  _errorSeverity === "error"
                    ? "border-clay-100 placeholder:text-clay-700"
                    : "border-sand-200 placeholder:text-sand-500",
                ]
              : colorScheme === "dark"
              ? [
                  "border bg-sky-900 focus:border-white",
                  _errorSeverity === "error"
                    ? "border-clay-500 placeholder:text-clay-500"
                    : "border-transparent placeholder:text-sand-300",
                ]
              : null,
            disabled && "opacity-50",
            decoration ? "pr-8" : null,
            textSize === "sm"
              ? "py-1.5 px-3"
              : textSize === "md"
              ? "py-2 px-3"
              : textSize === "lg"
              ? "px-4 py-3"
              : textSize === "xl"
              ? "px-5 py-4"
              : null,
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
        {typeof decoration === "string" ? (
          <Icon
            name={decoration as IconNameType}
            className="absolute right-3.5 top-1/2 -translate-y-1/2"
          />
        ) : decoration ? (
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
            {decoration}
          </div>
        ) : null}
      </div>
      {helperText || _errorMessage ? (
        <HelperText
          className={clsx(
            _errorSeverity === "error"
              ? "text-clay-500"
              : _errorSeverity === "warn"
              ? "text-mustard-500"
              : colorScheme === "light"
              ? "text-sand-400"
              : colorScheme === "dark"
              ? "text-sand-300"
              : null,
            "mt-1 text-sm leading-none"
          )}
        >
          {_errorMessage ? _errorMessage : helperText}
        </HelperText>
      ) : null}
    </div>
  );
});
