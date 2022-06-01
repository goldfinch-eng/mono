import { useReactiveVar } from "@apollo/client";

import { MobileNav } from "@/components/mobile-nav";

import { closeMobileNav } from "./actions";
import { isMobileNavOpen } from "./vars";

export function MobileNavMenu() {
  const isMobileNavMenuOpen = useReactiveVar(isMobileNavOpen);

  return <MobileNav isOpen={isMobileNavMenuOpen} onClose={closeMobileNav} />;
}
