import { isMobileNavOpen } from "../vars";

export function openMobileNav() {
  isMobileNavOpen(true);
}

export function closeMobileNav() {
  isMobileNavOpen(false);
}
