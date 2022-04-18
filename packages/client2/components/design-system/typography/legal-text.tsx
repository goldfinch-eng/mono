import clsx from "clsx";
import { HTMLAttributes, ComponentType } from "react";

export interface LegalTextProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: string | ComponentType<{ className: string }>;
}

export function LegalText({ as, className, ...rest }: LegalTextProps) {
  const Component = as ?? "p";
  return <Component className={clsx("text-xs", className)} {...rest} />;
}
