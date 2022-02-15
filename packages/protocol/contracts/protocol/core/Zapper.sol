// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "../../interfaces/ISeniorPool.sol";
import "../../interfaces/IPoolTokens.sol";
import "../../interfaces/ITranchedPool.sol";
import "../../interfaces/IRequiresUID.sol";
import "../../interfaces/IStakingRewards.sol";
import "./Accountant.sol";
import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";

/// @title Zapper
/// @notice Moves capital from the SeniorPool to TranchedPools without taking fees
contract Zapper is BaseUpgradeablePausable {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;

  struct Zap {
    address owner;
    uint256 stakingPositionId;
  }

  /// @dev PoolToken.id => Zap
  mapping(uint256 => Zap) public zaps;

  function initialize(address owner, GoldfinchConfig _config) public initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    config = _config;
  }

  function zapStakeToTranchedPool(
    uint256 tokenId,
    ITranchedPool tranchedPool,
    uint256 tranche,
    uint256 usdcAmount
  ) public whenNotPaused nonReentrant {
    IStakingRewards stakingRewards = config.getStakingRewards();
    ISeniorPool seniorPool = config.getSeniorPool();

    require(validPool(tranchedPool), "Invalid pool");
    require(stakingRewards.ownerOf(tokenId) == msg.sender, "Not token owner");
    require(hasAllowedUID(tranchedPool), "Address not go-listed");

    uint256 shares = seniorPool.getNumShares(usdcAmount);
    stakingRewards.unstake(tokenId, shares);

    uint256 withdrawnAmount = seniorPool.withdraw(usdcAmount);
    require(withdrawnAmount == usdcAmount, "Withdrawn amount != requested amount");

    SafeERC20.safeApprove(config.getUSDC(), address(tranchedPool), usdcAmount);
    uint256 poolTokenId = tranchedPool.deposit(tranche, usdcAmount);

    zaps[poolTokenId] = Zap(msg.sender, tokenId);
  }

  function claimZap(uint256 poolTokenId) public whenNotPaused nonReentrant {
    Zap storage zap = zaps[poolTokenId];

    require(zap.owner == msg.sender, "Not zap owner");

    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    ITranchedPool.TrancheInfo memory trancheInfo = ITranchedPool(tokenInfo.pool).getTranche(tokenInfo.tranche);

    require(trancheInfo.lockedUntil != 0 && block.timestamp > trancheInfo.lockedUntil, "Zap locked");

    IERC721(poolTokens).safeTransferFrom(address(this), msg.sender, poolTokenId);
  }

  function unzap(uint256 poolTokenId) public whenNotPaused nonReentrant {
    Zap storage zap = zaps[poolTokenId];

    require(zap.owner == msg.sender, "Not zap owner");

    IPoolTokens poolTokens = config.getPoolTokens();
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    ITranchedPool tranchedPool = ITranchedPool(tokenInfo.pool);
    ITranchedPool.TrancheInfo memory trancheInfo = tranchedPool.getTranche(tokenInfo.tranche);

    require(trancheInfo.lockedUntil == 0, "Tranche locked");

    (uint256 interestWithdrawn, uint256 principalWithdrawn) = tranchedPool.withdrawMax(poolTokenId);
    require(interestWithdrawn == 0, "Invalid state");
    require(principalWithdrawn > 0, "Invalid state");

    ISeniorPool seniorPool = config.getSeniorPool();
    SafeERC20.safeApprove(config.getUSDC(), address(seniorPool), principalWithdrawn);
    uint256 fiduAmount = seniorPool.deposit(principalWithdrawn);

    IStakingRewards stakingRewards = config.getStakingRewards();
    SafeERC20.safeApprove(config.getFidu(), address(stakingRewards), fiduAmount);
    stakingRewards.addToStake(zap.stakingPositionId, fiduAmount);
  }

  function zapStakeToCurve(uint256 tokenId, uint256 fiduAmount) public whenNotPaused nonReentrant {
    IStakingRewards stakingRewards = config.getStakingRewards();
    require(stakingRewards.ownerOf(tokenId) == msg.sender, "Not token owner");

    uint256 stakedBalance = stakingRewards.stakedBalanceOf(tokenId);
    require(fiduAmount <= stakedBalance, "cannot unstake more than staked balance");

    stakingRewards.unstake(tokenId, fiduAmount);

    SafeERC20.safeApprove(config.getFidu(), address(stakingRewards), fiduAmount);

    stakingRewards.depositToCurveAndStakeFrom(address(this), msg.sender, fiduAmount, 0);
  }

  function hasAllowedUID(ITranchedPool pool) internal view returns (bool) {
    return IRequiresUID(address(pool)).hasAllowedUID(msg.sender);
  }

  function validPool(ITranchedPool pool) internal view returns (bool) {
    return config.getPoolTokens().validPool(address(pool));
  }
}
