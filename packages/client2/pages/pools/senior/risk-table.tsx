import {
  Link,
  VerboseTable,
  VerboseTableRowProps,
} from "@/components/design-system";
import { HighValueInvestorNotice } from "@/pages/pools/high-value-investor-notice";

// TODO: We need a run through of the content here from product
export function RiskTable() {
  const riskTableRows: VerboseTableRowProps[] = [
    {
      heading: "Deal structure",
      boldValue: "Liquidity pool",
      value:
        "Supply capital to the Senior Pool, and the Goldfinch protocol will automatically diversify the capital across other vetted Goldfinch Borrower Pools",
    },
    {
      heading: "On-chain capital priority",
      boldValue: "Junior",
      value: "First-loss capital",
    },
    {
      heading: "Off-chain capital priority",
      boldValue: "Senior",
      value:
        "If the borrower has received other off-chain funding for this pool, this capital will be prioritized first",
    },
    {
      heading: "Collateralization",
      boldValue: "Yes",
      value:
        "This loan is secured with real-world, off-chain assets as collateral",
    },
    {
      heading: "Post-close reporting",
      boldValue: "Monthly",
      value: (
        <div>
          Investors can access borrower-reported updates via investment-gated{" "}
          <Link href="https://discord.com/invite/HVeaca3fN8" openInNewTab>
            Discord channel
          </Link>
        </div>
      ),
    },
    {
      heading: "Legal recourse",
      boldValue: (
        <Link href="/senior-pool-agreement-interstitial" openInNewTab>
          Loan agreement
        </Link>
      ),
      value:
        "Specifies the loan terms agreed to by the borrower and all investors; legally enforceable off-chain",
    },
  ];

  return (
    <>
      <VerboseTable rows={riskTableRows} className="mb-4" />
      <HighValueInvestorNotice />
    </>
  );
}
