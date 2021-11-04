// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/drafts/IERC20Permit.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/Math.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";

import "../../interfaces/ITranchedPool.sol";
import "../../interfaces/IERC20withDec.sol";
import "../../interfaces/IV2CreditLine.sol";
import "../../interfaces/IPoolTokens.sol";
import "./GoldfinchConfig.sol";
import "./BaseUpgradeablePausable.sol";
import "./ConfigHelper.sol";
import "../../external/FixedPoint.sol";
import "../../library/SafeERC20Transfer.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Counters.sol";
import "hardhat/console.sol";

contract TranchedPool is BaseUpgradeablePausable, ITranchedPool, SafeERC20Transfer {
  GoldfinchConfig public config;
  using ConfigHelper for GoldfinchConfig;
  using FixedPoint for FixedPoint.Unsigned;
  using FixedPoint for uint256;
  using Counters for Counters.Counter;

  bytes32 public constant LOCKER_ROLE = keccak256("LOCKER_ROLE");
  uint256 public constant FP_SCALING_FACTOR = 1e18;
  uint256 public constant SECONDS_PER_DAY = 60 * 60 * 24;
  uint256 public constant ONE_HUNDRED = 100; // Need this because we cannot call .div on a literal 100
  uint256 public constant NUM_TRANCHES = 2;
  uint256 public juniorFeePercent;
  bool public drawdownsPaused;
  uint256 public totalDeposits;

  Counters.Counter public _trancheIdTracker;

//  TrancheInfo internal seniorTranche;
//  TrancheInfo internal juniorTranche;

  struct PoolSlice {
    TrancheInfo seniorTranche;
    TrancheInfo juniorTranche;
    uint256 totalInterestAccrued;
  }

//  PoolSlice[] internal poolSlices;
  mapping (uint256 => PoolSlice) internal poolSlices;
  uint8 public numSlices;

  event DepositMade(address indexed owner, uint256 indexed tranche, uint256 indexed tokenId, uint256 amount);
  event WithdrawalMade(
    address indexed owner,
    uint256 indexed tranche,
    uint256 indexed tokenId,
    uint256 interestWithdrawn,
    uint256 principalWithdrawn
  );

  event GoldfinchConfigUpdated(address indexed who, address configAddress);
  event PaymentApplied(
    address indexed payer,
    address indexed pool,
    uint256 interestAmount,
    uint256 principalAmount,
    uint256 remainingAmount,
    uint256 reserveAmount
  );
  event SharePriceUpdated(
    address indexed pool,
    uint256 indexed tranche,
    uint256 principalSharePrice,
    int256 principalDelta,
    uint256 interestSharePrice,
    int256 interestDelta
  );
  event ReserveFundsCollected(address indexed from, uint256 amount);
  event CreditLineMigrated(address indexed oldCreditLine, address indexed newCreditLine);
  event DrawdownMade(address indexed borrower, uint256 amount);
  event DrawdownsPaused(address indexed pool);
  event DrawdownsUnpaused(address indexed pool);
  event EmergencyShutdown(address indexed pool);
  event JuniorTrancheLocked(address indexed pool, uint256 lockedUntil);
  event SeniorTrancheLocked(address indexed pool, uint256 lockedUntil);

  function initialize(
    address _config,
    address _borrower,
    uint256 _juniorFeePercent,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) public override initializer {
    require(
      address(_config) != address(0) && address(_borrower) != address(0),
      "Config and borrower addresses cannot be empty"
    );

    config = GoldfinchConfig(_config);
    address owner = config.protocolAdminAddress();
    require(owner != address(0), "Owner address cannot be empty");
    __BaseUpgradeablePausable__init(owner);
    _trancheIdTracker.increment(); // Start with 1 for backwards compatibility
    initializeNextSlice();
    createAndSetCreditLine(_borrower, _limit, _interestApr, _paymentPeriodInDays, _termInDays, _lateFeeApr);

    createdAt = block.timestamp;
    juniorFeePercent = _juniorFeePercent;

    _setupRole(LOCKER_ROLE, _borrower);
    _setupRole(LOCKER_ROLE, owner);
    _setRoleAdmin(LOCKER_ROLE, OWNER_ROLE);

    // Unlock self for infinite amount
    bool success = config.getUSDC().approve(address(this), uint256(-1));
    require(success, "Failed to approve USDC");
  }

  /**
   * @notice Deposit a USDC amount into the pool for a tranche. Mints an NFT to the caller representing the position
   * @param tranche The number representing the tranche to deposit into
   * @param amount The USDC amount to tranfer from the caller to the pool
   * @return tokenId The tokenId of the NFT
   */
  function deposit(uint256 tranche, uint256 amount)
    public
    override
    nonReentrant
    whenNotPaused
    returns (uint256 tokenId)
  {
    TrancheInfo storage trancheInfo = getTrancheInfo(tranche);
    require(trancheInfo.lockedUntil == 0, "Tranche has been locked");
    require(amount > 0, "Must deposit more than zero");

    trancheInfo.principalDeposited = trancheInfo.principalDeposited.add(amount);
    console.log("Tranche %s is now %s", trancheInfo.id, trancheInfo.principalDeposited);
    totalDeposits = totalDeposits.add(amount);
    IPoolTokens.MintParams memory params = IPoolTokens.MintParams({tranche: tranche, principalAmount: amount});
    tokenId = config.getPoolTokens().mint(params, msg.sender);
    safeERC20TransferFrom(config.getUSDC(), msg.sender, address(this), amount);
    emit DepositMade(msg.sender, tranche, tokenId, amount);
    console.log("Deposited: %s into %s. Total: %s", amount, tranche, totalDeposited(poolSlices[numSlices-1]));
    return tokenId;
  }

  function depositWithPermit(
    uint256 tranche,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public override returns (uint256 tokenId) {
    IERC20Permit(config.usdcAddress()).permit(msg.sender, address(this), amount, deadline, v, r, s);
    return deposit(tranche, amount);
  }

  /**
   * @notice Withdraw an already deposited amount if the funds are available
   * @param tokenId The NFT representing the position
   * @param amount The amount to withdraw (must be <= interest+principal currently available to withdraw)
   * @return interestWithdrawn The interest amount that was withdrawn
   * @return principalWithdrawn The principal amount that was withdrawn
   */
  function withdraw(uint256 tokenId, uint256 amount)
    public
    override
    onlyTokenHolder(tokenId)
    nonReentrant
    whenNotPaused
    returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
  {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    TrancheInfo storage trancheInfo = getTrancheInfo(tokenInfo.tranche);

    return _withdraw(trancheInfo, tokenInfo, tokenId, amount);
  }

  /**
   * @notice Withdraw from many tokens (that the sender owns) in a single transaction
   * @param tokenIds An array of tokens ids representing the position
   * @param amounts An array of amounts to withdraw from the corresponding tokenIds
   */
  function withdrawMultiple(uint256[] calldata tokenIds, uint256[] calldata amounts) public override {
    require(tokenIds.length == amounts.length, "TokensIds and Amounts must be the same length");

    for (uint256 i = 0; i < amounts.length; i++) {
      withdraw(tokenIds[i], amounts[i]);
    }
  }

  /**
   * @notice Similar to withdraw but will withdraw all available funds
   * @param tokenId The NFT representing the position
   * @return interestWithdrawn The interest amount that was withdrawn
   * @return principalWithdrawn The principal amount that was withdrawn
   */
  function withdrawMax(uint256 tokenId)
    external
    override
    onlyTokenHolder(tokenId)
    nonReentrant
    whenNotPaused
    returns (uint256 interestWithdrawn, uint256 principalWithdrawn)
  {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    TrancheInfo storage trancheInfo = getTrancheInfo(tokenInfo.tranche);

    (uint256 interestRedeemable, uint256 principalRedeemable) = redeemableInterestAndPrincipal(trancheInfo, tokenInfo);

    uint256 amount = interestRedeemable.add(principalRedeemable);

    return _withdraw(trancheInfo, tokenInfo, tokenId, amount);
  }

  /**
   * @notice Draws down the funds (and locks the pool) to the borrower address. Can only be called by the borrower
   * @param amount The amount to drawdown from the creditline (must be < limit)
   */
  function drawdown(uint256 amount) external override onlyLocker whenNotPaused {
    require(!drawdownsPaused, "Drawdowns are currently paused");
    if (!locked()) {
      // Assumes the senior pool has invested already (saves the borrower a separate transaction to lock the pool)
      _lockPool();
    }
    // Drawdown only draws down from the current slice for simplicity. It's harder to account for how much
    // money is available from previous slices since depositors can redeem after unlock.
    PoolSlice storage currentSlice = poolSlices[numSlices-1];
    uint256 amountAvailable = sharePriceToUsdc(currentSlice.juniorTranche.principalSharePrice, currentSlice.juniorTranche.principalDeposited);
    amountAvailable = amountAvailable.add(sharePriceToUsdc(currentSlice.seniorTranche.principalSharePrice, currentSlice.seniorTranche.principalDeposited));
    console.log("Slice: %s, total deposited: %s. Available: %s", numSlices, totalDeposited(currentSlice), amountAvailable);

    require(amount <= amountAvailable, "Cannot drawdown more than whats available");

    creditLine.drawdown(amount);

    // Update the share price to reflect the amount remaining in the pool
    uint256 amountRemaining = amountAvailable.sub(amount);
    uint256 oldJuniorPrincipalSharePrice = currentSlice.juniorTranche.principalSharePrice;
    uint256 oldSeniorPrincipalSharePrice = currentSlice.seniorTranche.principalSharePrice;
    currentSlice.juniorTranche.principalSharePrice = calculateExpectedSharePrice(amountRemaining, currentSlice.juniorTranche, currentSlice);
    currentSlice.seniorTranche.principalSharePrice = calculateExpectedSharePrice(amountRemaining, currentSlice.seniorTranche, currentSlice);

    address borrower = creditLine.borrower();
    safeERC20TransferFrom(config.getUSDC(), address(this), borrower, amount);
    emit DrawdownMade(borrower, amount);
    emit SharePriceUpdated(
      address(this),
      currentSlice.juniorTranche.id,
      currentSlice.juniorTranche.principalSharePrice,
      int256(oldJuniorPrincipalSharePrice.sub(currentSlice.juniorTranche.principalSharePrice)) * -1,
      currentSlice.juniorTranche.interestSharePrice,
      0
    );
    emit SharePriceUpdated(
      address(this),
      currentSlice.seniorTranche.id,
      currentSlice.seniorTranche.principalSharePrice,
      int256(oldSeniorPrincipalSharePrice.sub(currentSlice.seniorTranche.principalSharePrice)) * -1,
      currentSlice.seniorTranche.interestSharePrice,
      0
    );
  }

  /**
   * @notice Locks the junior tranche, preventing more junior deposits. Gives time for the senior to determine how
   * much to invest (ensure leverage ratio cannot change for the period)
   */
  function lockJuniorCapital() external override onlyLocker whenNotPaused {
    _lockJuniorCapital(numSlices-1);
  }

  /**
   * @notice Locks the pool (locks both senior and junior tranches and starts the drawdown period). Beyond the drawdown
   * period, any unused capital is available to withdraw by all depositors
   */
  function lockPool() external override onlyLocker whenNotPaused {
    _lockPool();
  }

  function unlockPool() external override onlyLocker whenNotPaused {
    _unlockPool();
  }

  /**
   * @notice Triggers an assessment of the creditline and the applies the payments according the tranche waterfall
   */
  function assess() external override whenNotPaused {
    _assess();
  }

  /**
   * @notice Allows repaying the creditline. Collects the USDC amount from the sender and triggers an assess
   * @param amount The amount to repay
   */
  function pay(uint256 amount) external override whenNotPaused {
    require(amount > 0, "Must pay more than zero");
    console.log("Paying %s", amount);
    collectPayment(amount);
    _assess();
  }

  /**
   * @notice Migrates to a new goldfinch config address
   */
  function updateGoldfinchConfig() external onlyAdmin {
    config = GoldfinchConfig(config.configAddress());
    creditLine.updateGoldfinchConfig();
    emit GoldfinchConfigUpdated(msg.sender, address(config));
  }

  /**
   * @notice Pauses the pool and sweeps any remaining funds to the treasury reserve.
   */
  function emergencyShutdown() public onlyAdmin {
    if (!paused()) {
      pause();
    }

    IERC20withDec usdc = config.getUSDC();
    address reserveAddress = config.reserveAddress();
    // Sweep any funds to community reserve
    uint256 poolBalance = usdc.balanceOf(address(this));
    if (poolBalance > 0) {
      safeERC20Transfer(usdc, reserveAddress, poolBalance);
    }

    uint256 clBalance = usdc.balanceOf(address(creditLine));
    if (clBalance > 0) {
      safeERC20TransferFrom(usdc, address(creditLine), reserveAddress, clBalance);
    }
    emit EmergencyShutdown(address(this));
  }

  /**
   * @notice Pauses all drawdowns (but not deposits/withdraws)
   */
  function pauseDrawdowns() public onlyAdmin {
    drawdownsPaused = true;
    emit DrawdownsPaused(address(this));
  }

  /**
   * @notice Unpause drawdowns
   */
  function unpauseDrawdowns() public onlyAdmin {
    drawdownsPaused = false;
    emit DrawdownsUnpaused(address(this));
  }

  /**
   * @notice Migrates the accounting variables from the current creditline to a brand new one
   * @param _borrower The borrower address
   * @param _maxLimit The new limit
   * @param _interestApr The new interest APR
   * @param _paymentPeriodInDays The new payment period in days
   * @param _termInDays The new term in days
   * @param _lateFeeApr The new late fee APR
   */
  function migrateCreditLine(
    address _borrower,
    uint256 _maxLimit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) public onlyAdmin {
    require(_borrower != address(0), "Borrower must not be empty");
    require(_paymentPeriodInDays != 0, "Payment period must not be empty");
    require(_termInDays != 0, "Term must not be empty");

    address originalClAddr = address(creditLine);
    IV2CreditLine originalCl = IV2CreditLine(originalClAddr);

    createAndSetCreditLine(_borrower, _maxLimit, _interestApr, _paymentPeriodInDays, _termInDays, _lateFeeApr);

    IV2CreditLine newCl = creditLine;
    address newClAddr = address(newCl);

    emit CreditLineMigrated(originalClAddr, newClAddr);

    // Copy over all accounting variables
    newCl.setBalance(originalCl.balance());
    newCl.setLimit(originalCl.limit());
    newCl.setInterestOwed(originalCl.interestOwed());
    newCl.setPrincipalOwed(originalCl.principalOwed());
    newCl.setTermEndTime(originalCl.termEndTime());
    newCl.setNextDueTime(originalCl.nextDueTime());
    newCl.setInterestAccruedAsOf(originalCl.interestAccruedAsOf());
    newCl.setLastFullPaymentTime(originalCl.lastFullPaymentTime());
    newCl.setTotalInterestAccrued(originalCl.totalInterestAccrued());

    // Transfer any funds to new CL
    uint256 clBalance = config.getUSDC().balanceOf(originalClAddr);
    if (clBalance > 0) {
      safeERC20TransferFrom(config.getUSDC(), originalClAddr, newClAddr, clBalance);
    }

    if (originalCl.borrower() != newCl.borrower()) {
      revokeRole(LOCKER_ROLE, originalCl.borrower());
      grantRole(LOCKER_ROLE, newCl.borrower());
    }

    // Close out old CL
    originalCl.setBalance(0);
    originalCl.setLimit(0);
  }

  /**
   * @notice Migrates to a new creditline without copying the accounting variables
   */
  function migrateAndSetNewCreditLine(address newCl) public onlyAdmin {
    require(newCl != address(0), "Creditline cannot be empty");
    address originalClAddr = address(creditLine);
    // Transfer any funds to new CL
    uint256 clBalance = config.getUSDC().balanceOf(originalClAddr);
    if (clBalance > 0) {
      safeERC20TransferFrom(config.getUSDC(), originalClAddr, newCl, clBalance);
    }

    // Close out old CL
    creditLine.setBalance(0);
    creditLine.setLimit(0);

    // set new CL
    creditLine = IV2CreditLine(newCl);
    // sanity check that the new address is in fact a creditline
    creditLine.limit();

    emit CreditLineMigrated(originalClAddr, address(creditLine));
  }

  // CreditLine proxy method
  function setLimit(uint256 newAmount) external onlyAdmin {
    return creditLine.setLimit(newAmount);
  }

  // CreditLine proxy methods, for convenience
  function limit() public view returns (uint256) {
    return creditLine.limit();
  }

  function maxLimit() public view returns (uint256) {
    return creditLine.maxLimit();
  }

  function borrower() public view returns (address) {
    return creditLine.borrower();
  }

  function interestApr() public view returns (uint256) {
    return creditLine.interestApr();
  }

  function paymentPeriodInDays() public view returns (uint256) {
    return creditLine.paymentPeriodInDays();
  }

  function termInDays() public view returns (uint256) {
    return creditLine.termInDays();
  }

  function lateFeeApr() public view returns (uint256) {
    return creditLine.lateFeeApr();
  }

  function getTranche(uint256 tranche) public view override returns (TrancheInfo memory) {
    return getTrancheInfo(tranche);
  }

  /**
   * @notice Converts USDC amounts to share price
   * @param amount The USDC amount to convert
   * @param totalShares The total shares outstanding
   * @return The share price of the input amount
   */
  function usdcToSharePrice(uint256 amount, uint256 totalShares) public pure returns (uint256) {
    return totalShares == 0 ? 0 : amount.mul(FP_SCALING_FACTOR).div(totalShares);
  }

  /**
   * @notice Converts share price to USDC amounts
   * @param sharePrice The share price to convert
   * @param totalShares The total shares outstanding
   * @return The USDC amount of the input share price
   */
  function sharePriceToUsdc(uint256 sharePrice, uint256 totalShares) public pure returns (uint256) {
    return sharePrice.mul(totalShares).div(FP_SCALING_FACTOR);
  }

  /**
   * @notice Determines the amount of interest and principal redeemable by a particular tokenId
   * @param tokenId The token representing the position
   * @return interestRedeemable The interest available to redeem
   * @return principalRedeemable The principal available to redeem
   */
  function availableToWithdraw(uint256 tokenId)
    public
    view
    override
    returns (uint256 interestRedeemable, uint256 principalRedeemable)
  {
    IPoolTokens.TokenInfo memory tokenInfo = config.getPoolTokens().getTokenInfo(tokenId);
    TrancheInfo storage trancheInfo = getTrancheInfo(tokenInfo.tranche);

    if (currentTime() > trancheInfo.lockedUntil) {
      return redeemableInterestAndPrincipal(trancheInfo, tokenInfo);
    } else {
      console.log("Tranche still locked. Current: %s, until: %s", currentTime(), trancheInfo.lockedUntil);
      return (0, 0);
    }
  }

  /* Internal functions  */

  function _withdraw(
    TrancheInfo storage trancheInfo,
    IPoolTokens.TokenInfo memory tokenInfo,
    uint256 tokenId,
    uint256 amount
  ) internal returns (uint256 interestWithdrawn, uint256 principalWithdrawn) {
    require(amount > 0, "Must withdraw more than zero");
    (uint256 interestRedeemable, uint256 principalRedeemable) = redeemableInterestAndPrincipal(trancheInfo, tokenInfo);
    uint256 netRedeemable = interestRedeemable.add(principalRedeemable);

    require(amount <= netRedeemable, "Invalid redeem amount");
    require(currentTime() > trancheInfo.lockedUntil, "Tranche is locked");

    // If the tranche has not been locked, ensure the deposited amount is correct
    if (trancheInfo.lockedUntil == 0) {
      trancheInfo.principalDeposited = trancheInfo.principalDeposited.sub(amount);
    }

    uint256 interestToRedeem = Math.min(interestRedeemable, amount);
    uint256 principalToRedeem = Math.min(principalRedeemable, amount.sub(interestToRedeem));

    config.getPoolTokens().redeem(tokenId, principalToRedeem, interestToRedeem);
    safeERC20TransferFrom(config.getUSDC(), address(this), msg.sender, principalToRedeem.add(interestToRedeem));

    emit WithdrawalMade(msg.sender, tokenInfo.tranche, tokenId, interestToRedeem, principalToRedeem);

    return (interestToRedeem, principalToRedeem);
  }

  function redeemableInterestAndPrincipal(TrancheInfo storage trancheInfo, IPoolTokens.TokenInfo memory tokenInfo)
    internal
    view
    returns (uint256 interestRedeemable, uint256 principalRedeemable)
  {
    // This supports withdrawing before or after locking because principal share price starts at 1
    // and is set to 0 on lock. Interest share price is always 0 until interest payments come back, when it increases
    uint256 maxPrincipalRedeemable = sharePriceToUsdc(trancheInfo.principalSharePrice, tokenInfo.principalAmount);
    // The principalAmount is used as the totalShares because we want the interestSharePrice to be expressed as a
    // percent of total loan value e.g. if the interest is 10% APR, the interestSharePrice should approach a max of 0.1.
    uint256 maxInterestRedeemable = sharePriceToUsdc(trancheInfo.interestSharePrice, tokenInfo.principalAmount);

    interestRedeemable = maxInterestRedeemable.sub(tokenInfo.interestRedeemed);
    principalRedeemable = maxPrincipalRedeemable.sub(tokenInfo.principalRedeemed);

    console.log("Tranche: %s, interest Redeemable: %s, sharePrice: %s", trancheInfo.id, interestRedeemable, trancheInfo.interestSharePrice);
    return (interestRedeemable, principalRedeemable);
  }

  function _lockJuniorCapital(uint256 sliceId) internal {
    PoolSlice storage currentSlice = poolSlices[sliceId];
    require(!locked(), "Pool already locked");
    require(currentSlice.juniorTranche.lockedUntil == 0, "Junior tranche already locked");

    uint256 lockedUntil = currentTime().add(config.getDrawdownPeriodInSeconds());
    currentSlice.juniorTranche.lockedUntil = lockedUntil;

    emit JuniorTrancheLocked(address(this), lockedUntil);
  }

  function _lockPool() internal {
    PoolSlice storage currentSlice = poolSlices[numSlices - 1];
    require(currentSlice.juniorTranche.lockedUntil > 0, "Junior tranche must be locked first");
    creditLine.setLimit(Math.min(totalDeposits, creditLine.maxLimit()));

    // We start the drawdown period, so backers can withdraw unused capital after borrower draws down
    uint256 lockPeriod = config.getDrawdownPeriodInSeconds();
    currentSlice.seniorTranche.lockedUntil = currentTime().add(lockPeriod);
    currentSlice.juniorTranche.lockedUntil = currentTime().add(lockPeriod);
    console.log("Locking pool. Current time: %s, locking until: %s", currentTime(), currentSlice.juniorTranche.lockedUntil);
    emit SeniorTrancheLocked(address(this), currentSlice.seniorTranche.lockedUntil);
    emit JuniorTrancheLocked(address(this), currentSlice.juniorTranche.lockedUntil);
  }

  function _unlockPool() internal {
    // requires
    initializeNextSlice();
    //events
  }

  function initializeNextSlice() internal {
    require(numSlices < 5, "Only a maximum of 5 slices are supported");
    TrancheInfo memory seniorTranche = TrancheInfo({
      id: _trancheIdTracker.current(),
      principalSharePrice: usdcToSharePrice(1, 1),
      interestSharePrice: 0,
      principalDeposited: 0,
      lockedUntil: 0
    });
    _trancheIdTracker.increment();
    TrancheInfo memory juniorTranche = TrancheInfo({
      id: _trancheIdTracker.current(),
      principalSharePrice: usdcToSharePrice(1, 1),
      interestSharePrice: 0,
      principalDeposited: 0,
      lockedUntil: 0
    });
    poolSlices[numSlices] = PoolSlice({
      seniorTranche: seniorTranche,
      juniorTranche: juniorTranche,
      totalInterestAccrued: 0
    });
    console.log("Senior Tranche id: %s, junior tranche id: %s", poolSlices[numSlices].seniorTranche.id, poolSlices[numSlices].juniorTranche.id);
    numSlices = numSlices + 1;
  }

  function collectInterestAndPrincipal(
    address from,
    uint256 interest,
    uint256 principal
  ) internal returns (uint256 totalReserveAmount) {
    safeERC20TransferFrom(config.getUSDC(), from, address(this), principal.add(interest), "Failed to collect payment");
    // TODO @sanjay: Require pool is locked cannot collect interest payments while the new drawdown is in progress

    totalReserveAmount = 0;
    uint256 reserveFeePercent = ONE_HUNDRED.div(config.getReserveDenominator()); // Convert the denonminator to percent
    ApplyResult memory seniorTrancheApplyResult = ApplyResult({
      interestRemaining: 0,
      principalRemaining: 0,
      reserveAmount: 0
    });

    for (uint256 i = 0; i< numSlices; i++) {
      console.log("***** Slice %s SENIOR *****", i);
      PoolSlice storage currentSlice = poolSlices[i];
      uint256 sliceTotal = currentSlice.seniorTranche.principalDeposited.add(currentSlice.juniorTranche.principalDeposited);

      (uint256 interestAccrued, uint256 principalAccrued) = getTotalInterestAndPrincipal(currentSlice);

      SliceInfo memory sliceInfo = SliceInfo({
        reserveFeePercent: reserveFeePercent,
        interestAccrued: interestAccrued,
        principalAccrued: principalAccrued
      });

      // Since slices cannot be created when the loan is late, all interest collected can be assumed to split
      // pro-rata across the slices
      uint256 interestForSlice = scaleByFraction(interest, sliceTotal, totalDeposits);
      uint256 principalForSlice = scaleByFraction(principal, sliceTotal, totalDeposits);
      ApplyResult memory result = applyToSeniorTranche(currentSlice, interestForSlice, principalForSlice, sliceInfo);
      seniorTrancheApplyResult.interestRemaining = seniorTrancheApplyResult.interestRemaining.add(result.interestRemaining);
      seniorTrancheApplyResult.principalRemaining = seniorTrancheApplyResult.principalRemaining.add(result.principalRemaining);
      totalReserveAmount = totalReserveAmount.add(result.reserveAmount);
    }
    console.log("After all senior tranches. Interest remaining: %s, principal remaining: %s", seniorTrancheApplyResult.interestRemaining, seniorTrancheApplyResult.principalRemaining);
    for (uint256 i = 0; i< numSlices; i++) {
      console.log("***** Slice %s JUNIOR *****", i);
      PoolSlice storage currentSlice = poolSlices[i];
      uint256 sliceTotal = currentSlice.seniorTranche.principalDeposited.add(currentSlice.juniorTranche.principalDeposited);

      (uint256 interestAccrued, uint256 principalAccrued) = getTotalInterestAndPrincipal(currentSlice);

      SliceInfo memory sliceInfo = SliceInfo({
        reserveFeePercent: reserveFeePercent,
        interestAccrued: interestAccrued,
        principalAccrued: principalAccrued
      });

      // Any remaining interest and principal is then shared pro-rate with the junior slices
      uint256 interestForSlice = scaleByFraction(seniorTrancheApplyResult.interestRemaining, sliceTotal, totalDeposits);
      uint256 principalForSlice = scaleByFraction(seniorTrancheApplyResult.principalRemaining, sliceTotal, totalDeposits);
      ApplyResult memory result = applyToJuniorTranche(currentSlice, interestForSlice, principalForSlice, sliceInfo);
      totalReserveAmount = totalReserveAmount.add(result.reserveAmount);
    }

    sendToReserve(totalReserveAmount);
    return totalReserveAmount;
  }

  struct SliceInfo {
    uint256 reserveFeePercent;
    uint256 interestAccrued;
    uint256 principalAccrued;
  }

  struct ApplyResult {
    uint256 interestRemaining;
    uint256 principalRemaining;
    uint256 reserveAmount;
  }

  function applyToSeniorTranche(PoolSlice storage slice, uint256 interestRemaining, uint256 principalRemaining, SliceInfo memory sliceInfo) internal returns (ApplyResult memory) {
    // First determine the expected share price for the senior tranche. This is the gross amount the senior
    // tranche should receive.
    uint256 expectedInterestSharePrice = calculateExpectedSharePrice(sliceInfo.interestAccrued, slice.seniorTranche, slice);
    uint256 expectedPrincipalSharePrice = calculateExpectedSharePrice(sliceInfo.principalAccrued, slice.seniorTranche, slice);

    console.log("Total interest accrued: %s, principal accrued: %s", sliceInfo.interestAccrued, sliceInfo.principalAccrued);
    console.log("Senior Total: %s, junior total: %s", slice.seniorTranche.principalDeposited, slice.juniorTranche.principalDeposited);
    console.log("Senior interest: %s, senior principal: %s", sharePriceToUsdc(expectedInterestSharePrice, slice.seniorTranche.principalDeposited), sharePriceToUsdc(expectedPrincipalSharePrice, slice.seniorTranche.principalDeposited));

    console.log("Initial interest remaining: %s, principal remaining: %s", interestRemaining, principalRemaining);
    // Deduct the junior fee and the protocol reserve
    uint256 desiredNetInterestSharePrice = scaleByFraction(
      expectedInterestSharePrice,
      ONE_HUNDRED.sub(juniorFeePercent.add(sliceInfo.reserveFeePercent)),
      ONE_HUNDRED
    );
    // Collect protocol fee interest received (we've subtracted this from the senior portion above)
    uint256 reserveDeduction = scaleByFraction(interestRemaining, sliceInfo.reserveFeePercent, ONE_HUNDRED);
    interestRemaining = interestRemaining.sub(reserveDeduction);
    console.log("After fee interest remaining: %s, principal remaining: %s", interestRemaining, principalRemaining);

    // Apply the interest remaining so we get up to the netInterestSharePrice
    (interestRemaining, principalRemaining) = applyToTrancheBySharePrice(
      interestRemaining,
      principalRemaining,
      desiredNetInterestSharePrice,
      expectedPrincipalSharePrice,
      slice.seniorTranche
    );
    console.log("Final Senior interest: %s, senior principal: %s", sharePriceToUsdc(slice.seniorTranche.interestSharePrice, slice.seniorTranche.principalDeposited), sharePriceToUsdc(slice.seniorTranche.principalSharePrice, slice.seniorTranche.principalDeposited));
    console.log("After senior interest remaining: %s, principal remaining: %s", interestRemaining, principalRemaining);
    return ApplyResult({
      interestRemaining: interestRemaining,
      principalRemaining: principalRemaining,
      reserveAmount: reserveDeduction
    });
  }

  function applyToJuniorTranche(PoolSlice storage slice, uint256 interestRemaining, uint256 principalRemaining, SliceInfo memory sliceInfo) internal returns (ApplyResult memory) {
    // Then fill up the junior tranche with all the interest remaining, upto the principal share price
    uint256 expectedInterestSharePrice = slice.juniorTranche.interestSharePrice.add(
      usdcToSharePrice(interestRemaining, slice.juniorTranche.principalDeposited)
    );
    uint256 expectedPrincipalSharePrice = calculateExpectedSharePrice(sliceInfo.principalAccrued, slice.juniorTranche, slice);
    (interestRemaining, principalRemaining) = applyToTrancheBySharePrice(
      interestRemaining,
      principalRemaining,
      expectedInterestSharePrice,
      expectedPrincipalSharePrice,
      slice.juniorTranche
    );

    console.log("After junior remaining: %s, principal remaining: %s", interestRemaining, principalRemaining);
    // All remaining interest and principal is applied towards the junior tranche as interest
    interestRemaining = interestRemaining.add(principalRemaining);
    // Since any principal remaining is treated as interest (there is "extra" interest to be distributed)
    // we need to make sure to collect the protocol fee on the additional interest (we only deducted the
    // fee on the original interest portion)
    uint256 reserveDeduction = scaleByFraction(principalRemaining, sliceInfo.reserveFeePercent, ONE_HUNDRED);
    interestRemaining = interestRemaining.sub(reserveDeduction);
    principalRemaining = 0;

    console.log("Excess junior interest: %s", interestRemaining.add(principalRemaining));

    (interestRemaining, principalRemaining) = applyToTrancheByAmount(
      interestRemaining.add(principalRemaining),
      0,
      interestRemaining.add(principalRemaining),
      0,
      slice.juniorTranche
    );
    console.log("Final Junior interest: %s, senior principal: %s", sharePriceToUsdc(slice.juniorTranche.interestSharePrice, slice.juniorTranche.principalDeposited), sharePriceToUsdc(slice.juniorTranche.principalSharePrice, slice.juniorTranche.principalDeposited));
    return ApplyResult({
      interestRemaining: interestRemaining,
      principalRemaining: principalRemaining,
      reserveAmount: reserveDeduction
    });
  }

  function getTotalInterestAndPrincipal(PoolSlice memory slice) internal view returns (uint256 interestAccrued, uint256 principalAccrued) {
    interestAccrued = creditLine.totalInterestAccrued();
    principalAccrued = creditLine.principalOwed();
    // Add any remaining balance we have to the principal accrued so expected share price will reflect partial
    // drawdowns appropriately. (e.g. if 300K was drawndown from a 1M loan, current and expected share price should
    // be 0.7 and not 0)
    // TODO: this is incorrect. May need to look at total deposits and scale by fraction?
    // TODO: How to handle the fact that the drawdown is only from the most recent slice?
    // TODO: Also needs to account for principal amortization.
    principalAccrued = principalAccrued.add(totalDeposited(slice).sub(creditLine.balance()));
    return (slice.totalInterestAccrued, principalAccrued);
  }

  function calculateExpectedSharePrice(uint256 amount, TrancheInfo memory tranche, PoolSlice memory slice) internal view returns (uint256) {
    uint256 sharePrice = usdcToSharePrice(amount, tranche.principalDeposited);
    return scaleByPercentOwnership(sharePrice, tranche, slice);
  }

  // If the senior tranche of the current slice is locked, then the pool is not open to any more deposits (could throw off leverage ratio)
  function locked() internal view returns (bool) {
    return poolSlices[numSlices-1].seniorTranche.lockedUntil > 0;
  }

  function createAndSetCreditLine(
    address _borrower,
    uint256 _limit,
    uint256 _interestApr,
    uint256 _paymentPeriodInDays,
    uint256 _termInDays,
    uint256 _lateFeeApr
  ) internal {
    address _creditLine = config.getGoldfinchFactory().createCreditLine();
    creditLine = IV2CreditLine(_creditLine);
    creditLine.initialize(
      address(config),
      address(this), // Set self as the owner
      _borrower,
      _limit,
      _interestApr,
      _paymentPeriodInDays,
      _termInDays,
      _lateFeeApr
    );
  }

  function getTrancheInfo(uint256 tranche) internal view returns (TrancheInfo storage) {
    require(tranche > 0 && tranche <= numSlices * NUM_TRANCHES, "Unsupported tranche");
    uint256 sliceId = ((tranche + (tranche % NUM_TRANCHES)) / NUM_TRANCHES) - 1;
    PoolSlice storage slice = poolSlices[sliceId];
    TrancheInfo storage trancheInfo = tranche % NUM_TRANCHES == 1 ? slice.seniorTranche : slice.juniorTranche;
    return trancheInfo;
  }

  function scaleByPercentOwnership(uint256 amount, TrancheInfo memory tranche, PoolSlice memory slice) internal view returns (uint256) {
    uint256 totalDeposited = slice.juniorTranche.principalDeposited.add(slice.seniorTranche.principalDeposited);
    return scaleByFraction(amount, tranche.principalDeposited, totalDeposited);
  }

  function scaleByFraction(
    uint256 amount,
    uint256 fraction,
    uint256 total
  ) internal pure returns (uint256) {
    FixedPoint.Unsigned memory totalAsFixedPoint = FixedPoint.fromUnscaledUint(total);
    FixedPoint.Unsigned memory fractionAsFixedPoint = FixedPoint.fromUnscaledUint(fraction);
    return fractionAsFixedPoint.div(totalAsFixedPoint).mul(amount).div(FP_SCALING_FACTOR).rawValue;
  }

  function totalDeposited(PoolSlice memory slice) internal view returns (uint256) {
    return slice.juniorTranche.principalDeposited.add(slice.seniorTranche.principalDeposited);
  }

  function currentTime() internal view virtual returns (uint256) {
    return block.timestamp;
  }

  function applyToTrancheBySharePrice(
    uint256 interestRemaining,
    uint256 principalRemaining,
    uint256 desiredInterestSharePrice,
    uint256 desiredPrincipalSharePrice,
    TrancheInfo storage tranche
  ) internal returns (uint256, uint256) {
    uint256 totalShares = tranche.principalDeposited;

    // If the desired share price is lower, then ignore it, and leave it unchanged
    uint256 principalSharePrice = tranche.principalSharePrice;
    if (desiredPrincipalSharePrice < principalSharePrice) {
      desiredPrincipalSharePrice = principalSharePrice;
    }
    uint256 interestSharePrice = tranche.interestSharePrice;
    if (desiredInterestSharePrice < interestSharePrice) {
      desiredInterestSharePrice = interestSharePrice;
    }
    uint256 interestSharePriceDifference = desiredInterestSharePrice.sub(interestSharePrice);
    uint256 desiredInterestAmount = sharePriceToUsdc(interestSharePriceDifference, totalShares);
    uint256 principalSharePriceDifference = desiredPrincipalSharePrice.sub(principalSharePrice);
    uint256 desiredPrincipalAmount = sharePriceToUsdc(principalSharePriceDifference, totalShares);

    if (tranche.id == 1) {  // senior
      console.log("Applying %s to senior interest", interestRemaining);
      console.log("Current share price: %s, desired share price: %s", interestSharePrice, desiredInterestSharePrice);
      console.log("Current amount: %s, desired amount: %s, difference: %s", sharePriceToUsdc(tranche.interestSharePrice, totalShares), sharePriceToUsdc(desiredInterestSharePrice, totalShares), sharePriceToUsdc(interestSharePriceDifference, totalShares));
    }

    (interestRemaining, principalRemaining) = applyToTrancheByAmount(
      interestRemaining,
      principalRemaining,
      desiredInterestAmount,
      desiredPrincipalAmount,
      tranche
    );
    return (interestRemaining, principalRemaining);
  }

  function applyToTrancheByAmount(
    uint256 interestRemaining,
    uint256 principalRemaining,
    uint256 desiredInterestAmount,
    uint256 desiredPrincipalAmount,
    TrancheInfo storage tranche
  ) internal returns (uint256, uint256) {
    uint256 totalShares = tranche.principalDeposited;
    uint256 newSharePrice;

    (interestRemaining, newSharePrice) = applyToSharePrice(
      interestRemaining,
      tranche.interestSharePrice,
      desiredInterestAmount,
      totalShares
    );
    uint256 oldInterestSharePrice = tranche.interestSharePrice;
    tranche.interestSharePrice = newSharePrice;

    (principalRemaining, newSharePrice) = applyToSharePrice(
      principalRemaining,
      tranche.principalSharePrice,
      desiredPrincipalAmount,
      totalShares
    );
    uint256 oldPrincipalSharePrice = tranche.principalSharePrice;
    tranche.principalSharePrice = newSharePrice;
    emit SharePriceUpdated(
      address(this),
      tranche.id,
      tranche.principalSharePrice,
      int256(tranche.principalSharePrice.sub(oldPrincipalSharePrice)),
      tranche.interestSharePrice,
      int256(tranche.interestSharePrice.sub(oldInterestSharePrice))
    );
    return (interestRemaining, principalRemaining);
  }

  function applyToSharePrice(
    uint256 amountRemaining,
    uint256 currentSharePrice,
    uint256 desiredAmount,
    uint256 totalShares
  ) internal pure returns (uint256, uint256) {
    // If no money left to apply, or don't need any changes, return the original amounts
    if (amountRemaining == 0 || desiredAmount == 0) {
      return (amountRemaining, currentSharePrice);
    }
    if (amountRemaining < desiredAmount) {
      // We don't have enough money to adjust share price to the desired level. So just use whatever amount is left
      desiredAmount = amountRemaining;
    }
    uint256 sharePriceDifference = usdcToSharePrice(desiredAmount, totalShares);
    return (amountRemaining.sub(desiredAmount), currentSharePrice.add(sharePriceDifference));
  }

  function sendToReserve(uint256 amount) internal {
    emit ReserveFundsCollected(address(this), amount);
    safeERC20TransferFrom(
      config.getUSDC(),
      address(this),
      config.reserveAddress(),
      amount,
      "Failed to send to reserve"
    );
  }

  function collectPayment(uint256 amount) internal {
    safeERC20TransferFrom(config.getUSDC(), msg.sender, address(creditLine), amount, "Failed to collect payment");
  }

  function _assess() internal {
    uint256 interestAccrued = creditLine.totalInterestAccrued();
    (uint256 paymentRemaining, uint256 interestPayment, uint256 principalPayment) = creditLine.assess();
    interestAccrued = creditLine.totalInterestAccrued().sub(interestAccrued);

    // Split the interest accrued proportionally across slices so we know how much interest goes to each slice
    // We need this because the slice start at different times, so we cannot retroactively allocate the interest linearly
    for (uint256 i=0; i < numSlices; i++) {
      PoolSlice storage slice = poolSlices[i];
      uint256 interestForSlice = scaleByFraction(interestAccrued, slice.juniorTranche.principalDeposited.add(slice.seniorTranche.principalDeposited), totalDeposits);
      console.log("Interest Accrued: %s, for slice: %s", interestAccrued, interestForSlice);
      slice.totalInterestAccrued = slice.totalInterestAccrued.add(interestForSlice);
    }

    console.log("Interest: %s, principal: %s, remaining: %s", interestPayment, principalPayment, paymentRemaining);
    if (interestPayment > 0 || principalPayment > 0) {
      config.getPoolRewards().allocateRewards(interestPayment);
      uint256 reserveAmount = collectInterestAndPrincipal(
        address(creditLine),
        interestPayment,
        principalPayment.add(paymentRemaining)
      );
      emit PaymentApplied(
        creditLine.borrower(),
        address(this),
        interestPayment,
        principalPayment,
        paymentRemaining,
        reserveAmount
      );
    }
  }

  modifier onlyLocker() {
    require(hasRole(LOCKER_ROLE, msg.sender), "Must have locker role to perform this action");
    _;
  }

  modifier onlyTokenHolder(uint256 tokenId) {
    require(
      config.getPoolTokens().isApprovedOrOwner(msg.sender, tokenId),
      "Only the token owner is allowed to call this function"
    );
    _;
  }
}
