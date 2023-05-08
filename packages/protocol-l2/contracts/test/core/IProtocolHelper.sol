// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {IGoldfinchFactory} from "../../interfaces/IGoldfinchFactory.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

interface IProtocolHelper {
  function gfConfig() external returns (IGoldfinchConfig);

  function gfFactory() external returns (IGoldfinchFactory);

  function usdc() external returns (IERC20);
}
