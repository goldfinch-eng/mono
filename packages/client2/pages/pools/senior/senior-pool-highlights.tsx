import { HighlightGrid, Highlight } from "@/components/design-system";

export function SeniorPoolHighlights() {
  return (
    <HighlightGrid>
      <Highlight
        heading="Diversified capital"
        body="The Senior Pool gives Liquidity Providers exposure to a variety of borrowers on the Goldfinch protocol. These borrowers span 25+ countries, and vary in use cases such as asset financing, SME loans and consumer loans. This is intended to serve the passive investor in search of diversified yield generated through real world economic activity."
      />
      <Highlight
        heading="Protected by first-loss capital"
        body="Protected by first-loss capital in each Borrower Pool."
      />
      <Highlight
        heading="Secured"
        body="Overcollaterlaized with real-world off-chain assets."
      />
      <Highlight
        heading="Ongoing monitoring"
        body="Monthly reporting and direct-to-borrower communications."
      />
    </HighlightGrid>
  );
}
