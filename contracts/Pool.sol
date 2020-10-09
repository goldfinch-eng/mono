// SPDX-License-Identifier: MIT

pragma solidity ^0.6.8;

import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/Initializable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "./OwnerPausable.sol";

contract Pool is Initializable, OwnableUpgradeSafe, OwnerPausable {
    using SafeMath for uint256;
    uint256 public sharePrice;
    uint256 mantissa;
    uint256 public totalShares;
    mapping(address => uint256) public capitalProviders;
    address public erc20address;
    string name;
    uint256 public totalFundsLimit = 0;
    uint256 public transactionLimit = 0;

    event DepositMade(address indexed capitalProvider, uint256 amount);
    event WithdrawalMade(address indexed capitalProvider, uint256 amount);
    event TransferMade(address indexed from, address indexed to, uint256 amount);
    event InterestCollected(address indexed payer, uint256 amount);
    event PrincipalCollected(address indexed payer, uint256 amount);
    event LimitChanged(address indexed owner, string limitType, uint256 amount);

    function initialize(
        address _erc20address,
        string memory _name,
        uint256 _mantissa
    ) public initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __OwnerPausable__init();
        name = _name;
        erc20address = _erc20address;
        mantissa = _mantissa;
        sharePrice = _mantissa;

        // Sanity check the address
        ERC20UpgradeSafe(erc20address).totalSupply();

        // Unlock self for infinite amount
        ERC20UpgradeSafe(erc20address).approve(address(this), uint256(-1));
    }

    function deposit(uint256 amount) external payable whenNotPaused {
        require(transactionWithinLimit(amount), "Amount is over the per-transaction limit.");
        // Determine current shares the address has, and the amount of new shares to be added
        uint256 currentShares = capitalProviders[msg.sender];
        uint256 depositShares = getNumShares(amount, mantissa, sharePrice);
        uint256 potentialNewTotalShares = totalShares.add(depositShares);
        require(poolWithinLimit(potentialNewTotalShares), "Deposit would put the Pool over the total limit.");

        doERC20Transfer(msg.sender, address(this), amount);

        // Add the new shares to both the pool and the address
        totalShares = totalShares.add(depositShares);
        capitalProviders[msg.sender] = currentShares.add(depositShares);

        emit DepositMade(msg.sender, amount);
    }

    function withdraw(uint256 amount) external whenNotPaused {
        // Determine current shares the address has and the shares requested to withdraw
        require(transactionWithinLimit(amount), "Amount is over the per-transaction limit");
        uint256 currentShares = capitalProviders[msg.sender];
        uint256 withdrawShares = getNumShares(amount, mantissa, sharePrice);

        // Ensure the address has enough value in the pool
        require(withdrawShares <= currentShares, "Amount requested is greater than what this address owns");

        // Remove the new shares from both the pool and the address
        totalShares = totalShares.sub(withdrawShares);
        capitalProviders[msg.sender] = currentShares.sub(withdrawShares);

        // Send the amount to the address
        doERC20Transfer(address(this), msg.sender, amount);
        emit WithdrawalMade(msg.sender, amount);
    }

    function collectInterestRepayment(address from, uint256 amount) external whenNotPaused {
        doERC20Transfer(from, address(this), amount);
        uint256 increment = amount.mul(mantissa).div(totalShares);
        sharePrice = sharePrice + increment;
        emit InterestCollected(from, amount);
    }

    function collectPrincipalRepayment(address from, uint256 amount) external whenNotPaused {
        // Purposefully does nothing except receive money. No share price updates for principal.
        doERC20Transfer(from, address(this), amount);
        emit PrincipalCollected(from, amount);
    }

    function setTotalFundsLimit(uint256 amount) public onlyOwner whenNotPaused {
        totalFundsLimit = amount;
        emit LimitChanged(msg.sender, "totalFundsLimit", amount);
    }

    function setTransactionLimit(uint256 amount) public onlyOwner whenNotPaused {
        transactionLimit = amount;
        emit LimitChanged(msg.sender, "transactionLimit", amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public onlyOwner whenNotPaused returns (bool) {
        bool result = doERC20Transfer(from, to, amount);
        emit TransferMade(from, to, amount);
        return result;
    }

    function enoughBalance(address user, uint256 amount) public view whenNotPaused returns (bool) {
        return ERC20UpgradeSafe(erc20address).balanceOf(user) >= amount;
    }

    /* Internal Functions */

    function poolWithinLimit(uint256 _totalShares) internal view returns (bool) {
        return _totalShares.mul(sharePrice).div(mantissa) <= totalFundsLimit;
    }

    function transactionWithinLimit(uint256 amount) internal view returns (bool) {
        return amount <= transactionLimit;
    }

    function getNumShares(
        uint256 amount,
        uint256 multiplier,
        uint256 price
    ) internal pure returns (uint256) {
        return amount.mul(multiplier).div(price);
    }

    function doERC20Transfer(
        address from,
        address to,
        uint256 amount
    ) internal returns (bool) {
        ERC20UpgradeSafe erc20 = ERC20UpgradeSafe(erc20address);
        uint256 balanceBefore = erc20.balanceOf(to);

        bool success = erc20.transferFrom(from, to, amount);

        // Calculate the amount that was *actually* transferred
        uint256 balanceAfter = erc20.balanceOf(to);
        require(balanceAfter >= balanceBefore, "Token Transfer Overflow Error");
        return success;
    }

    function doERC20Withdraw(address payable to, uint256 amount) internal returns (bool) {
        ERC20UpgradeSafe erc20 = ERC20UpgradeSafe(erc20address);
        bool success = erc20.transfer(to, amount);

        require(success, "Token Withdraw Failed");
        return success;
    }
}
