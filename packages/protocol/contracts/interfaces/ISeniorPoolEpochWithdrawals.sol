// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface ISeniorPoolEpochWithdrawals {
  /// @notice id of the epoch, starting at 0
  /// @notice startsAt timestamp in seconds when the epoch started
  /// @notice sharePrice FIDU share price used to exchange the epoch's FIDU requested for the epoch's USDC in
  /// @notice fiduRequested total withdrawal demand
  /// @notice usdcIn total liquidity in
  /// @notice fiduRemaining FIDU demand not yet serviced through individual withdrawals. On a `withdraw()` this
  ///         decreases by the user's FIDU requested. fiduRemaining is 0 once all users who are elibigle to
  ///         withdraw in this epoch have withdrawn.
  /// @notice usdcRemaining liquidity not yet claimed through individual withdrawals. On a `withdraw()` this
  ///         decreases by the USDC amount withdrawn by the user. usdcRemaining is 0 once all users who are
  ///         eligible to withdraw in this epoch have withdrawn.
  struct Epoch {
    uint256 id;
    uint256 startsAt;
    uint256 sharePrice;
    uint256 fiduRequested;
    uint256 usdcIn;
    uint256 fiduRemaining;
    uint256 usdcRemaining;
  }

  /// @notice epochCursor id of the next epoch the user is eligible to withdraw in
  /// @notice fiduRequested remaining FIDU to liquidate
  /// @notice operator caller that made the request. If the caller is the UID holder then
  ///         the caller is also the operator. If the caller is NOT the UID holder then
  ///         tx.origin MUST be a UID uolder and the caller MUST be approved by tx.origin
  struct WithdrawalRequest {
    uint256 epochCursor;
    uint256 fiduRequested;
    address operator;
  }

  /// @notice Get the epoch at `block.timestamp`
  function currentEpoch() external view returns (Epoch memory);

  /// @notice Get the epoch at `timestamp`. Reverts if there is no epoch at that timestamp. This is a helper function
  ///         for dapps. Avoid calling inside a transaction because the gas cost grows O(log(n)) with the total number
  ///         of epochs.
  function epochAt(uint256 timestamp) external view returns (Epoch memory);

  /// @notice Get info for a requestor. A valid requestor is a UID holder or one of their authorized smart contracts
  function withdrawalRequest(address requestor) external view returns (WithdrawalRequest memory);

  /// @notice Request to withdraw `fiduAmount` FIDU. If the caller has an outstanding request then new requests are
  ///         rejected unless the caller has withdrawn up to the current epoch. The new request is merged with the
  ///         outstanding request
  /// @param fiduAmount amount of FIDU requested to withdraw
  function requestWithdrawal(uint256 fiduAmount) external returns (WithdrawalRequest memory);

  /// @notice Cancel a request and send outstanding FIDU, less the cancelation fee, back to the caller.
  /// @param fiduReceived FIDU transferred back to the caller
  function cancelWithdrawalRequest() external returns (uint256 fiduReceived);

  /// @notice Withdraw available liquidity up to the current epoch
  /// @param usdcReceived USDC transferred to the caller
  function withdraw() external returns (uint256 usdcReceived);

  event WithdrawalMade(address indexed capitalProvider, uint256 amount, uint256 shares, uint256 epoch);
  event WithdrawalRequestMade(address indexed uidHolder, address indexed operator, uint256 fiduRequested);
  event WithdrawalCanceled(address indexed uidHolder, address indexed operator, uint256 fiduCanceled);
}
