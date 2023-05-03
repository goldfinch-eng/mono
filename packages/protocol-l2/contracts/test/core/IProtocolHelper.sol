// SPDX-License-Identifier: MIT

pragma solidity >=0.6.12;
pragma experimental ABIEncoderV2;

import {IGoldfinchConfig} from "../../interfaces/IGoldfinchConfig.sol";
import {IGoldfinchFactory} from "../../interfaces/IGoldfinchFactory.sol";
import {IERC20} from "../../interfaces/IERC20.sol";

interface IProtocolHelper {
  function gfConfig() external returns (IGoldfinchConfig);

  function gfFactory() external returns (IGoldfinchFactory);

  function usdc() external returns (IERC20);
}
