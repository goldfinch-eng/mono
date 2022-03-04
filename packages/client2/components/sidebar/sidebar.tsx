import clsx from "clsx";
import { useRouter } from "next/router";

import { Link } from "@/components/link";
import { GoldfinchLogo } from "@/components/logo";

const navItems = [
  { label: "Earn", href: "/earn" },
  { label: "Borrow", href: "/borrow" },
  { label: "GFI", href: "/gfi" },
  { label: "Transactions", href: "/transactions" },
];

export function Sidebar() {
  return (
    <div className="flex flex-row items-center justify-between gap-8 bg-sand-100 p-4 md:min-w-[180px] md:flex-col md:items-stretch md:justify-start md:pr-0">
      <GoldfinchLogo className="h-7 w-7 self-start" />
      <nav className="flex flex-row gap-2 text-lg md:flex-col">
        {navItems.map(({ label, href }) => (
          <NavLink key={`${label}-${href}`} href={href}>
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function NavLink({ children, href }: { children: string; href: string }) {
  const router = useRouter();
  const isCurrentPage = router.pathname === href;
  return (
    <Link
      className={clsx(
        isCurrentPage
          ? "border-purple-400 font-bold md:border-r-4"
          : "opacity-50 hover:opacity-100",
        "p-1 !no-underline"
      )}
      href={href}
    >
      {children}
    </Link>
  );
}
