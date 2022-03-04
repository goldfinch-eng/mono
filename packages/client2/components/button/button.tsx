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
  size?: "sm" | "md" | "lg";
  /**
   * Determines the overall look of the button. Take advantage of this when you have to present the user with multiple choices on a screen.
   */
  variant?: "solid"; // TODO add more variants
}

export function Button({
  children,
  size = "md",
  variant = "solid",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        size === "sm" ? "py-2 px-3" : size === "md" ? "py-3 px-4" : "py-4 px-5",
        variant === "solid" ? "bg-blue-100 text-purple-400" : null,
        "rounded-xl",
        "transition-shadow hover:shadow active:brightness-75",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
