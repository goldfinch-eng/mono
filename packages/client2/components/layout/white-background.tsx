import { ReactNode } from "react";

import { Footer } from "../footer";
import { Nav } from "../nav";
import { BANNER_ID, SUBNAV_ID } from "./portals";

interface LayoutProps {
  children: ReactNode;
}

export function WhiteBackgroundLayout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-full flex-col bg-white">
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
