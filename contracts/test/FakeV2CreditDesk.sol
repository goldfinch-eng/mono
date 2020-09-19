// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Address.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "../Pool.sol";
import "../Accountant.sol";
import "../CreditLine.sol";

contract FakeV2CreditDesk is Initializable, OwnableUpgradeSafe {
  using SafeMath for uint256;

  // Approximate number of blocks
  uint public constant blocksPerDay = 5760;
  address public poolAddress;

  struct Underwriter {
    uint governanceLimit;
    address[] creditLines;
  }

  struct Borrower {
    address[] creditLines;
  }

  event PaymentMade(address indexed payer, address indexed creditLine, uint interestAmount, uint principalAmount, uint remainingAmount);
  event PrepaymentMade(address indexed payer, address indexed creditLine, uint prepaymentAmount);
  event DrawdownMade(address indexed borrower, address indexed creditLine, uint drawdownAmount);
  event CreditLineCreated(address indexed borrower, address indexed creditLine);
  event PoolAddressUpdated(address indexed oldAddress, address indexed newAddress);
  event GovernanceUpdatedUnderwriterLimit(address indexed underwriter, uint newLimit);

  mapping(address => Underwriter) public underwriters;
  mapping(address => Borrower) private borrowers;

  function initialize(address _poolAddress) public initializer {
    __Ownable_init();
  }

  // This is just a silly function to test upgrades when you change function logic
  function getUnderwriterCreditLines(address _underwriterAddress) public pure returns (uint) {
    uint result = 5;
    return result;
  }

  /*
   * Internal Functions
  */

}
