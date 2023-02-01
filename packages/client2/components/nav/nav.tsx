import clsx from "clsx";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import { Link, GoldfinchLogo, Icon, Popover } from "@/components/design-system";

import { MobileNav } from "./mobile-nav";
import { MANAGE_SUB_NAV_ITEMS } from "./nav-items";
import { SecondaryMenu } from "./secondary-menu";
import { WalletButton } from "./wallet-button";

function ManageNavOption() {
  const router = useRouter();
  const isManageNavActive = MANAGE_SUB_NAV_ITEMS.map(
    ({ href }) => href
  ).includes(router.pathname);

  return (
    <Popover
      content={() => (
        <div>
          {MANAGE_SUB_NAV_ITEMS.map((item) => (
            <a
              href={item.href}
              key={`secondary-menu-${item.label}`}
              className="flex items-center justify-between py-2 text-sm font-medium hover:underline"
              rel="noreferrer"
            >
              <span className="mr-4">{item.label}</span>
            </a>
          ))}
        </div>
      )}
      trigger="hover"
    >
      <button
        className={clsx(
          "flex cursor-pointer items-center border-b-2 px-5 text-sm font-medium !no-underline",
          isManageNavActive
            ? "border-eggplant-600 text-sand-900"
            : "border-transparent text-sand-700"
        )}
      >
        Manage
        <Icon name="ChevronDown" size="sm" className="ml-0.5" />
      </button>
    </Popover>
  );
}

export function Nav() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  return (
    <>
      <div className="flex flex-row border-b border-sand-100 px-6 md:px-10">
        <div className="self-center md:hidden">
          <button className="p-1" onClick={() => setIsMobileNavOpen(true)}>
            <Icon name="Menu" size="md" />
          </button>
        </div>

        <div className="flex flex-1">
          <NextLink href="/" passHref>
            <a className="flex items-center justify-center p-3">
              <GoldfinchLogo className="h-7 w-7" />
            </a>
          </NextLink>
        </div>

        <nav className="hidden flex-1 flex-row justify-center md:flex">
          {/* {NAV_ITEMS.map(({ label, href }) => (
            <NavLink key={`${label}-${href}`} href={href}>
              {label}
            </NavLink>
          ))} */}
          <NavLink href="/earn">Deals</NavLink>
          <ManageNavOption />
          <NavLink href="/borrow">Borrow</NavLink>
        </nav>

        <div className="flex flex-1 flex-row justify-end gap-3 self-center py-4">
          <WalletButton />
          <SecondaryMenu />
        </div>
      </div>
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
      />
    </>
  );
}

export function NavLink({
  children,
  href,
  className,
}: {
  children: string;
  href: string;
  className?: string;
}) {
  const router = useRouter();
  const isCurrentPage = router.pathname === href;
  return (
    <Link
      className={clsx(
        "flex items-center border-b-2 px-5 text-sm font-medium !no-underline",
        isCurrentPage
          ? "border-eggplant-600 text-sand-900"
          : "border-transparent text-sand-700 hover:border-eggplant-600",
        className
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
