import { ReactNode } from "react";
import { createPortal } from "react-dom";

import { Nav } from "../nav";

const bannerId = "banner";
const subnavId = "subnav";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <>
      <Nav />
      <div className="relative">
        <div id={bannerId} />
        <div id={subnavId} className="sticky top-0 z-10" />
        <div className="px-5">
          <div className="mx-auto min-h-full max-w-7xl py-14">{children}</div>
        </div>
      </div>
    </>
  );
}

export function SubnavPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.getElementById(subnavId) as Element);
}

export function BannerPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.getElementById(bannerId) as Element);
}
