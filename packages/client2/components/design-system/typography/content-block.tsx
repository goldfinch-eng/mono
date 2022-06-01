import type { ReactNode } from "react";

interface ContentBlockProps {
  children: ReactNode;
}

export function ContentBlock({ children }: ContentBlockProps) {
  return <div className="prose mx-auto">{children}</div>;
}
