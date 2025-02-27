// SPDX-License-Identifier: MIT

pragma solidity >=0.8.19;

import {IERC20WithName} from "../interfaces/IERC20WithName.sol";

// solhint-disable-next-line max-line-length
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

interface ITestUSDC is IERC20WithName, IERC20Permit {}
