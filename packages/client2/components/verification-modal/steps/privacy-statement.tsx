import clsx from "clsx";

import { Link } from "@/components/design-system";

export function PrivacyStatement({ className }: { className?: string }) {
  return (
    <p className={clsx("text-justify text-xs text-sand-500", className)}>
      All information you provide is kept secure and will not be used for any
      purpose beyond executing your transactions.{" "}
      <Link
        href="https://docs.goldfinch.finance/goldfinch/unique-identity-uid"
        target="_blank"
        rel="noopener"
      >
        Why does Goldfinch KYC?
      </Link>
    </p>
  );
}
