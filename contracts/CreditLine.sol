// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "./Pool.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";

contract CreditLine is Initializable, OwnableUpgradeSafe {
    // Credit line terms
    address public borrower;
    address public underwriter;
    uint256 public collateral;
    uint256 public limit;
    uint256 public interestApr;
    uint256 public minCollateralPercent;
    uint256 public paymentPeriodInDays;
    uint256 public termInDays;

    // Accounting variables
    uint256 public balance;
    uint256 public interestOwed;
    uint256 public principalOwed;
    uint256 public prepaymentBalance;
    uint256 public collateralBalance;
    uint256 public termEndBlock;
    uint256 public nextDueBlock;
    uint256 public lastUpdatedBlock;

    function initialize(
        address _borrower,
        address _underwriter,
        uint256 _limit,
        uint256 _interestApr,
        uint256 _minCollateralPercent,
        uint256 _paymentPeriodInDays,
        uint256 _termInDays
    ) public initializer {
        __Ownable_init();
        borrower = _borrower;
        underwriter = _underwriter;
        limit = _limit;
        interestApr = _interestApr;
        minCollateralPercent = _minCollateralPercent;
        paymentPeriodInDays = _paymentPeriodInDays;
        termInDays = _termInDays;
        lastUpdatedBlock = block.number;
    }

    function setTermEndBlock(uint256 newTermEndBlock) external onlyOwner returns (uint256) {
        return termEndBlock = newTermEndBlock;
    }

    function setNextDueBlock(uint256 newNextDueBlock) external onlyOwner returns (uint256) {
        return nextDueBlock = newNextDueBlock;
    }

    function setBalance(uint256 newBalance) external onlyOwner returns (uint256) {
        return balance = newBalance;
    }

    function setInterestOwed(uint256 newInterestOwed) external onlyOwner returns (uint256) {
        return interestOwed = newInterestOwed;
    }

    function setPrincipalOwed(uint256 newPrincipalOwed) external onlyOwner returns (uint256) {
        return principalOwed = newPrincipalOwed;
    }

    function setPrepaymentBalance(uint256 newPrepaymentBalance) external onlyOwner returns (uint256) {
        return prepaymentBalance = newPrepaymentBalance;
    }

    function setCollateralBalance(uint256 newCollateralBalance) external onlyOwner returns (uint256) {
        return collateralBalance = newCollateralBalance;
    }

    function setLastUpdatedBlock(uint256 newLastUpdatedBlock) external onlyOwner returns (uint256) {
        return lastUpdatedBlock = newLastUpdatedBlock;
    }

    function setLimit(uint256 newAmount) external onlyOwnerOrUnderwriter returns (uint256) {
        return limit = newAmount;
    }

    function authorizePool(address poolAddress) external onlyOwner {
        address erc20address = Pool(poolAddress).erc20address();

        // Approve the pool for an infinite amount
        ERC20UpgradeSafe(erc20address).approve(poolAddress, uint256(-1));
    }

    modifier onlyOwnerOrUnderwriter() {
        require((msg.sender == owner() || msg.sender == underwriter), "Restricted to owner or underwriter");
        _;
    }
}
