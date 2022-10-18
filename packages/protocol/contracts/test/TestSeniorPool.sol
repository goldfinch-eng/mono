// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../protocol/core/SeniorPool.sol";
import {IERC20} from "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";

// Contract that simply acts as a middle man between an EOA and SeniorPool, useful for testing
// scenarios where the user interacts with the SeniorPool via a smart contract
contract TestSeniorPoolCaller {
  TestSeniorPool private immutable seniorPool;

  constructor(
    TestSeniorPool _seniorPool,
    IERC20 usdc,
    IERC20 fidu
  ) public {
    seniorPool = _seniorPool;
    usdc.approve(address(_seniorPool), type(uint256).max);
    fidu.approve(address(_seniorPool), type(uint256).max);
  }

  function deposit(uint256 usdcAmount) public {
    seniorPool.deposit(usdcAmount);
  }

  function requestWithdrawal(uint256 fiduAmount) public {
    seniorPool.requestWithdrawal(fiduAmount);
  }

  function addToWithdrawalRequest(uint256 fiduAmount, uint256 tokenId) public {
    seniorPool.addToWithdrawalRequest(fiduAmount, tokenId);
  }

  function cancelWithdrawalRequest(uint256 tokenId) public {
    seniorPool.cancelWithdrawalRequest(tokenId);
  }

  function claimWithdrawalRequest(uint256 tokenId) public {
    seniorPool.claimWithdrawalRequest(tokenId);
  }
}

contract TestSeniorPool is SeniorPool {
  function _getNumShares(uint256 amount) public view returns (uint256) {
    return getNumShares(amount);
  }

  function __getNumShares(uint256 usdcAmount, uint256 sharePrice) public pure returns (uint256) {
    return getNumShares(usdcAmount, sharePrice);
  }

  function usdcMantissa() public pure returns (uint256) {
    return _usdcMantissa();
  }

  function fiduMantissa() public pure returns (uint256) {
    return _fiduMantissa();
  }

  function usdcToFidu(uint256 amount) public pure returns (uint256) {
    return _usdcToFidu(amount);
  }

  function _setSharePrice(uint256 newSharePrice) public returns (uint256) {
    sharePrice = newSharePrice;
  }

  function epochAt(uint256 id) external view returns (Epoch memory) {
    return _epochs[id];
  }
}
