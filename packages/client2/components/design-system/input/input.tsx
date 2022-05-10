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
          isError && "text-red-200",
          "mb-1.5 leading-none",
          hideLabel && "sr-only"
        )}
      >
        {label}
      </label>
      <div className="relative w-full">
        <input
          className={clsx(
            "w-full rounded bg-sand-200 py-2.5 px-3.5 outline-none ring-purple-400 ring-offset-0 placeholder:text-purple-200 focus:ring-2",
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
            isError ? "text-red-200" : "text-purple-200",
            "mt-1 leading-none"
          )}
        >
          {errorMessage ? errorMessage : helperText}
        </HelperText>
      ) : null}
    </div>
  );
});
