import clsx from "clsx";
import type { ReactNode } from "react";

import { Icon } from "@/components/design-system";

interface AlertProps {
  children: ReactNode;
  className?: string;
  type: "success" | "info" | "warning" | "danger";
}

export function Alert({ children, className, type }: AlertProps) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-lg border-2 p-2 text-xs",
        type === "warning"
          ? "border-mustard-100 bg-mustard-50 text-mustard-700"
          : null,
        className
      )}
    >
      {type === "warning" ? (
        <Icon size="md" name="InfoCircle" className="text-mustard-450" />
      ) : null}
      {children}
    </div>
  );
}
