// SPDX-License-Identifier: MIT

pragma solidity >=0.8.19;

/**
 * @title ConfigOptions
 * @notice A central place for enumerating the configurable options of our GoldfinchConfig contract
 * @author Goldfinch
 */

library ConfigOptions {
  // NEVER EVER CHANGE THE ORDER OF THESE!
  // You can rename or append. But NEVER change the order.
  enum Numbers {
    ReserveDenominator,
    LatenessGracePeriodInDays,
    DrawdownPeriodInSeconds
  }
  /// @dev TrustedForwarder is deprecated because we no longer use GSN. CreditDesk
  ///   and Pool are deprecated because they are no longer used in the protocol.
  enum Addresses {
    GoldfinchFactory,
    USDC,
    TreasuryReserve,
    ProtocolAdmin,
    GoldfinchConfig,
    PoolTokens,
    Go,
    MonthlyScheduleRepo,
    CreditLineBeacon,
    TranchedPoolBeacon,
    CallableLoanBeacon
  }
}
