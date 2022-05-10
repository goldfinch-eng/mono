import { FixedNumber } from "ethers";

import type { CreditLine, TranchedPool } from "@/lib/graphql/generated";

interface PoolStatusProps {
  isPaused: TranchedPool["isPaused"];
  remainingCapacity: TranchedPool["remainingCapacity"];
  fundableAt: TranchedPool["fundableAt"];
  creditLine: {
    balance: CreditLine["balance"];
    termEndTime: CreditLine["termEndTime"];
  };
}

export enum PoolStatus {
  Paused,
  Repaid,
  Full,
  ComingSoon,
  Open,
}

/**
 * Get the current status of the tranched pool
 * @param pool TranchedPool to get the status for
 * @returns the status of the pool
 */
export function getTranchedPoolStatus(pool: PoolStatusProps) {
  if (pool.isPaused) {
    return PoolStatus.Paused;
  } else if (
    pool.creditLine.balance.isZero() &&
    pool.creditLine.termEndTime.gt(0)
  ) {
    return PoolStatus.Repaid;
  } else if (pool.remainingCapacity.isZero()) {
    return PoolStatus.Full;
  } else if (
    pool.creditLine.termEndTime.isZero() &&
    Date.now() / 1000 < parseInt(pool.fundableAt.toString())
  ) {
    return PoolStatus.ComingSoon;
  } else {
    return PoolStatus.Open;
  }
}

export function computeApyFromGfiInFiat(
  apyFromGfiRaw: FixedNumber,
  fiatPerGfi: number
): FixedNumber {
  return apyFromGfiRaw.mulUnsafe(FixedNumber.fromString(fiatPerGfi.toString()));
}
