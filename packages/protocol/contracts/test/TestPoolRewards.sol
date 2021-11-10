// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../rewards/PoolRewards.sol";

contract TestPoolRewards is PoolRewards {
  address payable public sender;

  // solhint-disable-next-line modifiers/ensure-modifiers
  function _setSender(address payable _sender) public {
    sender = _sender;
  }

  function _msgSender() internal view override returns (address payable) {
    if (sender != address(0)) {
      return sender;
    } else {
      return super._msgSender();
    }
  }
}
