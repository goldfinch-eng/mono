// SPDX-License-Identifier: GPL-3.0-only
// solhint-disable-next-line max-line-length
// Adapted from https://github.com/Uniswap/merkle-distributor/blob/c3255bfa2b684594ecd562cacd7664b0f18330bf/contracts/MerkleDistributor.sol.
pragma solidity 0.6.12;

import "@openzeppelin/contracts/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IERC20withDec.sol";
import "../interfaces/IMerkleDirectDistributor.sol";
import "../protocol/core/BaseUpgradeablePausable.sol";
import "../rewards/MerkleDirectDistributor.sol";

// solhint-disable-next-line no-empty-blocks
contract BackerMerkleDirectDistributor is MerkleDirectDistributor {

}
