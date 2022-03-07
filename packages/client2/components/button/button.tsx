import clsx from "clsx";
import React from "react";
import { HTMLAttributes } from "react";

interface ButtonProps extends HTMLAttributes<HTMLButtonElement> {
  /**
   * Content within the button
   */
  children: string | number;
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
}

export function Button({
  children,
  size = "md",
  variant = "solid",
  colorScheme = "blue",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        size === "sm"
          ? "py-1.5 px-3"
          : size === "md"
          ? "py-2.5 px-4"
          : size === "lg"
          ? "py-3.5 px-6"
          : "py-5 px-8 text-lg",
        "outline-none ring-offset-0 focus:ring-1 disabled:pointer-events-none",
        variant === "solid"
          ? colorScheme === "blue"
            ? "bg-blue-100 text-purple-400 ring-blue-200 hover:bg-blue-200 active:bg-blue-300 disabled:bg-blue-50 disabled:text-opacity-50"
            : colorScheme === "purple"
            ? "bg-purple-200 text-white ring-purple-300 hover:bg-purple-300 active:bg-purple-400 disabled:bg-purple-50 disabled:text-purple-200"
            : colorScheme === "sand"
            ? "bg-sand-200 text-purple-400 ring-sand-500 hover:bg-sand-300 active:bg-sand-400 disabled:bg-sand-100 disabled:text-sand-600"
            : null
          : null,
        "rounded-md",
        "transition-all hover:shadow active:brightness-75",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
