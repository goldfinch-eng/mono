pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {ILoan} from "./ILoan.sol";
import {ISchedule} from "./ISchedule.sol";
import {IGoldfinchConfig} from "./IGoldfinchConfig.sol";

interface ICallableLoan is ILoan {
  /// @param principalDeposited The amount of principal deposited towards this call request period.
  /// @param principalPaid The amount of principal which has already been paid back towards this call request period.
  ///                      There are 3 ways principal paid can enter a CallRequestPeriod.
  ///                      1. Converted from principalReserved after a call request period becomes due.
  ///                      2. Moved from uncalled tranche as the result of a call request.
  ///                      3. Paid directly when a CallRequestPeriod is past due and has a remaining balance.
  /// @param principalReserved The amount of principal reserved for this call request period.
  ///                          Payments to a not-yet-due CallRequestPeriod are applied to principalReserved.
  /// @param interestPaid The amount of interest paid towards this call request period.
  struct CallRequestPeriod {
    uint256 principalDeposited;
    uint256 principalPaid;
    uint256 principalReserved;
    uint256 interestPaid;
  }

  /// @param principalDeposited The amount of uncalled, deposited principal.
  /// @param principalPaid The amount of principal which has already been paid back.
  ///                      There are two ways uncalled principal can be paid.
  ///                      1. Remainder after drawdowns.
  ///                      2. Conversion from principalReserved after a call request period becomes due.
  ///                         All call requested principal outstanding must already be paid
  ///                         (or have principal reserved) before uncalled principal can be paid.
  ///                      3. Paid directly after term end time.
  /// @param principalReserved The amount of principal reserved for uncalled tranche.
  ///                          principalReserved is greedily moved to call request periods (as much as can fill)
  ///                          when a call request is submitted.
  /// @param interestPaid The amount of interest paid towards uncalled capital.
  struct UncalledCapitalInfo {
    uint256 principalDeposited;
    uint256 principalPaid;
    uint256 principalReserved;
    uint256 interestPaid;
  }

  /// @notice Initialize the pool. Can only be called once, and should be called in the same transaction as
  ///   contract creation to avoid initialization front-running
  /// @param _config address of GoldfinchConfig
  /// @param _borrower address of borrower, a non-transferrable role for performing privileged actions like
  ///   drawdown
  /// @param _limit the max USDC amount that can be drawn down across all pool slices
  /// @param _limit the number of periods at the tail end of a principal period during which call requests rollover
  ///   to the next principal period.
  /// @param _interestApr interest rate for the loan
  /// @param _lateFeeApr late fee interest rate for the loan, which kicks in `LatenessGracePeriodInDays` days after a
  ///   payment becomes late
  /// @param _fundableAt earliest time at which the first slice can be funded
  function initialize(
    IGoldfinchConfig _config,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _numLockupPeriods,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) external;

  /// @notice Submits a call request for the specified pool token and amount
  ///         Mints a new, called pool token of the called amount.
  ///         Splits off any uncalled amount as a new uncalled pool token.
  /// @param amountToCall The amount of the pool token that should be called.
  /// @param poolTokenId The id of the pool token that should be called.
  /// @return callRequestedTokenId  Token id of the call requested token.
  /// @return remainingTokenId Token id of the remaining token.
  function submitCall(
    uint256 amountToCall,
    uint256 poolTokenId
  ) external returns (uint256, uint256);

  function schedule() external view returns (ISchedule);

  function nextDueTimeAt(uint256 timestamp) external view returns (uint256);

  function getUncalledCapitalInfo() external view returns (UncalledCapitalInfo memory);

  function getCallRequestPeriod(
    uint callRequestPeriodIndex
  ) external view returns (CallRequestPeriod memory);

  function availableToCall(uint tokenId) external view returns (uint256);

  event CallRequestSubmitted(
    uint256 indexed originalTokenId,
    uint256 indexed callRequestedTokenId,
    uint256 indexed remainingTokenId,
    uint256 callAmount
  );
  event DepositsLocked(address indexed loan);
}
