import { Nux } from "./nux";

export function SeniorPoolCancellationFeeNux() {
  return (
    <Nux prefix="cancellationfee" version={1}>
      <div className="mb5 text-center">
        In accordance with{" "}
        <a
          className="underline"
          href="https://gov.goldfinch.finance/t/gip-44-temporarily-set-the-withdraw-cancellation-request-fee-to-0/1673"
        >
          GIP-44
        </a>
        , the cancellation fee for Senior Pool withdrawals has been temporarily
        changed to 0.
      </div>
    </Nux>
  );
}
