export const MEMBERSHIP_EPOCH_MS = 604800000;

export function epochFinalizedDate(
  currentTimestampMs: number,
  /**
   * 1 = "when the current epoch will finalize"
   */
  epochsFromNow = 1
): Date {
  return new Date(
    (Math.floor(currentTimestampMs / MEMBERSHIP_EPOCH_MS) + epochsFromNow) *
      MEMBERSHIP_EPOCH_MS
  );
}
