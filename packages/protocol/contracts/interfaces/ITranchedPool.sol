// SPDX-License-Identifier: MIT
pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;
import {ISchedule} from "./ISchedule.sol";
import {ITranchedPool} from "./ITranchedPool.sol";
import {ILoan} from "./ILoan.sol";
import {ICreditLine} from "./ICreditLine.sol";

interface ITranchedPool is ILoan {
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

  /// @notice TrancheInfo for tranche with id `trancheId`. The senior tranche of slice i has id 2*(i-1)+1. The
  ///   junior tranche of slice i has id 2*i. Slice indices start at 1.
  /// @param trancheId id of tranche. Valid ids are in the range [1, 2*numSlices]
  function getTranche(uint256 trancheId) external view returns (ITranchedPool.TrancheInfo memory);

  /// @notice Get a slice by index
  /// @param index of slice. Valid indices are on the interval [0, numSlices - 1]
  function poolSlices(uint256 index) external view returns (ITranchedPool.PoolSlice memory);

  /// @notice Lock the junior capital in the junior tranche of the current slice. The capital is locked for
  ///   `DrawdownPeriodInSeconds` seconds and gives the senior pool time to decide how much to invest (ensure
  ///   leverage ratio cannot change for the period). During this period the borrower has the option to lock
  ///   the senior capital by calling `lockPool()`. Backers may withdraw their junior capital if the the senior
  ///   tranche has not been locked and the drawdown period has ended. Only the borrower can call this function.
  function lockJuniorCapital() external;

  /// @notice Initialize the next slice for the pool. Enables backers and the senior pool to provide additional
  ///   capital to the borrower.
  /// @param _fundableAt time at which the new slice (now the current slice) becomes fundable
  function initializeNextSlice(uint256 _fundableAt) external;

  /// @notice Query the total capital supplied to the pool's junior tranches
  function totalJuniorDeposits() external view returns (uint256);

  function assess() external;

  /// @notice Get the current number of slices for this pool
  /// @return numSlices total current slice count
  function numSlices() external view returns (uint256);

  // Note: This has to exactly match the even in the TranchingLogic library for events to be emitted
  // correctly
  event SharePriceUpdated(
    address indexed pool,
    uint256 indexed tranche,
    uint256 principalSharePrice,
    int256 principalDelta,
    uint256 interestSharePrice,
    int256 interestDelta
  );
  event CreditLineMigrated(ICreditLine indexed oldCreditLine, ICreditLine indexed newCreditLine);
  event TrancheLocked(address indexed pool, uint256 trancheId, uint256 lockedUntil);
  event SliceCreated(address indexed pool, uint256 sliceId);
}
