// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../protocol/core/PoolTokens.sol";

contract TestPoolTokens is PoolTokens {
  bool public disablePoolValidation;
  address payable public sender;

  // solhint-disable-next-line modifiers/ensure-modifiers
  function _disablePoolValidation(bool shouldDisable) public {
    disablePoolValidation = shouldDisable;
  }

  function _validPool(address _sender) internal view override returns (bool) {
    if (disablePoolValidation) {
      return true;
    } else {
      return super._validPool(_sender);
    }
  }
}
