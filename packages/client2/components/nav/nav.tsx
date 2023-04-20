import clsx from "clsx";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { forwardRef, useState } from "react";

import { Link, GoldfinchLogo, Icon, Popover } from "@/components/design-system";

import { AccountButton } from "./account-button";
import { MobileNav } from "./mobile-nav";
import { DESKTOP_NAV, NestedNav } from "./nav-items";
import { SecondaryMenu } from "./secondary-menu";
import { WalletButton } from "./wallet-button";

function Nested({ nested }: { nested: NestedNav }) {
  const router = useRouter();
  const isNestedNavActive = nested.links
    .map(({ href }) => href)
    .includes(router.pathname);

  return (
    <Popover
      trigger="hover"
      offset={-2}
      content={
        <div>
          {nested.links.map(({ label, href, isNew }) => {
            return (
              <div key={`secondary-menu-${label}`} className="flex">
                <NextLink passHref href={href}>
                  <a
                    className={clsx(
                      "flex items-center justify-between py-2 text-sm font-medium hover:underline",
                      isNew ? "mr-1" : "mr-4"
                    )}
                  >
                    {label}
                  </a>
                </NextLink>
                {isNew && (
                  <span className="pt-1.5 text-[10px] font-semibold text-mustard-500">
                    NEW
                  </span>
                )}
              </div>
            );
          })}
        </div>
      }
    >
      <TopLevelNavItem hasChevron highlighted={isNestedNavActive}>
        {nested.label}
      </TopLevelNavItem>
    </Popover>
  );
}

export function Nav() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  return (
    <>
      <div className="flex flex-row border-b border-sand-300 px-6 md:px-10">
        <div className="mr-3 self-center md:hidden">
          <button
            className="-ml-1 p-1"
            onClick={() => setIsMobileNavOpen(true)}
          >
            <Icon name="Menu" size="md" />
          </button>
        </div>

        <div className="flex flex-1">
          <NextLink href="/" passHref>
            {/* padding + negative margin keeps the clickable area big, but keeps the actual logo the correct distance from the left edge */}
            <a className="-ml-3 flex items-center justify-center p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mustard-300">
                <GoldfinchLogo className="h-5 w-5" />
              </div>
            </a>
          </NextLink>

          <nav className="ml-8 hidden justify-center md:flex">
            {DESKTOP_NAV.map((navItem) => {
              if ("href" in navItem) {
                return (
                  <TopLevelNavItem key={navItem.label} href={navItem.href}>
                    {navItem.label}
                  </TopLevelNavItem>
                );
              } else {
                return <Nested key={navItem.label} nested={navItem} />;
              }
            })}
          </nav>
        </div>

        <div className="flex flex-1 flex-row justify-end gap-3 self-center py-4">
          <AccountButton />
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

export const TopLevelNavItem = forwardRef<
  HTMLButtonElement,
  {
    children: string;
    href?: string;
    className?: string;
    highlighted?: boolean;
    hasChevron?: boolean;
  }
>(function TopLevelNavItem(
  {
    children,
    href,
    className,
    highlighted = false,
    hasChevron = false,
    ...rest
  },
  ref
) {
  const router = useRouter();
  const _highlighted = highlighted || router.pathname === href;
  const cl = clsx(
    "flex items-center border-b-2 px-5 py-4 text-sm font-medium !no-underline -mb-px", // the negative margin allows this border to overlap the nav's own bottom border
    _highlighted
      ? "border-mustard-500 text-sand-900"
      : "border-transparent text-sand-700 hover:border-mustard-500",
    className
  );
  if (href) {
    return (
      <Link className={cl} href={href}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} className={cl} type="button" {...rest}>
      {children}
      {hasChevron ? (
        <Icon name="ChevronDown" size="sm" className="ml-0.5" />
      ) : null}
    </button>
  );
});
