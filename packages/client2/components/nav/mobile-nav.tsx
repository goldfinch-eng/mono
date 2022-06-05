import { Dialog, Transition } from "@headlessui/react";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Fragment } from "react";

import { GoldfinchLogo, Icon } from "@/components/design-system";
import { NavLink } from "@/components/nav";
import { WalletButton } from "@/components/nav/wallet-button";

import { NAV_ITEMS } from "./nav-items";

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileNav({ isOpen, onClose }: MobileNavProps) {
  const router = useRouter();

  /**
   * Close menu on route change
   */
  useEffect(() => {
    const handleRouteChange = () => {
      onClose();
    };

    router.events.on("routeChangeStart", handleRouteChange);

    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router, onClose]);

  return (
    <Transition
      show={isOpen}
      as={Fragment}
      enter="duration-150"
      enterFrom="opacity-0"
      enterTo="transition opacity-100"
      leave="duration-150"
      leaveFrom="opacity-100"
      leaveTo="transition opacity-0"
    >
      <Dialog
        open={isOpen}
        onClose={onClose}
        className="fixed left-0 top-0 z-10 flex h-full w-full flex-col bg-white"
      >
        <div className="flex flex-row px-6 md:px-10">
          <div className="self-center md:hidden">
            <button className="p-1" onClick={onClose}>
              <Icon name="X" size="md" />
            </button>
          </div>

          <div className="flex flex-1"></div>

          <div className="flex flex-1 flex-row justify-end self-center py-4">
            <WalletButton />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-6 -mt-15">
            <NextLink href="/" passHref>
              <a className="flex items-center justify-center p-3">
                <GoldfinchLogo className="h-7 w-7" />
              </a>
            </NextLink>
          </div>

          {NAV_ITEMS.map(({ label, href }) => (
            <NavLink key={`${label}-${href}`} href={href} className="my-3 py-3">
              {label}
            </NavLink>
          ))}
        </div>
      </Dialog>
    </Transition>
  );
}
