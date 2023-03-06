import { Icon, Link } from "@/components/design-system";

export function HighValueInvestorNotice() {
  return (
    <div className="flex justify-between gap-2 rounded-lg bg-mustard-200 p-3 text-xs text-mustard-800">
      <div className="flex items-center gap-2">
        <Icon name="DollarSolid" className="text-mustard-500" size="sm" />
        <div>
          Investors depositing <span className="font-medium">$250,000+</span>{" "}
          should get in touch for additional information
        </div>
      </div>
      <Link
        href="mailto:hi@goldfinch.finance"
        iconRight="ArrowTopRight"
        className="whitespace-nowrap"
      >
        Learn more
      </Link>
    </div>
  );
}
