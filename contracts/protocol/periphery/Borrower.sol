pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "../core/BaseUpgradeablePausable.sol";
import "../core/ConfigHelper.sol";

/**
 * @title Goldfinch's Borrower contract
 * @notice These contracts represent the a convenient way for a borrower to interact with Goldfinch
 *  They are 100% optional. However, they let us add many sophisticated and convient features for borrowers
 *  while still keeping our core protocol small and secure. We therefore expect most borrowers will use them.
 *  This contract is the "official" borrower contract that will be maintained by Goldfinch governance. However,
 *  in theory, anyone can fork or create their own version, or not use any contract at all. The core functionality
 *  is completely agnostic to whether it is interacting with a contract or an externally owned account (EOA).
 * @author Goldfinch
 */

contract Borrower is BaseUpgradeablePausable {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0), "Owner cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    config = _config;
    // Approve pool for maximum USDC amount
    config.getUSDC().approve(config.poolAddress(), uint256(-1));
  }

  /**
   * @notice Allows a borrower to drawdown on their creditline through the CreditDesk.
   * @param creditLineAddress The creditline from which they would like to drawdown
   * @param amount The amount, in USDC atomic units, that a borrower wishes to drawdown
   * @param addressToSendTo The address where they would like the funds sent. If the zero address is passed,
   *  it will be defaulted to the contracts address (msg.sender). This is a convenience feature for when they would
   *  like the funds sent to an exchange or alternate wallet, different from the authentication address
   */
  function drawdown(
    address creditLineAddress,
    uint256 amount,
    address addressToSendTo
  ) external onlyAdmin {
    config.getCreditDesk().drawdown(creditLineAddress, amount);
    if (addressToSendTo != address(0) && addressToSendTo != address(this)) {
      transferUSDC(addressToSendTo, amount);
    }
  }

  function transferUSDC(address to, uint256 amount) public onlyAdmin {
    bool success = config.getUSDC().transfer(to, amount);
    require(success, "Failed to transfer USDC");
  }

  /**
   * @notice Allows a borrower to payback loans by calling the `pay` function directly on the CreditDesk
   * @param creditLineAddress The credit line to be paid back
   * @param amount The amount, in USDC atomic units, that the borrower wishes to pay
   */
  function pay(address creditLineAddress, uint256 amount) external onlyAdmin {
    // Transfer to creditline directly and call assess, which saves gas (one less transfer)
    // compared to going through pay
    bool success = config.getUSDC().transferFrom(msg.sender, creditLineAddress, amount);
    require(success, "Failed to transfer USDC");
    config.getCreditDesk().assessCreditLine(creditLineAddress);
  }
}
