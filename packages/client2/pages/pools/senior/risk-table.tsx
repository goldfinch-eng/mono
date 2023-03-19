import {
  Link,
  VerboseTable,
  VerboseTableRowProps,
} from "@/components/design-system";
import { HighValueInvestorNotice } from "@/pages/pools/high-value-investor-notice";

export function RiskTable() {
  const riskTableRows: VerboseTableRowProps[] = [
    {
      heading: "Deal structure",
      boldValue: "Liquidity pool",
      value:
        "The Goldfinch protocol automatically allocates Senior Pool capital across various vetted Borrower Pools. Senior Pool capital is also protected by junior (first loss) capital invested in each individual borrower pool.",
    },
    {
      heading: "On-chain capital priority",
      boldValue: "Senior",
      value: null,
    },
    {
      heading: "Off-chain capital priority",
      boldValue: "Senior",
      value: null,
    },
    {
      heading: "Collateralization",
      boldValue: "Yes",
      value:
        "This loan is secured with real-world, off-chain assets as collateral",
    },
    {
      heading: "Post-close reporting",
      value: (
        <div>
          Investors can access borrower-reported updates via the
          investment-gated{" "}
          <Link
            href="https://discord.com/channels/793925570739044362/1034881143964717066"
            openInNewTab
          >
            Discord channel
          </Link>
        </div>
      ),
    },
    {
      heading: "Legal recourse",
      boldValue: (
        <Link href="/senior-pool-agreement-interstitial" openInNewTab>
          Senior Pool Agreement
        </Link>
      ),
      value: null,
    },
  ];

  return (
    <>
      <VerboseTable rows={riskTableRows} className="mb-4" />
      <HighValueInvestorNotice />
    </>
  );
}
