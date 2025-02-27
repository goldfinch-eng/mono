pragma solidity ^0.8.19;

// solhint-disable-next-line max-line-length
import {IERC1155Receiver} from "@openzeppelin/contracts/interfaces/IERC1155Receiver.sol";

contract TestERC1155Receiver {
  // Implement this so the test contract can receive a UID
  function onERC1155Received(
    address,
    address,
    uint256,
    uint256,
    bytes memory
  ) external pure returns (bytes4) {
    return IERC1155Receiver.onERC1155Received.selector;
  }
}
