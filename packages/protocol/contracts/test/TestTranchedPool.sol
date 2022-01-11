// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../interfaces/IERC20withDec.sol";
import "../protocol/core/GoldfinchConfig.sol";
import "../protocol/core/ConfigHelper.sol";
import "../protocol/core/TranchedPool.sol";

contract TestTranchedPool is TranchedPool {
  function _collectInterestAndPrincipal(
    address from,
    uint256 interest,
    uint256 principal
  ) public {
    collectInterestAndPrincipal(from, interest, principal);
  }

  function _setSeniorTranchePrincipalDeposited(uint256 principalDeposited) public {
    poolSlices[poolSlices.length - 1].seniorTranche.principalDeposited = principalDeposited;
  }

  function _setLimit(uint256 limit) public {
    creditLine.setLimit(limit);
  }

  function _modifyJuniorTrancheLockedUntil(uint256 lockedUntil) public {
    poolSlices[poolSlices.length - 1].juniorTranche.lockedUntil = lockedUntil;
  }
}
