import { ReactNode } from "react";

import { Footer } from "../footer";
import { Nav } from "../nav";

const bannerId = "banner";
const subnavId = "subnav";

interface LayoutProps {
  children: ReactNode;
}

export function MustardBackgroundLayout({ children }: LayoutProps) {
  return (
    <div className="flex min-h-full flex-col bg-mustard-50">
      <Nav />
      <div className="relative flex-grow">
        <div id={bannerId} />
        <div id={subnavId} />
        <div className="px-5">
          <div className="mx-auto min-h-full max-w-7xl py-7">{children}</div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
