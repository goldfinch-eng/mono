type NavLink = { label: string; href: string; isNew?: boolean };

export type NestedNav = { label: string; links: NavLink[] };

type Nav = (NavLink | NestedNav)[];

export const DESKTOP_NAV: Nav = [
  { label: "Deals", href: "/earn" },
  {
    label: "Manage",
    links: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Membership", href: "/membership", isNew: true },
      { label: "Claim GFI", href: `/gfi` },
      { label: "Stake", href: `/stake` },
      { label: "Borrow", href: "/borrow" },
    ],
  },
];

export const MOBILE_NAV: NavLink[] = [
  { label: "Deals", href: "/earn" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "Membership", href: "/membership", isNew: true },
  { label: "Claim GFI", href: `/gfi` },
  { label: "Stake", href: `/stake` },
  { label: "Borrow", href: "/borrow" },
];

export const SECONDARY_MENU_ITEMS = [
  {
    label: "Getting started",
    href: "https://docs.goldfinch.finance/goldfinch/guides/getting-started",
  },
  { label: "Governance", href: "https://gov.goldfinch.finance/" },
  { label: "Docs", href: "https://docs.goldfinch.finance/goldfinch/" },
  {
    label: "Discord community",
    href: "https://discord.com/invite/HVeaca3fN8",
  },
  { label: "Bug bounty", href: "https://immunefi.com/bounty/goldfinch/" },
  {
    label: "Smart contract coverage",
    href: "https://app.nexusmutual.io/cover/buy/get-quote?address=0x8481a6EbAf5c7DABc3F7e09e44A89531fd31F822",
  },
  { label: "Careers", href: "https://jobs.lever.co/WarblerLabs/" },
];
