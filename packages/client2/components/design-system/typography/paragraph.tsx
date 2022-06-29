import clsx from "clsx";
import { HTMLAttributes, ComponentType } from "react";

export interface ParagraphProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: string | ComponentType<{ className: string }>;
}

export function Paragraph({ as, className, ...rest }: ParagraphProps) {
  const Component = as ?? "p";
  return <Component className={clsx("text-base", className)} {...rest} />;
}
