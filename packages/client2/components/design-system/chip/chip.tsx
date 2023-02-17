import clsx from "clsx";
import type { ReactNode } from "react";

import { Icon, IconNameType } from "../icon";

interface ChipProps {
  children: ReactNode;
  className?: string;
  colorScheme?:
    | "white"
    | "blue"
    | "purple"
    | "yellow"
    | "green"
    | "sand"
    | "transparent"
    | "mint";
  iconLeft?: IconNameType;
}

export function Chip({
  children,
  className,
  colorScheme = "white",
  iconLeft,
}: ChipProps) {
  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 rounded-full border py-1.5 px-3 text-xs font-medium",
        colorScheme === "white"
          ? "border-eggplant-100 bg-white text-eggplant-700"
          : colorScheme === "blue"
          ? "bg-afternoon text-white"
          : colorScheme === "purple"
          ? "bg-sunrise-02 text-white"
          : colorScheme === "yellow"
          ? "bg-gradient-to-t from-[#F2EDC2] to-[#F1D26E] text-eggplant-800"
          : colorScheme === "green"
          ? "bg-gradient-to-t from-grass-500 to-grass-600 text-white"
          : colorScheme === "sand"
          ? "border-0 bg-sand-100 text-sand-700"
          : colorScheme === "transparent"
          ? "border-eggplant-100 bg-transparent text-sand-700"
          : colorScheme === "mint"
          ? "border-mint-50 bg-mint-50 text-mint-600"
          : null,
        className
      )}
    >
      {iconLeft ? <Icon size="sm" name={iconLeft} /> : null}
      {children}
    </div>
  );
}
