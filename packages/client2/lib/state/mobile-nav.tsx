/**
 * The general rule of thumb for deciding whether or not to place a modal in here is simply that it should be in here if it serves a purpose that shows up in multiple places throughout the app.
 */
import { useReactiveVar } from "@apollo/client";

import { MobileNav } from "@/components/mobile-nav";

import { closeMobileNav } from "./actions";
import { isMobileNavOpen } from "./vars";

export function MobileNavMenu() {
  const isMobileNavMenuOpen = useReactiveVar(isMobileNavOpen);

  return <MobileNav isOpen={isMobileNavMenuOpen} onClose={closeMobileNav} />;
}
