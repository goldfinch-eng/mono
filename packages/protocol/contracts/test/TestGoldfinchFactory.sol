// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {GoldfinchFactory} from "../protocol/core/GoldfinchFactory.sol";
import {ITranchedPool} from "../interfaces/ITranchedPool.sol";
import {ImplementationRepository} from "../protocol/core/proxy/ImplementationRepository.sol";
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
    initializePool(pool, _borrower, _poolParams, _allowedUIDTypes);
    emit PoolCreated(pool, _borrower);
    config.getPoolTokens().onPoolCreated(address(pool));
    return pool;
  }

  /// @notice Helper function to initialize pool. Without this `createPoolForLineage` creates a
  /// "Stack too deep" compiler error (as of version: pragma solidity >=0.6.12;)
  function initializePool(
    ITranchedPool unitializedPool,
    address _borrower,
    uint256[] calldata _poolParams,
    uint256[] calldata _allowedUIDTypes
  ) internal {
    unitializedPool.initialize(
      address(config),
      _borrower,
      _poolParams[0],
      _poolParams[1],
      _poolParams[2],
      _poolParams[3],
      _poolParams[4],
      _poolParams[5],
      _poolParams[6],
      _poolParams[7],
      _allowedUIDTypes
    );
  }
}
