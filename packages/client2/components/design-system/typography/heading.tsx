import clsx from "clsx";
import { HTMLAttributes, ComponentType } from "react";

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5;
  as?: string | ComponentType<{ className: string }>;
}

const levelToFontSize = {
  5: "text-3xl",
  4: "text-4xl",
  3: "text-5xl",
  2: "text-6xl",
  1: "text-7xl",
};

export function Heading({ level, as, className, ...rest }: HeadingProps) {
  const Component = as ?? `h${level}`;

  const fontSizeClass = levelToFontSize[level];

  return (
    <Component
      className={clsx(
        "font-serif font-bold tracking-[0.02rem]",
        fontSizeClass,
        className
      )}
      {...rest}
    />
  );
}
