pragma solidity >=0.6.12;

import {ILoan} from "./ILoan.sol";
import {ISchedule} from "./ISchedule.sol";

interface ICallableLoan is ILoan {
  // TODO: Update with final `initialize` interface once CallableLoan removes ITranchedPool conformance
  /// @notice Initialize the pool. Can only be called once, and should be called in the same transaction as
  ///   contract creation to avoid initialization front-running
  /// @param _config address of GoldfinchConfig
  /// @param _borrower address of borrower, a non-transferrable role for performing privileged actions like
  ///   drawdown
  /// @param _limit the max USDC amount that can be drawn down across all pool slices
  /// @param _interestApr interest rate for the loan
  /// @param _lateFeeApr late fee interest rate for the loan, which kicks in `LatenessGracePeriodInDays` days after a
  ///   payment becomes late
  /// @param _fundableAt earliest time at which the first slice can be funded
  function initialize(
    address _config,
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) external;

  // function initialize(
  //   address _config,
  //   address _borrower,
  //   uint256 _limit,
  //   uint256 _interestApr,
  //   ISchedule _schedule,
  //   uint256 _lateFeeApr,
  //   uint256 _fundableAt,
  //   uint256[] calldata _allowedUIDTypes
  // ) public;

  /// @notice Submits a call request for the specified pool token and amount
  ///         Mints a new, called pool token of the called amount.
  ///         Splits off any uncalled amount as a new uncalled pool token.
  /// @param amountToCall The amount of the pool token that should be called.
  /// @param poolTokenId The id of the pool token that should be called.
  function submitCall(uint256 amountToCall, uint256 poolTokenId) external;

  function schedule() external view returns (ISchedule);

  function nextDueTimeAt(uint256 timestamp) external view returns (uint256);

  event CallRequestSubmitted(
    uint256 indexed originalTokenId,
    uint256 indexed callRequestedTokenId,
    uint256 indexed remainingTokenId,
    uint256 callAmount
  );
  event DepositsLocked(address indexed loan);
}
