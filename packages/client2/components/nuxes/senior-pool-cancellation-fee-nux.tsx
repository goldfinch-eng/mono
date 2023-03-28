import { Link } from "../design-system";
import { Nux } from "./nux";

export function SeniorPoolCancellationFeeNux() {
  return (
    <Nux prefix="cancellationfee" version={1}>
      <div className="mb5 text-center">
        In accordance with{" "}
        <Link
          href="https://gov.goldfinch.finance/t/gip-44-temporarily-set-the-withdraw-cancellation-request-fee-to-0/1673"
          openInNewTab
        >
          GIP-44
        </Link>
        , the cancellation fee for Senior Pool withdrawals has been temporarily
        changed to 0.
      </div>
    </Nux>
  );
}
