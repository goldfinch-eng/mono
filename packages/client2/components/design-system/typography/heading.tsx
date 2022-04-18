import clsx from "clsx";
import { HTMLAttributes, ComponentType } from "react";

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5;
  as?: string | ComponentType<{ className: string }>;
}

const levelToFontSize = {
  5: "text-lg",
  4: "text-xl",
  3: "text-2xl",
  2: "text-3xl",
  1: "text-7xl",
};

export function Heading({ level, as, className, ...rest }: HeadingProps) {
  const Component = as ?? `h${level}`;

  const fontSizeClass = levelToFontSize[level];

  return (
    <Component
      className={clsx(
        Component === "h1" ? "font-bold" : null,
        fontSizeClass,
        className
      )}
      {...rest}
    />
  );
}
