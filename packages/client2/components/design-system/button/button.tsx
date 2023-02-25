import clsx from "clsx";
import React, {
  forwardRef,
  ButtonHTMLAttributes,
  ReactNode,
  AnchorHTMLAttributes,
} from "react";
import { useFormContext } from "react-hook-form";

import { Icon, IconProps, Spinner } from "@/components/design-system";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    /**
     * Content within the button
     */
    children?: ReactNode;
    /**
     * Determines the size of the button via padding and font size
     */
    size?: "sm" | "md" | "lg" | "xl";
    /**
     * Determines the shape of the button.
     */
    variant?: "standard" | "rounded";
    /**
     * Determines the coloration of the button, independent from variant
     */
    colorScheme?:
      | "primary"
      | "secondary"
      | "sand"
      | "sky"
      | "mustard"
      | "mint"
      | "twilight"
      | "eggplant"
      | "tidepool";
    disabled?: boolean;
    iconLeft?: IconProps["name"];
    iconRight?: IconProps["name"];
    isLoading?: boolean;
    /**
     * The underlying tag to use when rendering this button. By default it is `button`, but can be set to `a` if you need a link that visually looks like a button.
     */
    as?: "button" | "a";
  };

export const Button = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  ButtonProps
>(function Button(
  {
    children,
    size = "md",
    variant = "standard",
    colorScheme = "primary",
    iconLeft,
    iconRight,
    disabled,
    type,
    isLoading = false,
    className,
    as = "button",
    ...rest
  },
  ref
) {
  const formContext = useFormContext();
  let _disabled = disabled;
  let _isLoading = isLoading;
  if (formContext !== null && type === "submit") {
    const {
      formState: { isSubmitting, errors },
    } = formContext;
    const filteredOutWarnings = Object.fromEntries(
      Object.entries(errors).filter(
        ([, value]) => value && value.type !== "warn"
      )
    );
    const isValid = Object.keys(filteredOutWarnings).length === 0;
    _disabled = disabled || isSubmitting || !isValid;
    _isLoading = isSubmitting;
  }

  const Component = as;
  const spinnerOnLeft = _isLoading && iconLeft;
  const spinnerOnRight = _isLoading && !spinnerOnLeft;
  return (
    <Component
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={clsx(
        "inline-flex items-center justify-center font-medium outline-none transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "sm"
          ? "gap-2 py-1 px-3 text-xs"
          : size === "md"
          ? "gap-3 py-2 px-4 text-xs"
          : size === "lg"
          ? "gap-4 py-2.5 px-5 text-sm"
          : size === "xl"
          ? "gap-4 py-4 px-6"
          : null,
        variant === "standard"
          ? "rounded"
          : variant === "rounded"
          ? "rounded-full"
          : null,
        colorScheme === "primary"
          ? "bg-sand-700 text-white hover:bg-sand-800 active:bg-sand-900"
          : colorScheme === "secondary"
          ? "bg-sand-100 text-sand-700 hover:bg-sand-200 hover:text-sand-900 active:bg-sand-300 active:text-sand-900"
          : colorScheme === "sand"
          ? "bg-sand-200 text-sand-700 hover:bg-sand-300 hover:text-sand-900 active:bg-sand-400 active:text-sand-900"
          : colorScheme === "sky"
          ? "bg-sky-800 text-white hover:bg-sky-900 active:bg-sky-900"
          : colorScheme === "mustard"
          ? "bg-mustard-400 text-sand-700 hover:bg-mustard-500 hover:text-sand-900 active:bg-mustard-600 active:text-sand-900"
          : colorScheme === "mint"
          ? "bg-mint-500 text-white hover:bg-mint-600 active:bg-mint-700"
          : colorScheme === "twilight"
          ? "bg-twilight-600 text-white hover:bg-twilight-700 active:bg-twilight-800"
          : colorScheme === "eggplant"
          ? "bg-eggplant-700 text-white hover:bg-eggplant-800 active:bg-eggplant-900"
          : colorScheme === "tidepool"
          ? "bg-tidepool-500 text-white hover:bg-tidepool-600 active:bg-tidepool-700"
          : null,
        className
      )}
      disabled={_disabled}
      type={type}
      {...rest}
    >
      {spinnerOnLeft ? (
        <Spinner size="sm" className={clsx(children ? "-my-2 -ml-1" : null)} />
      ) : iconLeft ? (
        <Icon
          name={iconLeft}
          size="sm"
          className={clsx(children ? "-my-2 -ml-1" : null)}
        />
      ) : null}
      {children}
      {spinnerOnRight ? (
        <Spinner size="sm" className={clsx(children ? "-my-2 -mr-1" : null)} />
      ) : iconRight ? (
        <Icon
          name={iconRight}
          size="sm"
          className={clsx(children ? "-my-2 -mr-1" : null)}
        />
      ) : null}
    </Component>
  );
});

interface IconButtonProps
  extends Omit<ButtonProps, "children" | "iconLeft" | "iconRight"> {
  icon: IconProps["name"];
  /**
   * Accessibility label. Must be provided since this form of button has no visible label.
   */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ icon, size = "md", className, ...rest }, ref) {
    return (
      <Button
        iconRight={icon}
        className={clsx(
          size === "sm"
            ? "!p-0.5"
            : size === "md"
            ? "!p-1.5"
            : size === "lg"
            ? "!p-2.5"
            : size === "xl"
            ? "!p-[1.125rem]"
            : null,
          className
        )}
        {...rest}
        ref={ref}
      />
    );
  }
);
