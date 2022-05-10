import clsx from "clsx";
import NextLink from "next/link";
import { useRouter } from "next/router";

import { Link, GoldfinchLogo } from "@/components/design-system";

import { WalletButton } from "./wallet-button";

const navItems = [
  { label: "Earn", href: "/earn" },
  { label: "Borrow", href: "/borrow" },
  { label: "GFI", href: "/gfi" },
];

export function Nav() {
  return (
    <div className="flex flex-row bg-sand-50 px-10">
      <div className="flex flex-1">
        <NextLink href="/" passHref>
          <a className="flex items-center justify-center p-3">
            <GoldfinchLogo className="h-7 w-7" />
          </a>
        </NextLink>
      </div>

      <nav className="flex flex-1 flex-row justify-center">
        {navItems.map(({ label, href }) => (
          <NavLink key={`${label}-${href}`} href={href}>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-1 flex-row justify-end self-center py-4">
        <WalletButton />
      </div>
    </div>
  );
}

function NavLink({ children, href }: { children: string; href: string }) {
  const router = useRouter();
  const isCurrentPage = router.pathname === href;
  return (
    <Link
      className={clsx(
        "flex items-center border-b-2 px-5 text-sm font-medium !no-underline",
        isCurrentPage
          ? "border-eggplant-600 text-sand-900"
          : "border-transparent text-sand-700 hover:border-eggplant-600"
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
