// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./IFund.sol";
import "./ITranchedPool.sol";

abstract contract ISeniorPoolStrategy {
  function invest(IFund fund, ITranchedPool pool) public view virtual returns (uint256 amount);

  function estimateInvestment(IFund fund, ITranchedPool pool) public view virtual returns (uint256);
}
