pragma solidity >=0.8.4;
pragma experimental ABIEncoderV2;

import {LockState} from "./ICallableLoan.sol";

/// @dev This interface is used to define errors for the CallableLoan contract.
///      Ideally this would be on ICallableLoan, but custom errors are only supported
///      in Solidity version >= 0.8.4, and ICallableLoan requires Solidity 0.6.x conformance.
interface ICallableLoanErrors {
  /*================================================================================
  Errors
  ================================================================================*/
  error InvalidNumLockupPeriods(uint256 numLockupPeriods, uint256 periodsPerPrincipalPeriod);
  error NotAuthorizedToSubmitCall(address callSubmissionSender, uint256 tokenId);
  error InvalidCallSubmissionPoolToken(uint256 tokenId);
  error InvalidCallSubmissionAmount(uint256 callSubmissionAmount);
  error CannotWithdrawInDrawdownPeriod();
  error ArrayLengthMismatch(uint256 arrayLength1, uint256 arrayLength2);
  error CannotDrawdownWhenDrawdownsPaused();
  error CannotSetAllowedUIDTypesAfterDeposit();
  error ZeroDrawdownAmount();
  error ZeroPaymentAmount();
  error ZeroDepositAmount();
  error ZeroWithdrawAmount();
  error NotAuthorizedToWithdraw(address withdrawSender, uint256 tokenId);
  error RequiresLockerRole(address nonLockerAddress);
  error InputTimestampInThePast(uint256 inputTimestamp);
  error MustSubmitCallToUncalledTranche(uint256 inputTranche, uint256 uncalledTranche);
  error MustDepositToUncalledTranche(uint256 inputTranche, uint256 uncalledTranche);
  error InvalidUIDForDepositor(address depositor);
  error OutOfCallRequestPeriodBounds(
    uint256 inputCallRequestPeriodIndex,
    uint256 lastCallRequestPeriod
  );
  error NotYetFundable(uint256 fundableAt);
  error WithdrawAmountExceedsWithdrawable(uint256 withdrawAmount, uint256 withdrawableAmount);
  error InvalidLockState(LockState currentLockState, LockState validLockState);
}
