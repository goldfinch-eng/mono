import clsx from "clsx";
import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";

import { Icon, IconProps, Spinner } from "@/components/design-system";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Content within the button
   */
  children: ReactNode;
  /**
   * Determines the size of the button via padding and font size
   */
  size?: "sm" | "md" | "lg" | "xl";
  /**
   * Determines the overall look of the button. Take advantage of this when you have to present the user with multiple choices on a screen.
   */
  variant?: "standard" | "rounded";
  /**
   * Determines the coloration of the button, independent from variant
   */
  colorScheme?: "primary" | "secondary";
  disabled?: boolean;
  iconLeft?: IconProps["name"];
  iconRight?: IconProps["name"];
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      size = "md",
      variant = "standard",
      colorScheme = "primary",
      iconLeft,
      iconRight,
      isLoading = false,
      className,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center font-medium outline-none transition-colors disabled:pointer-events-none",
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
            ? "bg-sand-700 text-white hover:bg-sand-800 active:bg-sand-900 disabled:bg-sand-100 disabled:text-sand-400"
            : colorScheme === "secondary"
            ? "bg-sand-100 text-sand-700 hover:bg-sand-200 hover:text-sand-900 active:bg-sand-300 active:text-sand-900 disabled:bg-sand-100 disabled:text-sand-400"
            : null,
          className
        )}
        {...rest}
      >
        {isLoading ? (
          <Spinner className="-ml-1 h-5 w-5" />
        ) : iconLeft ? (
          <Icon name={iconLeft} size="sm" className="-ml-1" />
        ) : null}
        {children}
        {isLoading && iconRight && !iconLeft ? (
          <Spinner className="-mr-1 h-5 w-5" />
        ) : iconRight ? (
          <Icon name={iconRight} size="sm" className="-mr-1" />
        ) : null}
      </button>
    );
  }
);
