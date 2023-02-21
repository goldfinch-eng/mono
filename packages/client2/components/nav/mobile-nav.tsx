import { Dialog, Transition } from "@headlessui/react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { Fragment } from "react";

import { Icon } from "@/components/design-system";
import { TopLevelNavItem } from "@/components/nav";
import { WalletButton } from "@/components/nav/wallet-button";

import { MOBILE_NAV } from "./nav-items";

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

        <div className="flex flex-col">
          {MOBILE_NAV.map(({ label, href }) => {
            const showNewText = href === "/membership";

            return (
              <div key={`secondary-menu-${label}`} className="flex">
                <TopLevelNavItem
                  key={`${label}-${href}`}
                  href={href}
                  className="my-3 ml-6 w-fit py-3 px-0 text-3xl"
                >
                  {label}
                </TopLevelNavItem>
                {showNewText && (
                  <span className="ml-2 pt-6 text-sm font-semibold text-mustard-500">
                    NEW
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Dialog>
    </Transition>
  );
}
