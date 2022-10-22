// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

pragma experimental ABIEncoderV2;

interface ISeniorPoolEpochWithdrawals {
  /// @notice id of the epoch (starts at 0)
  /// @notice timestamp when the epoch started
  /// @notice fiduRequested withdrawal demand for this epoch
  /// @notice usdcIn liquidity for this epoch
  struct Epoch {
    uint256 endsAt;
    uint256 fiduRequested;
    uint256 fiduLiquidated;
    uint256 usdcAllocated;
  }

  /// @notice epochCursor id of next epoch the user can liquidate their request
  /// @notice fiduRequested amount left to liquidate at epochCursor-1
  /// @notice usdcWithdrawable amount already liquidated
  struct WithdrawalRequest {
    uint256 epochCursor;
    uint256 usdcWithdrawable;
    uint256 fiduRequested;
  }

  function usdcAvailable() external view returns (uint256);

  /// @notice Current duration of withdrawal epochs, in seconds
  function epochDuration() external view returns (uint256);

  /// @notice Update epoch duration
  function setEpochDuration(uint256 newEpochDuration) external;

  /// @notice Get the epoch at `block.timestamp`
  function currentEpoch() external view returns (Epoch memory);

  /// @notice Get request by tokenId. A request is considered active if epochCursor > 0.
  function withdrawalRequest(uint256 tokenId) external view returns (WithdrawalRequest memory);

  /**
   * @notice Submit a request to withdraw `fiduAmount` of FIDU. Request is rejected
   * if callers already owns a request token. A non-transferrable request token is
   * minted to the caller
   * @return tokenId token minted to caller
   */
  function requestWithdrawal(uint256 fiduAmount) external returns (uint256 tokenId);

  /**
   * @notice Add `fiduAmount` FIDU to a withdrawal request for `tokenId`. Caller
   * must own tokenId
   */
  function addToWithdrawalRequest(uint256 fiduAmount, uint256 tokenId) external;

  /**
   * @notice Cancel request for tokenId. The fiduRequested (minus a fee) is returned
   * to the caller. Caller must own tokenId.
   * @return fiduReceived the fidu amount returned to the caller
   */
  function cancelWithdrawalRequest(uint256 tokenId) external returns (uint256 fiduReceived);

  /**
   * @notice Transfer the usdcWithdrawable of request for tokenId to the caller.
   * Caller must own tokenId
   */
  function claimWithdrawalRequest(uint256 tokenId) external returns (uint256 usdcReceived);

  /// @notice Preview how much usdc would be received if a withdrawal for tokenId were executed
  function previewWithdrawal(uint256 tokenId) external view returns (uint256 usdcReceived);

  event EpochDurationChanged(uint256 newDuration);

  event WithdrawalRequested(
    uint256 indexed epochId,
    address indexed operator,
    address indexed kycAddress,
    uint256 fiduRequested
  );

  event WithdrawalCanceled(
    uint256 indexed epochId,
    address indexed operator,
    address indexed kycAddress,
    uint256 fiduCanceled,
    uint256 reserveFidu
  );

  event EpochEnded(uint256 indexed epochId, uint256 endTime, uint256 usdcAllocated, uint256 fiduLiquidated);
}
