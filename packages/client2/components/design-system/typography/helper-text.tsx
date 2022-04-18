import clsx from "clsx";
import { HTMLAttributes, ComponentType } from "react";

export interface HelperTextProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: string | ComponentType<{ className: string }>;
}

export function HelperText({ as, className, ...rest }: HelperTextProps) {
  const Component = as ?? "p";
  return <Component className={clsx("text-sm", className)} {...rest} />;
}
