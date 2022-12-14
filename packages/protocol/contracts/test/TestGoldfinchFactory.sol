// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoldfinchFactory} from "../protocol/core/GoldfinchFactory.sol";
import {ITranchedPool} from "../interfaces/ITranchedPool.sol";
import {ISchedule} from "../interfaces/ISchedule.sol";
import {ImplementationRepository} from "../protocol/core/proxy/ImplementationRepository.sol";
import {MonthlyPeriodMapper} from "../protocol/core/schedule/MonthlyPeriodMapper.sol";
import {Schedule} from "../protocol/core/schedule/Schedule.sol";
import {UcuProxy} from "../protocol/core/proxy/UcuProxy.sol";

contract TestGoldfinchFactory is GoldfinchFactory {
  /// @notice Helper function for testing TranchedPools of different lineages. Not exposed in the real
  /// factory because on mainnet we only want pools from the most recent lineage to be createable.
  function createPoolForLineage(
    address _borrower,
    uint256 _lineageId,
    uint256[] calldata _poolParams,
    uint256[] calldata _allowedUIDTypes
  ) external onlyAdminOrBorrower returns (ITranchedPool) {
    ITranchedPool pool = ITranchedPool(
      address(new UcuProxy(config.getTranchedPoolImplementationRepository(), _borrower, _lineageId))
    );

    ISchedule defaultSchedule = defaultSchedule();

    initializePool(pool, _borrower, _poolParams, defaultSchedule, _allowedUIDTypes);
    emit PoolCreated(pool, _borrower);
    config.getPoolTokens().onPoolCreated(address(pool));
    return pool;
  }

  function defaultSchedule() public returns (ISchedule) {
    return
      createMonthlySchedule({
        periodsInTerm: 12,
        periodsPerInterestPeriod: 1,
        periodsPerPrincipalPeriod: 12,
        gracePrincipalPeriods: 0
      });
  }

  function createMonthlySchedule(
    uint periodsInTerm,
    uint periodsPerPrincipalPeriod,
    uint periodsPerInterestPeriod,
    uint gracePrincipalPeriods
  ) public returns (ISchedule) {
    return
      new Schedule({
        _periodMapper: new MonthlyPeriodMapper(),
        _periodsInTerm: periodsInTerm,
        _periodsPerInterestPeriod: periodsPerInterestPeriod,
        _periodsPerPrincipalPeriod: periodsPerPrincipalPeriod,
        _gracePrincipalPeriods: gracePrincipalPeriods
      });
  }

  /// @notice Helper function to initialize pool. Without this `createPoolForLineage` creates a
  /// "Stack too deep" compiler error (as of version: pragma solidity >=0.6.12;)
  function initializePool(
    ITranchedPool unitializedPool,
    address _borrower,
    uint256[] calldata poolParams,
    // uint256 _juniorFeePercent,
    // uint256 _limit,
    // uint256 _interestApr,
    // uint256 _lateFeeApr,
    // uint256 _fundableAt,
    ISchedule _schedule,
    uint256[] calldata _allowedUIDTypes
  ) internal {
    unitializedPool.initialize(
      address(config),
      _borrower,
      poolParams[0],
      poolParams[1],
      poolParams[2],
      _schedule,
      poolParams[3],
      poolParams[4],
      _allowedUIDTypes
    );
  }
}
