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
  ///  the caller is also the operator. If the caller is NOT the UID holder then
  ///  tx.origin MUST be a UID uolder and the caller MUST be approved by tx.origin
  struct WithdrawalRequest {
    uint256 epochCursor;
    uint256 fiduRequested;
    address operator;
  }

  /// @notice Get the epoch at `block.timestamp`
  function currentEpoch() external view returns (Epoch memory);

  /// @notice Get request info for a token
  function withdrawalRequest(uint256 tokenId) external view returns (WithdrawalRequest memory);

  /// @notice Request to withdraw `fiduAmount` FIDU. If the caller has an outstanding request then new requests are
  ///   rejected unless the caller has withdrawn up to the current epoch. The new request is merged with the
  ///   outstanding request
  /// @param fiduAmount amount of FIDU requested to withdraw
  /// @return tokenId a non-transferrable NFT representing your request, minted to the caller
  function requestWithdrawal(uint256 fiduAmount) external returns (uint256 tokenId);

  /// @notice Cancel a request and send outstanding FIDU less the cancelation fee back to the caller.
  /// @param tokenId request token
  /// @return fiduReceived FIDU transferred back to the caller
  function cancelWithdrawalRequest(uint256 tokenId) external returns (uint256 fiduReceived);

  /// @notice Withdraw available liquidity up to the current epoch. If there is enough liquidity to fulfill
  ///   your request then the request info is deleted and the token is burned.
  /// @param tokenId request NFT owned by the caller
  /// @return usdcReceived USDC transferred to the caller
  function withdrawV2(uint256 tokenId) external returns (uint256 usdcReceived);

  /// @notice Calculate how much usdc would be received if a withdrawal for tokenId were executed
  function calculateWithdrawal(uint256 tokenId) external view returns (uint256 usdcReceived);

  /// @notice MUST emit for successful requestWithdrawal
  event WithdrawalRequestMade(address indexed operator, address indexed uidHolder, uint256 fiduRequested);

  /// @notice MUST emit for successful cancelWithdrawalRequest
  event WithdrawalCanceled(address indexed operator, address indexed uidHolder, uint256 fiduCanceled);
}
