import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface SubnavPortalProps {
  children: ReactNode;
}

export function SubnavPortal({ children }: SubnavPortalProps) {
  const SUBNAV_ID = "#subnav";

  return createPortal(children, document.getElementById(SUBNAV_ID) as Element);
}
