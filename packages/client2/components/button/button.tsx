import clsx from "clsx";
import React, { forwardRef, HTMLAttributes, ReactNode } from "react";

import { Icon, IconProps } from "@/components/icon";

interface ButtonProps extends HTMLAttributes<HTMLButtonElement> {
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
  colorScheme?: "blue" | "purple" | "sand";
  disabled?: boolean;
  iconLeft?: IconProps["name"];
  iconRight?: IconProps["name"];
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      children,
      size = "md",
      variant = "solid",
      colorScheme = "blue",
      iconLeft,
      iconRight,
      className,
      ...rest
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center gap-2 rounded-md outline-none ring-offset-0 transition-colors focus:ring-1 disabled:pointer-events-none",
          size === "sm"
            ? "py-1.5 px-3"
            : size === "md"
            ? "py-2.5 px-4"
            : size === "lg"
            ? "py-3.5 px-6"
            : "py-5 px-8 text-lg",
          variant === "solid"
            ? colorScheme === "blue"
              ? "bg-blue-100 text-purple-400 ring-blue-200 hover:bg-blue-200 active:bg-blue-300 disabled:bg-blue-50 disabled:text-opacity-50"
              : colorScheme === "purple"
              ? "bg-purple-200 text-white ring-purple-300 hover:bg-purple-300 active:bg-purple-400 disabled:bg-purple-50 disabled:text-purple-200"
              : colorScheme === "sand"
              ? "bg-sand-200 text-purple-400 ring-sand-500 hover:bg-sand-300 active:bg-sand-400 disabled:bg-sand-100 disabled:text-sand-600"
              : null
            : null,
          className
        )}
        {...rest}
      >
        {iconLeft ? <Icon name={iconLeft} /> : null}
        {children}
        {iconRight ? <Icon name={iconRight} /> : null}
      </button>
    );
  }
);
