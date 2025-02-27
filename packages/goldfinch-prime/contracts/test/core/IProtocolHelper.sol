// SPDX-License-Identifier: MIT

pragma solidity >=0.8.19;

import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

interface IProtocolHelper {
  function gfConfig() external returns (IGoldfinchConfig);

  function usdc() external returns (IERC20);
}
