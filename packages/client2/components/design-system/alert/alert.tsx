import clsx from "clsx";
import type { ReactNode } from "react";

import { Icon } from "@/components/design-system";

interface AlertProps {
  children: ReactNode;
  className?: string;
  type: "info" | "warning";
  hasIcon?: boolean;
}

export function Alert({
  children,
  className,
  type,
  hasIcon = true,
}: AlertProps) {
  return (
    <div
      className={clsx(
        "flex items-center gap-2 rounded-lg border-2 p-3 text-xs",
        type === "info"
          ? "border-tidepool-200 bg-tidepool-100 text-tidepool-800"
          : type === "warning"
          ? "border-mustard-100 bg-mustard-50 text-mustard-700"
          : null,
        className
      )}
    >
      {hasIcon ? (
        <Icon
          size="md"
          name={type === "info" ? "InfoCircle" : "Exclamation"}
          className={
            type === "info"
              ? "text-tidepool-600"
              : type === "warning"
              ? "text-mustard-450"
              : ""
          }
        />
      ) : null}
      <div>{children}</div>
    </div>
  );
}
