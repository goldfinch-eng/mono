// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "./IFund.sol";
import "./ITranchedPool.sol";

abstract contract IFundStrategy {
  function invest(IFund fund, ITranchedPool pool) public view virtual returns (uint256 amount);
}
