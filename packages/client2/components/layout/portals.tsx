import { ReactNode, useState, useEffect } from "react";
import { createPortal } from "react-dom";

export const BANNER_ID = "banner";
export const SUBNAV_ID = "subnav";

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
    <ClientOnlyPortal selector={`#${SUBNAV_ID}`}>{children}</ClientOnlyPortal>
  );
}

export function BannerPortal({ children }: { children: ReactNode }) {
  return (
    <ClientOnlyPortal selector={`#${BANNER_ID}`}>{children}</ClientOnlyPortal>
  );
}
