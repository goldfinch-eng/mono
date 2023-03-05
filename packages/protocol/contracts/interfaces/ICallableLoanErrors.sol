pragma solidity >=0.8.4;

import {LockState} from "./ICallableLoan.sol";

/// @dev This interface is used to define errors for the CallableLoan contract.
///      Ideally this would be on ICallableLoan, but custom errors are only supported
///      in Solidity version >= 0.8.4, and ICallableLoan requires Solidity 0.6.x conformance.
interface ICallableLoanErrors {
  /*================================================================================
  Drawdowns
  ================================================================================*/
  error CannotDrawdownWhenDrawdownsPaused();
  error DrawdownAmountExceedsDeposits(uint256 drawdownAmount, uint256 existingPrincipalPaid);

  /*================================================================================
  Zero Amounts
  ================================================================================*/
  error ZeroDrawdownAmount();
  error ZeroPaymentAmount();
  error ZeroDepositAmount();
  error ZeroWithdrawAmount();
  error ZeroCallSubmissionAmount();

  /*================================================================================
  Withdrawals
  ================================================================================*/
  error WithdrawAmountExceedsWithdrawable(uint256 withdrawAmount, uint256 withdrawableAmount);
  error InvalidLockState(LockState currentLockState, LockState validLockState);
  error ArrayLengthMismatch(uint256 arrayLength1, uint256 arrayLength2);
  error CannotWithdrawInDrawdownPeriod();
  error NotAuthorizedToWithdraw(address withdrawSender, uint256 tokenId);

  /*================================================================================
  Payments
  ================================================================================*/
  error NoBalanceToPay(uint256 attemptedPrincipalPayment);
  error BalanceOverpayment(uint256 principalPayment, uint256 existingBalance);

  /*================================================================================
  Call Requests
  ================================================================================*/
  error MustSubmitCallToUncalledTranche(uint256 inputTranche, uint256 uncalledTranche);
  error OutOfCallRequestPeriodBounds(uint256 lastCallRequestPeriod);
  error CannotSubmitCallInLockupPeriod();
  error TooLateToSubmitCallRequests();
  error NotAuthorizedToSubmitCall(address callSubmissionSender, uint256 tokenId);
  error InvalidCallSubmissionPoolToken(uint256 tokenId);
  error ExcessiveCallSubmissionAmount(
    uint256 poolTokenId,
    uint256 callSubmissionAmount,
    uint256 maxCallSubmissionAmount
  );
  error InternalTrancheTakeAccountingError(
    uint256 takeAmount,
    uint256 principalDeposited,
    uint256 principalPaid,
    uint256 principalReserved,
    uint256 interestPaid
  );

  /*================================================================================
  Deposits
  ================================================================================*/
  error MustDepositToUncalledTranche(uint256 inputTranche, uint256 uncalledTranche);
  error InvalidUIDForDepositor(address depositor);
  error DepositExceedsLimit(uint deposit, uint amountCurrentlyDeposited, uint limit);

  /*================================================================================
  Miscellaneous
  ================================================================================*/
  error CannotSetAllowedUIDTypesAfterDeposit();
  error RequiresLockerRole(address nonLockerAddress);

  /*================================================================================
  Initialization
  ================================================================================*/
  error NeedsMorePrincipalPeriods(uint256 numPrincipalPeriods, uint256 minimumNumPrincipalPeriods);
  error CannotReinitialize();
  error InvalidNumLockupPeriods(uint256 numLockupPeriods, uint256 periodsPerPrincipalPeriod);

  /*================================================================================
  Timestamps
  ================================================================================*/
  error InputTimestampBeforeCheckpoint(uint256 inputTimestamp, uint256 checkpointedAt);
  error InputTimestampInThePast(uint256 inputTimestamp);
}
