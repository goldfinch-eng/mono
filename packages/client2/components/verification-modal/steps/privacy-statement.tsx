import clsx from "clsx";

import { Link } from "@/components/design-system";

export function PrivacyStatement({ className }: { className?: string }) {
  return (
    <p className={clsx("text-justify text-xs text-sand-400", className)}>
      All information you provide is kept secure and will not be used for any
      purpose beyond executing your supply request.{" "}
      <Link href="https://docs.goldfinch.finance/goldfinch/unique-identity-uid">
        Why does Goldfinch KYC?
      </Link>
    </p>
  );
}
