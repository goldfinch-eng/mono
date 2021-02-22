// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "../protocol/core/BaseUpgradeablePausable.sol";
import "../protocol/core/Pool.sol";
import "../protocol/core/Accountant.sol";
import "../protocol/core/CreditLine.sol";
import "../protocol/core/GoldfinchConfig.sol";

contract FakeV2CreditDesk is BaseUpgradeablePausable {
  uint256 public totalWritedowns;
  uint256 public totalLoansOutstanding;
  // Approximate number of blocks
  uint256 public constant BLOCKS_PER_DAY = 5760;
  GoldfinchConfig public config;

  struct Underwriter {
    uint256 governanceLimit;
    address[] creditLines;
  }

  struct Borrower {
    address[] creditLines;
  }

  event PaymentMade(
    address indexed payer,
    address indexed creditLine,
    uint256 interestAmount,
    uint256 principalAmount,
    uint256 remainingAmount
  );
  event PrepaymentMade(address indexed payer, address indexed creditLine, uint256 prepaymentAmount);
  event DrawdownMade(address indexed borrower, address indexed creditLine, uint256 drawdownAmount);
  event CreditLineCreated(address indexed borrower, address indexed creditLine);
  event PoolAddressUpdated(address indexed oldAddress, address indexed newAddress);
  event GovernanceUpdatedUnderwriterLimit(address indexed underwriter, uint256 newLimit);
  event LimitChanged(address indexed owner, string limitType, uint256 amount);

  mapping(address => Underwriter) public underwriters;
  mapping(address => Borrower) private borrowers;

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    owner;
    _config;
    return;
  }

  function someBrandNewFunction() public pure returns (uint256) {
    return 5;
  }

  function getUnderwriterCreditLines(address underwriterAddress) public view returns (address[] memory) {
    return underwriters[underwriterAddress].creditLines;
  }
}
