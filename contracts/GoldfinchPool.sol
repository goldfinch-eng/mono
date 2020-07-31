// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GoldfinchPool is Ownable {
    using SafeMath for uint256;
    struct CapitalProvider {
        uint shares;
    }
    uint public sharePrice = 1e18;
    uint mantissa = 1e18;
    uint public totalShares;
    mapping(address => CapitalProvider) public capitalProviders;

    function deposit() external payable {
        CapitalProvider storage cp = capitalProviders[msg.sender];
        uint newShares = msg.value.mul(mantissa).div(sharePrice);
        totalShares = totalShares.add(newShares);
        cp.shares = cp.shares.add(newShares);
    }
}
