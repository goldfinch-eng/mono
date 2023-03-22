import clsx from "clsx";
import { useRouter } from "next/router";
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
  const { pathname } = useRouter();
  const isMustardBackgroundColor =
    pathname === "/earn" || pathname.startsWith("/pools");
  return (
    <div
      className={clsx(
        "flex min-h-full flex-col",
        isMustardBackgroundColor ? "bg-mustard-50" : "bg-white"
      )}
    >
      <Nav />
      <div className="relative flex-grow">
        <div id={bannerId} />
        <div id={subnavId} />
        <div className="px-5">
          <div className="mx-auto min-h-full max-w-7xl py-14">{children}</div>
        </div>
      </div>
      <Footer />
    </div>
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
