import clsx from "clsx";
import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";

import { Icon, IconProps } from "@/components/designsystem/icon";
import { Spinner } from "@/components/designsystem/spinners";

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
  variant?: "solid";
  /**
   * Determines the coloration of the button, independent from variant
   */
  colorScheme?: "sky" | "eggplant" | "sand";
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
      variant = "solid",
      colorScheme = "sand",
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
          "inline-flex items-center justify-center gap-2 rounded-full font-medium outline-none ring-offset-0 transition-colors focus:ring-1 disabled:pointer-events-none",
          size === "sm"
            ? "py-2.5 px-4 text-xs"
            : size === "md"
            ? "py-3 px-5 text-sm"
            : size === "lg"
            ? "py-3.5 px-6 text-lg"
            : "py-5 px-8 text-xl",
          variant === "solid"
            ? colorScheme === "sky"
              ? "bg-blue-100 text-purple-400 ring-blue-200 hover:bg-blue-200 active:bg-blue-300 disabled:bg-blue-50 disabled:text-opacity-50"
              : colorScheme === "eggplant"
              ? "bg-purple-200 text-white ring-purple-300 hover:bg-purple-300 active:bg-purple-400 disabled:bg-purple-50 disabled:text-purple-200"
              : colorScheme === "sand"
              ? "bg-sand-100 text-purple-400 ring-sand-500 hover:bg-sand-300 active:bg-sand-400 disabled:bg-sand-100 disabled:text-sand-600"
              : null
            : null,
          className
        )}
        {...rest}
      >
        {isLoading ? (
          <Spinner className="!h-[1em] !w-[1em]" />
        ) : iconLeft ? (
          <Icon name={iconLeft} size="sm" />
        ) : null}
        {children}
        {isLoading && iconRight && !iconLeft ? (
          <Spinner className="!h-[1em] !w-[1em]" />
        ) : iconRight ? (
          <Icon name={iconRight} size="sm" />
        ) : null}
      </button>
    );
  }
);
