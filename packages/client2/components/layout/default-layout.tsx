import clsx from "clsx";
import { ReactNode } from "react";

import { Footer } from "../footer";
import { Nav } from "../nav";
import { BANNER_ID, SUBNAV_ID } from "./portals";

interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export function DefaultLayout({ children, className }: LayoutProps) {
  return (
    <div className={clsx("flex min-h-full flex-col", className)}>
      <Nav />
      <div className="relative flex-grow">
        <div id={BANNER_ID} />
        <div id={SUBNAV_ID} />
        <div className="px-5">
          <div className="mx-auto min-h-full max-w-7xl py-7">{children}</div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
