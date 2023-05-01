import clsx from "clsx";
import { ReactNode } from "react";

import { Footer } from "../footer";
import { Nav } from "../nav";
import { BANNER_ID, SUBNAV_ID } from "./portals";

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function NakedLayout({ children, className }: LayoutProps) {
  return (
    <div className={clsx("flex min-h-full flex-col bg-mustard-50", className)}>
      <Nav />
      <div className="relative flex-grow">
        <div id={BANNER_ID} />
        <div id={SUBNAV_ID} />
        <div className="min-h-full">{children}</div>
      </div>
      <Footer />
    </div>
  );
}
