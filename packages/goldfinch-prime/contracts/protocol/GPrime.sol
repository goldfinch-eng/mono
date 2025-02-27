// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.19;

// prettier-ignore
import {AccessControlUpgradeable}
    from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
// prettier-ignore
import {ERC20Upgradeable}
    from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
// prettier-ignore
import {ERC20BurnableUpgradeable}
    from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
// prettier-ignore
import {ERC20PausableUpgradeable}
    from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PausableUpgradeable.sol";
// prettier-ignore
import {ReentrancyGuardUpgradeable}
    from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
// prettier-ignore
import {ERC20PermitUpgradeable}
    from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";
// prettier-ignore
import {Initializable}
    from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {GoldfinchConfig} from "./core/GoldfinchConfig.sol";
import {ConfigHelper} from "./core/ConfigHelper.sol";

/**
 * @title GoldfinchPrime
 * @notice A vault contract that manages deposits and redemptions for off-chain Heron investments
 * @dev Implements non-transferable shares and controlled redemptions
 */

contract GoldfinchPrime is
  Initializable,
  ERC20Upgradeable,
  ERC20BurnableUpgradeable,
  ERC20PausableUpgradeable,
  AccessControlUpgradeable,
  ERC20PermitUpgradeable,
  ReentrancyGuardUpgradeable
{
  /// @notice Role for vault managers who can update share price and fulfill redemptions
  bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");
  /// @notice Role for addresses that can pause the contract
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;

  uint256[] public allowedUidTypes;

  /// @notice Current share price with 18 decimals of precision
  uint256 public sharePrice;

  /// @notice amount avaialble
  uint256 public availableToDrawdown;

  /// @notice Struct to track redemption requests and their fulfillment status
  struct RedemptionRequest {
    uint256 totalSharesRequested; // Total shares requested for redemption
    uint256 sharesRedeemed; // Shares that have been redeemed so far
    uint256 usdcToReceive; // USDC currently available to receive, net of fees
    uint256 totalUsdcFulfilled; // Total USDC sent in across all fulfillments (before fees)
    uint256 timestamp; // When request was made
  }

  /// @notice Mapping of user addresses to their redemption requests
  mapping(address => RedemptionRequest) public redemptionRequests;

  /// @notice Withdrawal fee in basis points (0.5%)
  uint256 public constant WITHDRAWAL_FEE_BPS = 0;
  /// @notice Basis points denominator
  uint256 public constant BPS_DENOMINATOR = 10000;
  uint256 internal constant USDC_MANTISSA = 1e6;
  uint256 internal constant GPRIME_MANTISSA = 1e18;

  // Events
  event Deposited(address indexed user, uint256 usdcAmount, uint256 sharesReceived);
  event SharePriceUpdated(uint256 oldPrice, uint256 newPrice);
  event RedemptionRequested(address indexed user, uint256 shares, uint256 timestamp);
  event RedemptionCancelled(address indexed user, uint256 remainingShares);
  event RedemptionFulfilled(
    address indexed user,
    uint256 usdcFulfilled,
    uint256 totalUsdcFulfilled,
    uint256 totalSharesRequested
  );
  event RedemptionProcessed(address indexed user, uint256 usdcReceived);

  event FeeCollected(address indexed user, uint256 feeAmount);
  event DrawdownMade(address indexed user, uint256 drawdownAmount);

  /**
   * @notice Contract constructor
   * @param manager Address of the manager who will "run" this pool
   * @param _config Address of the Goldfinch Config contract
   */

  function initialize(address manager, address _config, address protocolAdmin) public initializer {
    config = GoldfinchConfig(_config);
    __ERC20_init("GoldfinchPrime", "GPRIME");
    __ERC20Burnable_init();
    __ERC20Pausable_init();
    __AccessControl_init();
    __ERC20Permit_init("GoldfinchPrime");

    require(manager != address(0), "manager cannot be zero address");
    require(_config != address(0), "config cannot be zero address");
    require(protocolAdmin != address(0), "protocol admin cannot be zero address");

    _grantRole(DEFAULT_ADMIN_ROLE, protocolAdmin);
    _grantRole(PAUSER_ROLE, protocolAdmin);
    _grantRole(PAUSER_ROLE, manager);
    _grantRole(MANAGER_ROLE, manager);

    allowedUidTypes = [0, 4];

    // Initialize share price to 1 with 18 decimals of precision
    sharePrice = 1e18; // $1 = 1e18 atomic units
  }

  /**
   * @notice Deposit USDC to receive vault shares
   * @param usdcAmount Amount of USDC to deposit
   */
  function deposit(uint256 usdcAmount) public nonReentrant whenNotPaused {
    require(hasAllowedUID(msg.sender), "Invalid UID");
    uint256 sharesToMint = getNumShares(usdcAmount);
    require(sharesToMint > 0, "Must receive > 0 shares");

    require(
      config.getUSDC().transferFrom(msg.sender, address(this), usdcAmount),
      "Transfer failed"
    );
    _mint(msg.sender, sharesToMint);

    availableToDrawdown += usdcAmount;

    emit Deposited(msg.sender, usdcAmount, sharesToMint);
  }

  /**
   * @notice Deposit USDC using permit to approve and deposit in a single transaction
   * @param usdcAmount Amount of USDC to deposit
   * @param deadline The time at which this expires (unix time)
   * @param v v of the signature
   * @param r r of the signature
   * @param s s of the signature
   */
  function depositWithPermit(
    uint256 usdcAmount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external whenNotPaused {
    ERC20PermitUpgradeable(address(config.getUSDC())).permit(
      msg.sender,
      address(this),
      usdcAmount,
      deadline,
      v,
      r,
      s
    );
    deposit(usdcAmount);
  }

  /**
   * @notice Request redemption of shares
   * @param sharesToRedeem Amount of shares to redeem
   */
  function requestRedemption(uint256 sharesToRedeem) external nonReentrant whenNotPaused {
    require(sharesToRedeem > 0, "Must redeem > 0");
    require(sharesToRedeem <= balanceOf(msg.sender), "Insufficient shares");
    require(redemptionRequests[msg.sender].totalSharesRequested == 0, "Existing request");

    _transfer(msg.sender, address(this), sharesToRedeem);

    redemptionRequests[msg.sender] = RedemptionRequest({
      totalSharesRequested: sharesToRedeem,
      sharesRedeemed: 0,
      usdcToReceive: 0,
      totalUsdcFulfilled: 0,
      timestamp: block.timestamp
    });

    emit RedemptionRequested(msg.sender, sharesToRedeem, block.timestamp);
  }

  function hasAllowedUID(address sender) public view returns (bool) {
    return config.getGo().goOnlyIdTypes(sender, allowedUidTypes);
  }

  /**
   * @notice Cancel an existing redemption request
   * @dev Can only cancel unredeemed portion and when no pending USDC
   */
  function cancelRedemption() external nonReentrant whenNotPaused {
    RedemptionRequest memory request = redemptionRequests[msg.sender];
    require(request.totalSharesRequested > 0, "No request");

    uint256 remainingShares = request.totalSharesRequested - request.sharesRedeemed;
    require(remainingShares > 0, "No shares to cancel");
    require(request.usdcToReceive == 0, "Pending USDC to redeem");

    _transfer(address(this), msg.sender, remainingShares);
    delete redemptionRequests[msg.sender];

    emit RedemptionCancelled(msg.sender, remainingShares);
  }

  /**
   * @notice Fulfill a redemption request with USDC
   * @param user Address of the user whose redemption to fulfill
   * @param usdcAmount Amount of USDC to fulfill with
   */
  function fulfillRedemption(
    address user,
    uint256 usdcAmount
  ) external onlyRole(MANAGER_ROLE) nonReentrant whenNotPaused {
    RedemptionRequest storage request = redemptionRequests[user];
    require(usdcAmount > 0, "Amount must be > 0");
    require(request.totalSharesRequested > 0, "No request exists");
    require(request.sharesRedeemed < request.totalSharesRequested, "Already fully redeemed");

    uint256 sharesLeftToRedeem = request.totalSharesRequested - request.sharesRedeemed;
    uint256 sharesToRedeem = getNumShares(usdcAmount);
    require(sharesToRedeem <= sharesLeftToRedeem, "You are trying to fulfill too much");

    uint256 feeAmount = (usdcAmount * WITHDRAWAL_FEE_BPS) / BPS_DENOMINATOR;
    uint256 netAmount = usdcAmount - feeAmount;

    request.totalUsdcFulfilled += usdcAmount;
    request.sharesRedeemed += sharesToRedeem;
    request.usdcToReceive += netAmount;

    _burn(address(this), sharesToRedeem);
    require(
      config.getUSDC().transferFrom(msg.sender, address(this), usdcAmount),
      "Transfer failed"
    );

    if (feeAmount > 0) {
      require(
        config.getUSDC().transfer(config.protocolAdminAddress(), feeAmount),
        "Fee transfer failed"
      );
      emit FeeCollected(user, feeAmount);
    }

    emit RedemptionFulfilled(
      user,
      usdcAmount,
      request.totalUsdcFulfilled,
      request.totalSharesRequested
    );
  }

  /**
   * @notice Process a withdraw to receive all available USDC
   */
  function withdraw() external nonReentrant {
    RedemptionRequest storage request = redemptionRequests[msg.sender];
    require(request.totalSharesRequested > 0, "No request");
    require(request.usdcToReceive > 0, "No USDC available");

    uint256 usdcAmount = request.usdcToReceive;
    request.usdcToReceive = 0;

    // Only delete the request if all shares have been redeemed
    if (request.sharesRedeemed == request.totalSharesRequested) {
      delete redemptionRequests[msg.sender];
    }

    require(config.getUSDC().transfer(msg.sender, usdcAmount), "Transfer failed");

    emit RedemptionProcessed(msg.sender, usdcAmount);
  }

  function getNumShares(uint256 usdcAmount) public view returns (uint256) {
    return _getNumShares(usdcAmount, sharePrice);
  }

  function _getNumShares(uint256 _usdcAmount, uint256 _sharePrice) internal pure returns (uint256) {
    return (_usdcToGPRIME(_usdcAmount) * GPRIME_MANTISSA) / _sharePrice;
  }

  function _usdcToGPRIME(uint256 amount) internal pure returns (uint256) {
    return (amount * GPRIME_MANTISSA) / USDC_MANTISSA;
  }

  /*
	  ADMIN FUNCTIONS
  */

  /**
   * @notice Update the share price
   * @param newSharePrice New share price (with 18 decimals)
   */
  function updateSharePrice(uint256 newSharePrice) external onlyRole(MANAGER_ROLE) {
    require(newSharePrice > 0, "Invalid share price");
    uint256 oldPrice = sharePrice;
    sharePrice = newSharePrice;
    require(newSharePrice >= 1e17 && newSharePrice <= 1e19, "Share price out of allowed range");
    emit SharePriceUpdated(oldPrice, newSharePrice);
  }

  function drawdown(uint256 usdcAmountToDrawdown) external onlyRole(MANAGER_ROLE) {
    require(usdcAmountToDrawdown > 0, "Invalid drawdown amount");
    require(usdcAmountToDrawdown <= availableToDrawdown, "Insufficient available amount");
    availableToDrawdown -= usdcAmountToDrawdown;
    require(config.getUSDC().transfer(msg.sender, usdcAmountToDrawdown), "Transfer failed");
    emit DrawdownMade(msg.sender, usdcAmountToDrawdown);
  }

  /**
   * @notice Get the USDC value of a share amount
   * @param shareAmount Amount of shares to value
   * @return Value in USDC (scaled to 18 decimals)
   */
  function getShareValue(uint256 shareAmount) public view returns (uint256) {
    return (shareAmount * sharePrice * USDC_MANTISSA) / (GPRIME_MANTISSA * GPRIME_MANTISSA);
  }

  /*================================================================================
    General Internal Functions
  ================================================================================*/

  function pause() public onlyRole(PAUSER_ROLE) {
    _pause();
  }

  function unpause() public onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  // Prevent transfers by overriding ERC20 functions
  function _update(
    address from,
    address to,
    uint256 value
  ) internal virtual override(ERC20Upgradeable, ERC20PausableUpgradeable) {
    require(
      from == address(this) || to == address(this) || from == address(0) || to == address(0),
      "Shares are non-transferable"
    );
    super._update(from, to, value);
  }

  // Prevent approvals of other addresses
  function _approve(
    address owner,
    address spender,
    uint256 value,
    bool emitEvent
  ) internal virtual override(ERC20Upgradeable) {
    require(owner == address(this) || spender == address(this), "Shares are non-transferable");
    super._approve(owner, spender, value, emitEvent);
  }
}
