// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/upgrades/contracts/Initializable.sol";

contract Pool is Ownable, Initializable {
  using SafeMath for uint256;
  uint public sharePrice;
  uint mantissa;
  uint public totalShares;
  mapping(address => uint) public capitalProviders;
  address public erc20address;
  string name;

  function initialize(address _erc20address, string memory _name, uint _mantissa) public initializer {
    name = _name;
    erc20address = _erc20address;
    mantissa = _mantissa;
    sharePrice = _mantissa;

    // Sanity check the address
    ERC20(erc20address).totalSupply();
  }

  function deposit(uint amount) external payable {
    // Determine current shares the address has, and the amount of new shares to be added
    uint currentShares = capitalProviders[msg.sender];
    uint depositShares = getNumShares(amount, mantissa, sharePrice);

    doERC20Deposit(msg.sender, amount);

    // Add the new shares to both the pool and the address
    totalShares = totalShares.add(depositShares);
    capitalProviders[msg.sender] = currentShares.add(depositShares);
  }

  function withdraw(uint amount) external {
    // Determine current shares the address has and the shares requested to withdraw
    uint currentShares = capitalProviders[msg.sender];
    uint withdrawShares = getNumShares(amount, mantissa, sharePrice);

    // Ensure the address has enough value in the pool
    require(withdrawShares <= currentShares, "Amount requested is greater than the amount owned for this address");

    // Remove the new shares from both the pool and the address
    totalShares = totalShares.sub(withdrawShares);
    capitalProviders[msg.sender] = currentShares.sub(withdrawShares);

    // Send the amount to the address
    doERC20Withdraw(msg.sender, amount);
  }

  function receiveInterestRepayment() external payable {
    uint increment = msg.value.mul(mantissa).div(totalShares);
    sharePrice = sharePrice + increment;
  }

  function receivePrincipalRepayment() external payable {
    // Purposefully does nothing except receive money. No share price updates.
  }

  function transferFunds(address payable recipient, uint amount) public onlyOwner returns (bool) {
    doERC20Withdraw(recipient, amount);
  }

  /* Internal Functions */

  function getNumShares(uint amount, uint multiplier, uint price) internal pure returns (uint) {
    return amount.mul(multiplier).div(price);
  }

  function doERC20Deposit(address from, uint amount) internal returns (bool) {
      ERC20 erc20 = ERC20(erc20address);
      uint balanceBefore = erc20.balanceOf(address(this));

      bool success = erc20.transferFrom(from, address(this), amount);

      // Calculate the amount that was *actually* transferred
      uint balanceAfter = erc20.balanceOf(address(this));
      require(balanceAfter >= balanceBefore, "Token Transfer Deposit Overflow Error");
      return success;
  }

  function doERC20Withdraw(address payable to, uint amount) internal returns (bool) {
      ERC20 erc20 = ERC20(erc20address);
      bool success = erc20.transfer(to, amount);

      require(success, "Token Withdraw Failed");
      return success;
  }
}
