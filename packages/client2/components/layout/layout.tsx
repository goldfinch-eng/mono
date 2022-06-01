import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Footer } from "../footer";
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
      <Footer />
    </>
  );
}

// Portals don't work properly during server-rendering, because `document` doesn't exist, so this workaround is necessary.
function ClientOnlyPortal({
  selector,
  children,
}: {
  selector: string;
  children: ReactNode;
}) {
  const [isMountedOnClient, setIsMountedOnClient] = useState(false);
  useEffect(() => {
    setIsMountedOnClient(true);
  }, []);
  return isMountedOnClient ? (
    createPortal(children, document.querySelector(selector) as Element)
  ) : (
    <>{children}</>
  );
}

export function SubnavPortal({ children }: { children: ReactNode }) {
  return (
    <ClientOnlyPortal selector={`#${subnavId}`}>{children}</ClientOnlyPortal>
  );
}

export function BannerPortal({ children }: { children: ReactNode }) {
  return (
    <ClientOnlyPortal selector={`#${bannerId}`}>{children}</ClientOnlyPortal>
  );
}
