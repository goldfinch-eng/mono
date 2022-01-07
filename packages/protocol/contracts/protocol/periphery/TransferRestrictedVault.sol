// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/drafts/IERC20Permit.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/ReentrancyGuard.sol";

import "../../external/ERC721PresetMinterPauserAutoId.sol";
import "../../interfaces/IPoolTokens.sol";
import "../../interfaces/ITranchedPool.sol";
import "../../interfaces/IPoolTokens.sol";
import "../../interfaces/ISeniorPool.sol";
import "../../interfaces/IFidu.sol";
import "../core/BaseUpgradeablePausable.sol";
import "../core/GoldfinchConfig.sol";
import "../core/ConfigHelper.sol";
import "../../library/SafeERC20Transfer.sol";

contract TransferRestrictedVault is
  ERC721PresetMinterPauserAutoIdUpgradeSafe,
  ReentrancyGuardUpgradeSafe,
  SafeERC20Transfer
{
  bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
  uint256 public constant SECONDS_PER_DAY = 60 * 60 * 24;
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using SafeMath for uint256;

  struct PoolTokenPosition {
    uint256 tokenId;
    uint256 lockedUntil;
  }

  struct FiduPosition {
    uint256 amount;
    uint256 lockedUntil;
  }

  // tokenId => poolTokenPosition
  mapping(uint256 => PoolTokenPosition) public poolTokenPositions;
  // tokenId => fiduPosition
  mapping(uint256 => FiduPosition) public fiduPositions;

  /*
    We are using our own initializer function so that OZ doesn't automatically
    set owner as msg.sender. Also, it lets us set our config contract
  */
  // solhint-disable-next-line func-name-mixedcase
  function __initialize__(address owner, GoldfinchConfig _config) external initializer {
    require(owner != address(0) && address(_config) != address(0), "Owner and config addresses cannot be empty");

    __Context_init_unchained();
    __AccessControl_init_unchained();
    __ReentrancyGuard_init_unchained();
    __ERC165_init_unchained();
    __ERC721_init_unchained("Goldfinch V2 Accredited Investor Tokens", "GFI-V2-AI");
    __Pausable_init_unchained();
    __ERC721Pausable_init_unchained();

    config = _config;

    _setupRole(PAUSER_ROLE, owner);
    _setupRole(OWNER_ROLE, owner);

    _setRoleAdmin(PAUSER_ROLE, OWNER_ROLE);
    _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
  }

  function depositJunior(ITranchedPool tranchedPool, uint256 amount) public nonReentrant {
    require(config.getGo().go(msg.sender), "This address has not been go-listed");
    safeERC20TransferFrom(config.getUSDC(), msg.sender, address(this), amount);

    approveSpender(address(tranchedPool), amount);
    uint256 poolTokenId = tranchedPool.deposit(uint256(ITranchedPool.Tranches.Junior), amount);

    uint256 transferRestrictionPeriodInSeconds = SECONDS_PER_DAY.mul(config.getTransferRestrictionPeriodInDays());

    _tokenIdTracker.increment();
    uint256 tokenId = _tokenIdTracker.current();
    poolTokenPositions[tokenId] = PoolTokenPosition({
      tokenId: poolTokenId,
      lockedUntil: block.timestamp.add(transferRestrictionPeriodInSeconds)
    });
    _mint(msg.sender, tokenId);
  }

  function depositJuniorWithPermit(
    ITranchedPool tranchedPool,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public {
    IERC20Permit(config.usdcAddress()).permit(msg.sender, address(this), amount, deadline, v, r, s);
    depositJunior(tranchedPool, amount);
  }

  function depositSenior(uint256 amount) public nonReentrant {
    safeERC20TransferFrom(config.getUSDC(), msg.sender, address(this), amount);

    ISeniorPool seniorPool = config.getSeniorPool();
    approveSpender(address(seniorPool), amount);
    uint256 depositShares = seniorPool.deposit(amount);

    uint256 transferRestrictionPeriodInSeconds = SECONDS_PER_DAY.mul(config.getTransferRestrictionPeriodInDays());

    _tokenIdTracker.increment();
    uint256 tokenId = _tokenIdTracker.current();
    fiduPositions[tokenId] = FiduPosition({
      amount: depositShares,
      lockedUntil: block.timestamp.add(transferRestrictionPeriodInSeconds)
    });
    _mint(msg.sender, tokenId);
  }

  function depositSeniorWithPermit(
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public {
    IERC20Permit(config.usdcAddress()).permit(msg.sender, address(this), amount, deadline, v, r, s);
    depositSenior(amount);
  }

  function withdrawSenior(uint256 tokenId, uint256 usdcAmount) public nonReentrant onlyTokenOwner(tokenId) {
    IFidu fidu = config.getFidu();
    ISeniorPool seniorPool = config.getSeniorPool();

    uint256 fiduBalanceBefore = fidu.balanceOf(address(this));

    uint256 receivedAmount = seniorPool.withdraw(usdcAmount);

    uint256 fiduUsed = fiduBalanceBefore.sub(fidu.balanceOf(address(this)));

    FiduPosition storage fiduPosition = fiduPositions[tokenId];

    uint256 fiduPositionAmount = fiduPosition.amount;
    require(fiduPositionAmount >= fiduUsed, "Not enough Fidu for withdrawal");
    fiduPosition.amount = fiduPositionAmount.sub(fiduUsed);

    safeERC20Transfer(config.getUSDC(), msg.sender, receivedAmount);
  }

  function withdrawSeniorInFidu(uint256 tokenId, uint256 shares) public nonReentrant onlyTokenOwner(tokenId) {
    FiduPosition storage fiduPosition = fiduPositions[tokenId];
    uint256 fiduPositionAmount = fiduPosition.amount;
    require(fiduPositionAmount >= shares, "Not enough Fidu for withdrawal");

    fiduPosition.amount = fiduPositionAmount.sub(shares);
    uint256 usdcAmount = config.getSeniorPool().withdrawInFidu(shares);
    safeERC20Transfer(config.getUSDC(), msg.sender, usdcAmount);
  }

  function withdrawJunior(uint256 tokenId, uint256 amount)
    public
    nonReentrant
    onlyTokenOwner(tokenId)
    returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
  {
    PoolTokenPosition storage position = poolTokenPositions[tokenId];
    require(position.lockedUntil > 0, "Position is empty");

    IPoolTokens poolTokens = config.getPoolTokens();
    uint256 poolTokenId = position.tokenId;
    IPoolTokens.TokenInfo memory tokenInfo = poolTokens.getTokenInfo(poolTokenId);
    ITranchedPool pool = ITranchedPool(tokenInfo.pool);

    (interestWithdrawn, principalWithdrawn) = pool.withdraw(poolTokenId, amount);
    uint256 totalWithdrawn = interestWithdrawn.add(principalWithdrawn);
    safeERC20Transfer(config.getUSDC(), msg.sender, totalWithdrawn);
    return (interestWithdrawn, principalWithdrawn);
  }

  function _beforeTokenTransfer(
    address from,
    address to,
    uint256 tokenId // solhint-disable-line no-unused-vars
  ) internal virtual override(ERC721PresetMinterPauserAutoIdUpgradeSafe) {
    // AccreditedInvestor tokens can never be transferred. The underlying positions,
    // however, can be transferred after the timelock expires.
    require(from == address(0) || to == address(0), "TransferRestrictedVault tokens cannot be transferred");
  }

  /**
   * @dev This method assumes that positions are mutually exclusive i.e. that the token
   *  represents a position in either PoolTokens or Fidu, but not both.
   */
  function transferPosition(uint256 tokenId, address to) public nonReentrant {
    require(ownerOf(tokenId) == msg.sender, "Cannot transfer position of token you don't own");

    FiduPosition storage fiduPosition = fiduPositions[tokenId];
    if (fiduPosition.lockedUntil > 0) {
      require(
        block.timestamp >= fiduPosition.lockedUntil,
        "Underlying position cannot be transferred until lockedUntil"
      );

      transferFiduPosition(fiduPosition, to);
      delete fiduPositions[tokenId];
    }

    PoolTokenPosition storage poolTokenPosition = poolTokenPositions[tokenId];
    if (poolTokenPosition.lockedUntil > 0) {
      require(
        block.timestamp >= poolTokenPosition.lockedUntil,
        "Underlying position cannot be transferred until lockedUntil"
      );

      transferPoolTokenPosition(poolTokenPosition, to);
      delete poolTokenPositions[tokenId];
    }

    _burn(tokenId);
  }

  function transferPoolTokenPosition(PoolTokenPosition storage position, address to) internal {
    IPoolTokens poolTokens = config.getPoolTokens();
    poolTokens.safeTransferFrom(address(this), to, position.tokenId);
  }

  function transferFiduPosition(FiduPosition storage position, address to) internal {
    IFidu fidu = config.getFidu();
    safeERC20Transfer(fidu, to, position.amount);
  }

  function approveSpender(address spender, uint256 allowance) internal {
    IERC20withDec usdc = config.getUSDC();
    safeERC20Approve(usdc, spender, allowance);
  }

  modifier onlyTokenOwner(uint256 tokenId) {
    require(ownerOf(tokenId) == msg.sender, "Only the token owner is allowed to call this function");
    _;
  }
}
