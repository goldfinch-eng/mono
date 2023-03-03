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
      heading: "LTV ratio",
      boldValue: "110%",
      value: "This loan is overcollateralized",
    },
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
      heading: "Securitization",
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
          <Link href="https://google.ca" openInNewTab>
            Discord channel
          </Link>
        </div>
      ),
    },
    {
      heading: "Legal recourse",
      boldValue: (
        <Link href="https://google.ca" openInNewTab>
          Loan agreement
        </Link>
      ),
      value:
        "Specifies the loan terms agreed to by the borrower and all investors; legally enforceable off-chain",
    },
    {
      heading: "Borrower communications",
      value: (
        <div>
          The Borrower can be contacted directly using a token-gated Discord
          channel{" "}
          <Link href="https://google.ca" openInNewTab>
            Discord channel
          </Link>
        </div>
      ),
    },
    {
      heading: "Due diligence",
      value: (
        <div>
          Additional due diligence information can be viewed in the{" "}
          <Link href="https://google.ca" openInNewTab>
            Data room
          </Link>{" "}
          or by contacting the borrower directly using a KYC-gated{" "}
          <Link href="https://google.ca" openInNewTab>
            Discord channel
          </Link>
        </div>
      ),
    },
  ];

  return (
    <>
      <VerboseTable rows={riskTableRows} className="mb-4" />
      <HighValueInvestorNotice />
    </>
  );
}
