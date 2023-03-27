import { Nux } from "./nux";

export function SeniorPoolCancellationFeeNux() {
  return (
    <Nux prefix="cancellationfee" version={1}>
      <div className="mb5 text-center">
        In accordance with GIP-44, the cancellation fee for Senior Pool
        withdrawals has been temporarily changed to 0.
      </div>
    </Nux>
  );
}
