// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;
import {ISchedule} from "./ISchedule.sol";
import {ITranchedPool} from "./ITranchedPool.sol";
import {ICreditLine} from "./ICreditLine.sol";

interface ITranchedPool {
  struct TrancheInfo {
    uint256 id;
    uint256 principalDeposited;
    uint256 principalSharePrice;
    uint256 interestSharePrice;
    uint256 lockedUntil;
  }
  struct PoolSlice {
    TrancheInfo seniorTranche;
    TrancheInfo juniorTranche;
    uint256 totalInterestAccrued;
    uint256 principalDeployed;
  }
  enum Tranches {
    Reserved,
    Senior,
    Junior
  }

  /// @notice Pool's credit line, responsible for managing the loan's accounting variables
  function creditLine() external view returns (ICreditLine);

  /// @notice Time when the pool was initialized. Zero if uninitialized
  function createdAt() external view returns (uint256);

  /// @notice Initialize the pool. Can only be called once, and should be called in the same transaction as
  ///   contract creation to avoid initialization front-running
  /// @param _config address of GoldfinchConfig
  /// @param _borrower address of borrower, a non-transferrable role for performing privileged actions like
  ///   drawdown
  /// @param _juniorFeePercent percent (whole number) of senior interest that gets re-allocated to the junior tranche.
  ///   valid range is [0, 100]
  /// @param _limit the max USDC amount that can be drawn down across all pool slices
  /// @param _interestApr interest rate for the loan
  /// @param _lateFeeApr late fee interest rate for the loan, which kicks in `LatenessGracePeriodInDays` days after a
  ///   payment becomes late
  /// @param _fundableAt earliest time at which the first slice can be funded
  function initialize(
    address _config,
    address _borrower,
    uint256 _juniorFeePercent,
    uint256 _limit,
    uint256 _interestApr,
    ISchedule _schedule,
    uint256 _lateFeeApr,
    uint256 _fundableAt,
    uint256[] calldata _allowedUIDTypes
  ) external;

  /// @notice TrancheInfo for tranche with id `trancheId`. The senior tranche of slice i has id 2*(i-1)+1. The
  ///   junior tranche of slice i has id 2*i. Slice indices start at 1.
  /// @param trancheId id of tranche. Valid ids are in the range [1, 2*numSlices]
  function getTranche(uint256 trancheId) external view returns (ITranchedPool.TrancheInfo memory);

  /**
   * @notice Get the array of all UID types that are allowed to interact with this pool.
   * @return array of UID types
   *
   * @dev This only exists on TranchedPools deployed from Nov 2022 onward
   */
  function getAllowedUIDTypes() external view virtual returns (uint256[] memory);

  /// @notice Pay down the credit line. Excess payments are refunded to the caller
  /// @param amount USDC amount to pay
  /// @return PaymentAllocation info on how the payment was allocated
  /// @dev {this} must be approved by msg.sender to transfer {amount} of USDC
  function pay(uint256 amount) external returns (PaymentAllocation memory);

  /// @notice Pay down the credit line, separating the principal and interest payments. You must pay back all interest
  ///   before paying back principal. Excess payments are refunded to the caller
  /// @param principalPayment USDC amount to pay down principal
  /// @param interestPayment USDC amount to pay down interest
  /// @return PaymentAllocation info on how the payment was allocated
  /// @dev {this} must be approved by msg.sender to transfer {principalPayment} + {interestPayment} of USDC
  function pay(
    uint256 principalPayment,
    uint256 interestPayment
  ) external returns (PaymentAllocation memory);

  /// @notice Compute interest and principal owed on the current balance at a future timestamp
  /// @param timestamp time to calculate up to
  /// @return interestOwed amount of obligated interest owed at `timestamp`
  /// @return interestAccrued amount of accrued interest (not yet owed) that can be paid at `timestamp`
  /// @return principalOwed amount of principal owed at `timestamp`
  function getAmountsOwed(
    uint256 timestamp
  ) external view returns (uint256 interestOwed, uint256 interestAccrued, uint256 principalOwed);

  /// @notice Get a slice by index
  /// @param index of slice. Valid indices are on the interval [0, numSlices - 1]
  function poolSlices(uint256 index) external view returns (ITranchedPool.PoolSlice memory);

  /// @notice Lock the junior capital in the junior tranche of the current slice. The capital is locked for
  ///   `DrawdownPeriodInSeconds` seconds and gives the senior pool time to decide how much to invest (ensure
  ///   leverage ratio cannot change for the period). During this period the borrower has the option to lock
  ///   the senior capital by calling `lockPool()`. Backers may withdraw their junior capital if the the senior
  ///   tranche has not been locked and the drawdown period has ended. Only the borrower can call this function.
  function lockJuniorCapital() external;

  /// @notice Lock the senior capital in the senior tranche of the current slice and reset the lock period of
  ///   the junior capital to match the senior capital lock period. During this period the borrower has the
  ///   option to draw down the pool. Beyond the drawdown period any unused capital is available to withdraw by
  ///   all depositors.
  function lockPool() external;

  /// @notice Initialize the next slice for the pool. Enables backers and the senior pool to provide additional
  ///   capital to the borrower.
  /// @param _fundableAt time at which the new slice (now the current slice) becomes fundable
  function initializeNextSlice(uint256 _fundableAt) external;

  /// @notice Query the total capital supplied to the pool's junior tranches
  function totalJuniorDeposits() external view returns (uint256);

  /// @notice Drawdown the loan. The credit line's balance should increase by the amount drawn down.
  ///   Junior capital must be locked before this function can be called. If senior capital isn't locked
  ///   then this function will lock it for you (convenience to avoid calling lockPool() separately).
  ///   This function should revert if the amount requested exceeds the the current slice's currentLimit
  ///   This function should revert if the caller is not the borrower.
  /// @param amount USDC to drawdown. This amount is transferred to the caller
  function drawdown(uint256 amount) external;

  /// @notice Update `fundableAt` to a new timestamp. Only the borrower can call this.
  function setFundableAt(uint256 newFundableAt) external;

  /// @notice Supply capital to this pool. Caller can't deposit to the junior tranche if the junior pool is locked.
  ///   Caller can't deposit to a senior tranche if the pool is locked. Caller can't deposit if they are missing the
  ///   required UID NFT.
  /// @param tranche id of tranche to supply capital to. Id must correspond to a tranche in the current slice.
  /// @param amount amount of capital to supply
  /// @return tokenId NFT representing your position in this pool
  function deposit(uint256 tranche, uint256 amount) external returns (uint256 tokenId);

  function depositWithPermit(
    uint256 tranche,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external returns (uint256 tokenId);

  /// @notice Query the max amount available to withdraw for tokenId's position
  /// @param tokenId position to query max amount withdrawable for
  /// @return interestRedeemable total interest withdrawable on the position
  /// @return principalRedeemable total principal redeemable on the position
  function availableToWithdraw(
    uint256 tokenId
  ) external view returns (uint256 interestRedeemable, uint256 principalRedeemable);

  /// @notice Withdraw an already deposited amount if the funds are available. Caller must be the owner or
  ///   approved by the owner on tokenId. Amount withdrawn is sent to the caller.
  /// @param tokenId the NFT representing the position
  /// @param amount amount to withdraw (must be <= interest+principal available to withdraw)
  /// @return interestWithdrawn interest withdrawn
  /// @return principalWithdrawn principal withdrawn
  function withdraw(
    uint256 tokenId,
    uint256 amount
  ) external returns (uint256 interestWithdrawn, uint256 principalWithdrawn);

  /// @notice Similar to withdraw but withdraw the max interest and principal available for `tokenId`
  function withdrawMax(
    uint256 tokenId
  ) external returns (uint256 interestWithdrawn, uint256 principalWithdrawn);

  /// @notice Withdraw from multiple tokens
  /// @param tokenIds NFT positions to withdraw. Caller must be an owner or approved on all tokens in the array
  /// @param amounts amounts to withdraw from positions such that amounts[i] is withdrawn from position tokenIds[i]
  function withdrawMultiple(uint256[] calldata tokenIds, uint256[] calldata amounts) external;

  function assess() external;

  /// @notice Get the current number of slices for this pool
  /// @return numSlices total current slice count
  function numSlices() external view returns (uint256);

  /// @notice Result of applying a payment to a v2 pool
  /// @param owedInterestPayment payment portion of interest owed
  /// @param accruedInterestPayment payment portion of accrued (but not yet owed) interest
  /// @param principalPayment payment portion on principal owed
  /// @param additionalBalancePayment payment portion on any balance that is currently owed
  /// @param paymentRemaining payment amount leftover
  struct PaymentAllocation {
    uint256 owedInterestPayment;
    uint256 accruedInterestPayment;
    uint256 principalPayment;
    uint256 additionalBalancePayment;
    uint256 paymentRemaining;
  }
  /// @notice Event emitted on payment
  /// @param payer address that made the payment
  /// @param pool pool to which the payment was made
  /// @param interest amount of payment allocated to interest (obligated + additional)
  /// @param principal amount of payment allocated to principal owed and remaining balance
  /// @param remaining any excess payment amount that wasn't allocated to a debt owed
  /// @param reserve of payment that went to the protocol reserve
  event PaymentApplied(
    address indexed payer,
    address indexed pool,
    uint256 interest,
    uint256 principal,
    uint256 remaining,
    uint256 reserve
  );
  // Note: This has to exactly match the event in the TranchingLogic library for events to be emitted
  // correctly
  event SharePriceUpdated(
    address indexed pool,
    uint256 indexed tranche,
    uint256 principalSharePrice,
    int256 principalDelta,
    uint256 interestSharePrice,
    int256 interestDelta
  );
  event DepositMade(
    address indexed owner,
    uint256 indexed tranche,
    uint256 indexed tokenId,
    uint256 amount
  );
  event WithdrawalMade(
    address indexed owner,
    uint256 indexed tranche,
    uint256 indexed tokenId,
    uint256 interestWithdrawn,
    uint256 principalWithdrawn
  );
  event ReserveFundsCollected(address indexed from, uint256 amount);
  event CreditLineMigrated(ICreditLine indexed oldCreditLine, ICreditLine indexed newCreditLine);
  event DrawdownMade(address indexed borrower, uint256 amount);
  event DrawdownsPaused(address indexed pool);
  event DrawdownsUnpaused(address indexed pool);
  event EmergencyShutdown(address indexed pool);
  event TrancheLocked(address indexed pool, uint256 trancheId, uint256 lockedUntil);
  event SliceCreated(address indexed pool, uint256 sliceId);
}
