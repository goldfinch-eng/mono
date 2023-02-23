import { HighlightGrid, Highlight } from "@/components/design-system";

export function SeniorPoolHighlights() {
  return (
    <HighlightGrid>
      <Highlight
        heading="Diversified capital"
        body="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
      />
      <Highlight
        heading="Secured"
        body="Collateralized with real-world (off-chain) assets"
      />
      <Highlight
        heading="Real-world recourse"
        body="Real-world, legally enforceable loan agreement"
      />
      <Highlight
        heading="Ongoing monitoring"
        body="Monthly reporting and direct-to-borrower communications"
      />
    </HighlightGrid>
  );
}
