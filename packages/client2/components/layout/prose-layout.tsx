import type { ReactNode } from "react";

interface ProseLayoutProps {
  children: ReactNode;
}

export function ProseLayout({ children }: ProseLayoutProps) {
  return <div className="prose mx-auto">{children}</div>;
}
