// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../protocol/core/PoolTokens.sol";

contract TestPoolTokens is PoolTokens {
  bool disablePoolValidation;
  address payable sender;

  // solhint-disable-next-line modifiers/ensure-modifiers
  function _disablePoolValidation(bool shouldDisable) public {
    disablePoolValidation = shouldDisable;
  }

  // solhint-disable-next-line modifiers/ensure-modifiers
  function _setSender(address payable _sender) public {
    sender = _sender;
  }

  function validPool(address sender) internal override returns (bool) {
    if (disablePoolValidation) {
      return true;
    } else {
      return super.validPool(sender);
    }
  }

  function _msgSender() internal view override returns (address payable) {
    if (sender != address(0)) {
      return sender;
    } else {
      return super._msgSender();
    }
  }
}
