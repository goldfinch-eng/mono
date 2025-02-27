// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {GoldfinchPrime} from "../../protocol/GPrime.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

contract MockReentrancyAttacker is IERC1155Receiver {
  GoldfinchPrime public prime;
  IERC20 public usdc;

  constructor(address _prime, address _usdc) {
    prime = GoldfinchPrime(_prime);
    usdc = IERC20(_usdc);
  }

  function attack() external {
    // Approve and deposit
    usdc.approve(address(prime), 1000e6);
    prime.deposit(1000e6);

    // Request redemption
    uint256 shares = prime.balanceOf(address(this));
    prime.requestRedemption(shares);

    // Try to withdraw during redemption request
    prime.withdraw();
  }

  // Fallback function that tries to reenter
  receive() external payable {
    if (address(prime).balance > 0) {
      prime.withdraw();
    }
  }

  function onERC1155Received(
    address,
    address,
    uint256,
    uint256,
    bytes calldata
  ) external pure override returns (bytes4) {
    return this.onERC1155Received.selector;
  }

  function onERC1155BatchReceived(
    address,
    address,
    uint256[] calldata,
    uint256[] calldata,
    bytes calldata
  ) external pure override returns (bytes4) {
    return this.onERC1155BatchReceived.selector;
  }

  function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
    return
      interfaceId == type(IERC1155Receiver).interfaceId || interfaceId == type(IERC165).interfaceId;
  }
}
