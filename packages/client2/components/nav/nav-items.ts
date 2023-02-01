type NavItem = {
  label: string;
  href: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Earn", href: "/earn" },
  { label: "Borrow", href: "/borrow" },
  { label: "GFI", href: `/gfi` },
  { label: "Stake", href: `/stake` },
];

export const MANAGE_SUB_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Membership", href: "/membership" },
  { label: "Claim GFI", href: `/gfi` },
  { label: "Stake", href: `/stake` },
];

export const SECONDARY_MENU_ITEMS = [
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
