import clsx from "clsx";
import type { ReactNode } from "react";

interface ChipProps {
  children: ReactNode;
  className?: string;
  colorScheme?: "white" | "blue" | "purple" | "yellow";
}

export function Chip({
  children,
  className,
  colorScheme = "white",
}: ChipProps) {
  return (
    <div
      className={clsx(
        "inline-block rounded-full border py-1.5 px-3 text-xs font-medium",
        colorScheme === "white"
          ? "border-eggplant-100 bg-white text-eggplant-700"
          : colorScheme === "blue"
          ? "bg-afternoon text-white"
          : colorScheme === "purple"
          ? "bg-sunrise-02 text-white"
          : colorScheme === "yellow"
          ? "bg-gradient-to-t from-[#F2EDC2] to-[#F1D26E] text-eggplant-800"
          : null,
        className
      )}
    >
      {children}
    </div>
  );
}
